import fs from "fs";
import path from "path";
import { parseComposeServicePortTargets } from "./sandboxAccessLinks.js";

const HARDENING_FILENAME = "docker-compose.sandbox-hardening.yml";

/** Durcissement actif sauf désactivation explicite. */
export function isSandboxHardeningEnabled() {
  const v = String(process.env.SANDBOX_COMPOSE_HARDEN ?? "true").toLowerCase();
  return !(v === "0" || v === "false" || v === "no");
}

/** Réseau internal=true bloque l’accès navigateur depuis l’hôte — désactivé par défaut si conteneurs laissés actifs. */
export function sandboxNetworkInternal() {
  const explicit = process.env.SANDBOX_NETWORK_INTERNAL;
  if (explicit != null && String(explicit).trim() !== "") {
    const v = String(explicit).toLowerCase();
    return !(v === "0" || v === "false" || v === "no");
  }
  const teardown = String(process.env.SANDBOX_COMPOSE_TEARDOWN || "").toLowerCase();
  if (teardown === "1" || teardown === "true" || teardown === "yes") return true;
  const keep = String(process.env.SANDBOX_KEEP_CONTAINERS_UP ?? "true").toLowerCase();
  const keepUp = !(keep === "0" || keep === "false" || keep === "no");
  return !keepUp;
}

export function sandboxResourceLimits() {
  return {
    memLimit: String(process.env.SANDBOX_MEM_LIMIT || "512m").trim(),
    cpus: String(process.env.SANDBOX_CPUS || "1").trim(),
    pidsLimit: Math.max(32, Number(process.env.SANDBOX_PIDS_LIMIT) || 256),
    networkInternal: sandboxNetworkInternal(),
  };
}

