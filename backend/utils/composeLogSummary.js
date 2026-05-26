/** Masque les chemins absolus Windows/Linux dans les logs affichés. */
export function redactAbsolutePaths(text) {
  return String(text || "")
    .replace(/[A-Za-z]:\\[^\s\n]+/g, "[chemin-temporaire]")
    .replace(/\/(?:tmp|var|Users)[^\s\n]+/g, "[chemin-temporaire]");
}

const DEFAULT_CONTAINER_PORTS = [80, 443, 3000, 5000, 5173, 4200, 8080, 8000, 8888];

/** Parse `docker compose ps --format json` (NDJSON ou tableau JSON). */
export function parseComposePsRows(stdout) {
  const text = String(stdout || "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") return [parsed];
  } catch {
    /* NDJSON ligne par ligne */
  }
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^NAME\b/i.test(trimmed)) continue;
    try {
      const row = JSON.parse(trimmed);
      if (Array.isArray(row)) rows.push(...row);
      else rows.push(row);
    } catch {
      /* ignorer */
    }
  }
  return rows;
}

/** Parse la sortie de `docker compose port service 3000` → port hôte (>0). */
export function parseHostPortFromComposePortOutput(text) {
  const line = String(text || "").trim().split(/\r?\n/)[0] || "";
  const m =
    line.match(/0\.0\.0\.0:(\d{2,5})/) ||
    line.match(/\[::]:(\d{2,5})/) ||
    line.match(/:(\d{2,5})\s*$/);
  const port = m ? Number(m[1]) : 0;
  return Number.isFinite(port) && port > 0 ? port : 0;
}

export function pushAccessLink(links, seen, { service, hostPort, containerPort }) {
  if (!hostPort || hostPort <= 0) return;
  const key = `${service}:${hostPort}`;
  if (seen.has(key)) return;
  seen.add(key);
  links.push({
    service,
    url: `http://127.0.0.1:${hostPort}`,
    hostPort,
    containerPort: containerPort != null ? Number(containerPort) : null,
  });
}

/** Extrait les liens depuis `docker compose ps` (JSON ou tableau). */
export function parseComposeAccessLinks(psStdout) {
  const links = [];
  const seen = new Set();
  const text = String(psStdout || "");

  for (const row of parseComposePsRows(psStdout)) {
    const service = row.Service || row.Name?.replace(/-\d+$/, "") || "service";
    if (Array.isArray(row.Publishers)) {
      for (const pub of row.Publishers) {
        let hostPort = Number(pub.PublishedPort ?? pub.publishedPort);
        const target = pub.TargetPort ?? pub.targetPort;
        if (!hostPort || hostPort <= 0) {
          const url = String(pub.URL || "");
          const um = url.match(/:(\d{2,5})\/?$/);
          hostPort = um ? Number(um[1]) : 0;
        }
        pushAccessLink(links, seen, { service, hostPort, containerPort: target });
      }
    }
    if (row.Ports) {
      for (const m of String(row.Ports).matchAll(
        /(?:0\.0\.0\.0|\[::\]|127\.0\.0\.1):(\d{2,5})->(\d{2,5})\/tcp/g
      )) {
        pushAccessLink(links, seen, {
          service,
          hostPort: Number(m[1]),
          containerPort: Number(m[2]),
        });
      }
    }
  }

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || /^NAME\b/i.test(trimmed)) continue;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) continue;
    const nameMatch = trimmed.match(/^(\S+)/);
    const service = nameMatch ? nameMatch[1].replace(/-\d+$/, "") : "service";
    for (const m of trimmed.matchAll(
      /(?:0\.0\.0\.0|\[::\]|127\.0\.0\.1):(\d{2,5})->(\d{2,5})\/tcp/g
    )) {
      pushAccessLink(links, seen, {
        service,
        hostPort: Number(m[1]),
        containerPort: Number(m[2]),
      });
    }
  }
  return links;
}

