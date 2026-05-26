import { runDockerCommand } from "./dockerRun.js";
import {
  mergeComposeAccessLinks,
  parseComposeAccessLinks,
  parseComposePsRows,
  parseHostPortFromComposePortOutput,
  pushAccessLink,
} from "./composeLogSummary.js";

const DEFAULT_CONTAINER_PORTS = [80, 443, 3000, 5000, 5173, 4200, 8080, 8000, 8888];

const DB_ONLY_SERVICES = new Set([
  "db",
  "postgres",
  "postgresql",
  "mysql",
  "mariadb",
  "mongo",
  "mongodb",
  "redis",
]);

function serviceNameFromContainer(containerName, projectName) {
  const prefix = `${projectName}-`;
  if (containerName.startsWith(prefix)) {
    return containerName.slice(prefix.length).replace(/-\d+$/, "");
  }
  const parts = containerName.split("-");
  if (parts.length >= 3 && /^\d+$/.test(parts[parts.length - 1])) {
    return parts.slice(1, -1).join("-") || parts[parts.length - 2];
  }
  return containerName.replace(/-\d+$/, "") || containerName;
}

export function parseComposeServicePortTargets(ports) {
  if (ports == null) return [];
  const arr = Array.isArray(ports) ? ports : [ports];
  const targets = [];
  for (const p of arr) {
    if (typeof p === "number" && p > 0) targets.push(p);
    else if (typeof p === "string") {
      const parts = p.split(":");
      const last = Number(parts[parts.length - 1]);
      if (last > 0) targets.push(last);
      if (parts.length >= 2) {
        const first = Number(parts[0]);
        if (first > 0) targets.push(first);
      }
    } else if (p && typeof p === "object") {
      if (p.target) targets.push(Number(p.target));
      if (p.published) targets.push(Number(p.published));
    }
  }
  return [...new Set(targets.filter((n) => Number.isFinite(n) && n > 0 && n < 65536))];
}

export async function resolvePortsFromComposeConfig(
  runDocker,
  { workDir, composeArgs, projectName, env, serviceNames, timeoutMs = 15000 }
) {
  const names = Array.isArray(serviceNames) ? serviceNames : [];
  if (!names.length) return {};
  const withProject = projectName ? [...composeArgs, "-p", projectName] : composeArgs;
  const res = await runDocker(["compose", ...withProject, "config", "--format", "json"], {
    cwd: workDir,
    env,
    timeoutMs,
  });
  if (!res.ok) return {};
  let cfg;
  try {
    cfg = JSON.parse(res.stdout);
  } catch {
    return {};
  }
  const out = {};
  for (const svc of names) {
    const spec = cfg.services?.[svc];
    if (!spec) continue;
    const targets = [
      ...parseComposeServicePortTargets(spec.ports),
      ...parseComposeServicePortTargets(spec.expose),
    ];
    if (targets.length) out[svc] = targets;
  }
  return out;
}

export async function resolveAccessLinksViaDockerPort(runDocker, projectName) {
  if (!projectName) return [];
  const ps = await runDocker(
    [
      "ps",
      "-a",
      "--filter",
      `label=com.docker.compose.project=${projectName}`,
      "--format",
      "{{.Names}}",
    ],
    { timeoutMs: 12000 }
  );
  if (!ps.ok || !ps.stdout.trim()) return [];

  const links = [];
  const seen = new Set();

  for (const containerName of ps.stdout.trim().split(/\r?\n/).filter(Boolean)) {
    const service = serviceNameFromContainer(containerName, projectName);
    if (DB_ONLY_SERVICES.has(service.toLowerCase())) continue;

    const portRes = await runDocker(["port", containerName], { timeoutMs: 8000 });
    if (!portRes.ok) continue;

    for (const line of portRes.stdout.split(/\r?\n/)) {
      const m = line.match(/^(\d+)\/tcp -> (?:0\.0\.0\.0|\[::\]|127\.0\.0\.1):(\d+)/);
      if (m) {
        pushAccessLink(links, seen, {
          service,
          hostPort: Number(m[2]),
          containerPort: Number(m[1]),
        });
      }
    }
  }
  return links;
}