const DANGEROUS_PATTERNS = [
  {
    id: "docker_socket",
    re: /\/var\/run\/docker\.sock|docker\.sock/i,
    message: "Montage du socket Docker interdit dans le sandbox.",
  },
  {
    id: "privileged",
    re: /^\s*privileged:\s*true\s*$/im,
    message: "Mode privileged interdit.",
  },
  {
    id: "pid_host",
    re: /^\s*pid:\s*["']?host["']?\s*$/im,
    message: "pid: host interdit.",
  },
  {
    id: "network_host",
    re: /^\s*network_mode:\s*["']?host["']?\s*$/im,
    message: "network_mode: host interdit.",
  },
  {
    id: "ipc_host",
    re: /^\s*ipc:\s*["']?host["']?\s*$/im,
    message: "ipc: host interdit.",
  },
  {
    id: "uts_host",
    re: /^\s*uts:\s*["']?host["']?\s*$/im,
    message: "uts: host interdit.",
  },
  {
    id: "cgroup_host",
    re: /\/sys\/fs\/cgroup|\/proc\/sys/i,
    message: "Montage cgroup/sys interdit.",
  },
  {
    id: "root_fs_mount",
    re: /source:\s*["']?\/["']?\s*$/im,
    message: "Montage de la racine système (/) interdit.",
  },
  {
    id: "windows_system",
    re: /source:\s*["']?[A-Za-z]:\\(?:Windows|Program Files)/i,
    message: "Montage de répertoires système Windows interdit.",
  },
];

/**
 * Analyse la sortie de `docker compose config` (YAML résolu).
 * @returns {{ ok: boolean, violations: string[] }}
 */
export function auditComposeConfig(configText) {
  const text = String(configText || "");
  const violations = [];
  for (const rule of DANGEROUS_PATTERNS) {
    if (rule.re.test(text)) violations.push(rule.message);
  }
  const uniq = [...new Set(violations)];
  return { ok: uniq.length === 0, violations: uniq };
}

/**
 * Génère un override Compose avec limites CPU/RAM, capabilities réduites, réseau isolé.
 */
export function buildHardeningOverrideYaml(serviceNames) {
  const names = Array.isArray(serviceNames) ? serviceNames.filter(Boolean) : [];
  if (names.length === 0) return null;

  const { memLimit, cpus, pidsLimit, networkInternal } = sandboxResourceLimits();
  const lines = [
    "# Généré par la plateforme — durcissement sandbox (ne pas modifier manuellement)",
    "networks:",
    "  sandbox_isolated:",
    `    internal: ${networkInternal ? "true" : "false"}`,
    "services:",
  ];

  for (const name of names) {
    lines.push(`  ${name}:`);
    lines.push("    privileged: false");
    lines.push("    security_opt:");
    lines.push("      - no-new-privileges:true");
    // Pas cap_drop: ALL — casse nginx / Node (CHOWN, SETUID…) → frontend Exited (1) en ~2 s
    lines.push("    cap_drop:");
    lines.push("      - NET_ADMIN");
    lines.push("      - SYS_ADMIN");
    lines.push("      - SYS_PTRACE");
    lines.push("      - SYS_MODULE");
    lines.push("      - MKNOD");
    lines.push("    cap_add:");
    lines.push("      - CHOWN");
    lines.push("      - SETGID");
    lines.push("      - SETUID");
    lines.push("      - DAC_OVERRIDE");
    lines.push(`    mem_limit: ${memLimit}`);
    lines.push(`    cpus: ${cpus}`);
    lines.push(`    pids_limit: ${pidsLimit}`);
    lines.push("    networks:");
    lines.push("      - sandbox_isolated");
    lines.push("    tmpfs:");
    lines.push("      - /tmp:rw,noexec,nosuid,size=64m");
    lines.push("      - /var/run:rw,nosuid,size=16m");
    lines.push("      - /var/cache/nginx:rw,noexec,nosuid,size=48m");
  }

  return `${lines.join("\n")}\n`;
}

/**
 * Écrit l’override de durcissement dans workDir et retourne les chemins des fichiers compose.
 */
export function writeSandboxHardeningFiles(workDir, mainComposeBasename, serviceNames) {
  if (!isSandboxHardeningEnabled()) {
    return {
      composeFiles: [mainComposeBasename],
      hardened: false,
      hardeningFile: null,
      networkInternal: false,
    };
  }
  const yaml = buildHardeningOverrideYaml(serviceNames);
  if (!yaml) {
    return {
      composeFiles: [mainComposeBasename],
      hardened: false,
      hardeningFile: null,
      networkInternal: false,
    };
  }
  const hardeningPath = path.join(workDir, HARDENING_FILENAME);
  fs.writeFileSync(hardeningPath, yaml, "utf8");
  const { networkInternal } = sandboxResourceLimits();
  return {
    composeFiles: [mainComposeBasename, HARDENING_FILENAME],
    hardened: true,
    hardeningFile: HARDENING_FILENAME,
    networkInternal,
  };
}

export function maxConcurrentSandboxes() {
  const n = Number(process.env.SANDBOX_MAX_CONCURRENT);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 2;
}

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

const PUBLISH_PORTS_FILENAME = "docker-compose.sandbox-publish.yml";

/**
 * Override pour publier sur l’hôte les ports déjà en `expose` sans `ports:`.
 */
export function buildPublishPortsOverrideYaml(configJson, serviceNames) {
  const names = Array.isArray(serviceNames) ? serviceNames : [];
  const lines = [
    "# Généré — publication ports hôte (prof / navigateur)",
    "services:",
  ];
  let any = false;
  for (const svc of names) {
    if (DB_ONLY_SERVICES.has(String(svc).toLowerCase())) continue;
    const spec = configJson?.services?.[svc];
    if (!spec) continue;
    const published = parseComposeServicePortTargets(spec.ports);
    if (published.length > 0) continue;
    const expose = parseComposeServicePortTargets(spec.expose);
    if (!expose.length) continue;
    any = true;
    lines.push(`  ${svc}:`);
    lines.push("    ports:");
    for (const p of expose) {
      lines.push(`      - "0:${p}"`);
    }
  }
  if (!any) return null;
  return `${lines.join("\n")}\n`;
}

/** Écrit l’override publish si le réseau n’est pas internal. */
export function writePublishPortsOverride(workDir, configJson, serviceNames) {
  if (sandboxNetworkInternal()) return null;
  const yaml = buildPublishPortsOverrideYaml(configJson, serviceNames);
  if (!yaml) return null;
  fs.writeFileSync(path.join(workDir, PUBLISH_PORTS_FILENAME), yaml, "utf8");
  return PUBLISH_PORTS_FILENAME;
}

export { HARDENING_FILENAME, PUBLISH_PORTS_FILENAME };