/**
 * Résout les ports publiés via `docker compose port` (fiable avec mapping 0:3000).
 * @param {Function} runDocker - (args, opts) => Promise<{ok, stdout}>
 */
export async function resolveComposeAccessLinks(
  runDocker,
  {
    workDir,
    composeArgs,
    projectName,
    env,
    serviceNames,
    containerPorts = DEFAULT_CONTAINER_PORTS,
  }
) {
  const links = [];
  const seen = new Set();
  const names = Array.isArray(serviceNames) ? serviceNames : [];
  const withProject = projectName ? [...composeArgs, "-p", projectName] : composeArgs;

  for (const service of names) {
    for (const cp of containerPorts) {
      const res = await runDocker(["compose", ...withProject, "port", service, String(cp)], {
        cwd: workDir,
        env,
        timeoutMs: 8000,
      });
      if (!res.ok) continue;
      const hostPort = parseHostPortFromComposePortOutput(res.stdout);
      if (hostPort > 0) {
        pushAccessLink(links, seen, { service, hostPort, containerPort: cp });
        break;
      }
    }
  }
  return links;
}

/** Fusionne ps + compose port (compose port prioritaire si ps invalide). */
export function mergeComposeAccessLinks(psLinks, portLinks) {
  const byService = new Map();
  for (const link of psLinks || []) {
    if (link.hostPort > 0) byService.set(link.service, link);
  }
  for (const link of portLinks || []) {
    if (link.hostPort > 0) byService.set(link.service, link);
  }
  return [...byService.values()];
}

export function buildComposeSummary({
  ok,
  phases,
  projectName,
  suggestedDockerTests,
  accessLinks,
  containersLeftRunning,
  servicesReport,
}) {
  const lines = [];
  const pts = suggestedDockerTests != null ? `${suggestedDockerTests}/3` : "—";
  lines.push(
    ok
      ? `Test Docker réussi — suggestion barème : ${pts}`
      : `Test Docker terminé avec erreurs — suggestion barème : ${pts}`
  );
  if (projectName) lines.push(`Projet isolé : ${projectName}`);
  if (phases?.config) lines.push(`• Validation du compose : ${phases.config.ok ? "OK" : "échec"}`);
  if (phases?.build) lines.push(`• Construction des images : ${phases.build.ok ? "OK" : "échec"}`);
  if (phases?.up?.skipped) {
    lines.push("• Démarrage des conteneurs : non testé (mode rapide)");
  } else if (phases?.up) {
    lines.push(`• Démarrage des conteneurs : ${phases.up.ok ? "OK" : "échec"}`);
    const ps = phases.up.psStdout || phases.ps?.stdout || "";
    const running = ps
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /\bUp\b/i.test(l) && !/^NAME\b/i.test(l));
    if (running.length) {
      lines.push(`• Services actifs : ${running.length} conteneur(s)`);
    }
  }
  if (servicesReport?.notRunning?.length) {
    lines.push(
      `• Attention : ${servicesReport.notRunning.length} service(s) attendu(s) non démarré(s) : ${servicesReport.notRunning.map((s) => s.service).join(", ")}`
    );
    lines.push(
      "  (Le test reste partiellement réussi si au moins un conteneur tourne — voir logs ci-dessous.)"
    );
  }
  if (containersLeftRunning && accessLinks?.length) {
    lines.push("• Accès navigateur (conteneurs laissés démarrés) :");
    for (const link of accessLinks) {
      const portHint =
        link.containerPort != null ? ` (conteneur :${link.containerPort})` : "";
      lines.push(`  - ${link.service}${portHint} → ${link.url}`);
    }
    lines.push(
      "• Docker Desktop : filtrez par le nom du projet ci-dessus ; les ports 0:XXXX indiquent le port hôte attribué."
    );
  } else if (containersLeftRunning) {
    lines.push(
      "• Conteneurs laissés démarrés — ouvrez Docker Desktop et notez le port hôte (colonne Ports, ex. 0.0.0.0:49152→3000)."
    );
  }
  return lines.join("\n");
}