export async function resolveComposeAccessLinksEnhanced(
  runDocker,
  {
    workDir,
    composeArgs,
    projectName,
    env,
    serviceNames,
    portsByService = {},
    containerPorts = DEFAULT_CONTAINER_PORTS,
  }
) {
  const links = [];
  const seen = new Set();
  const names = Array.isArray(serviceNames) ? serviceNames : [];
  const withProject = projectName ? [...composeArgs, "-p", projectName] : composeArgs;

  for (const service of names) {
    if (DB_ONLY_SERVICES.has(service.toLowerCase())) continue;
    const fromConfig = portsByService[service] || [];
    const portsToTry = [...new Set([...fromConfig, ...containerPorts])];
    for (const cp of portsToTry) {
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

/** Agrège toutes les sources de ports pour un projet sandbox en cours. */
export async function discoverSandboxAccessLinks({
  workDir = null,
  composeArgs = [],
  projectName,
  env = {},
  serviceNames = [],
  psStdout = "",
}) {
  const runDocker = runDockerCommand;
  const psRows = parseComposePsRows(psStdout);
  const psFromRows = [];
  const seen = new Set();
  for (const row of psRows) {
    const service = row.Service || serviceNameFromContainer(String(row.Name || ""), projectName);
    if (Array.isArray(row.Publishers)) {
      for (const pub of row.Publishers) {
        let hostPort = Number(pub.PublishedPort ?? pub.publishedPort);
        const target = pub.TargetPort ?? pub.targetPort;
        if (!hostPort || hostPort <= 0) {
          const um = String(pub.URL || "").match(/:(\d{2,5})\/?$/);
          hostPort = um ? Number(um[1]) : 0;
        }
        pushAccessLink(psFromRows, seen, { service, hostPort, containerPort: target });
      }
    }
    if (row.Ports) {
      for (const m of String(row.Ports).matchAll(
        /(?:0\.0\.0\.0|\[::\]|127\.0\.0\.1):(\d{2,5})->(\d{2,5})\/tcp/g
      )) {
        pushAccessLink(psFromRows, seen, {
          service,
          hostPort: Number(m[1]),
          containerPort: Number(m[2]),
        });
      }
    }
  }

  const psLinks = mergeComposeAccessLinks(parseComposeAccessLinks(psStdout), psFromRows);
  const portsByService = workDir
    ? await resolvePortsFromComposeConfig(runDocker, {
        workDir,
        composeArgs,
        projectName,
        env,
        serviceNames,
      })
    : {};

  const composePortLinks = workDir
    ? await resolveComposeAccessLinksEnhanced(runDocker, {
        workDir,
        composeArgs,
        projectName,
        env,
        serviceNames,
        portsByService,
      })
    : [];

  const dockerPortLinks = await resolveAccessLinksViaDockerPort(runDocker, projectName);

  return mergeComposeAccessLinks(
    mergeComposeAccessLinks(psLinks, composePortLinks),
    dockerPortLinks
  );
}

/** Rafraîchit les liens pour un projet Docker déjà démarré (sans workDir si supprimé). */
export async function refreshAccessLinksForProject(projectName, { workDir, composeArgs, env, serviceNames }) {
  const dockerPortLinks = await resolveAccessLinksViaDockerPort(runDockerCommand, projectName);
  if (dockerPortLinks.length) return dockerPortLinks;

  if (workDir && composeArgs?.length) {
    const portsByService = await resolvePortsFromComposeConfig(runDockerCommand, {
      workDir,
      composeArgs,
      projectName,
      env: env || { COMPOSE_PROJECT_NAME: projectName },
      serviceNames: serviceNames || [],
    });
    return resolveComposeAccessLinksEnhanced(runDockerCommand, {
      workDir,
      composeArgs,
      projectName,
      env: env || { COMPOSE_PROJECT_NAME: projectName },
      serviceNames: serviceNames || [],
      portsByService,
    });
  }

  return dockerPortLinks;
}
