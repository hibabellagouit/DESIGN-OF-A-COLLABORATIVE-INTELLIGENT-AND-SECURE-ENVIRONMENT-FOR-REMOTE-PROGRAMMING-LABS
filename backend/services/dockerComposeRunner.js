import { spawn } from "child_process";
import path from "path";
import crypto from "crypto";
import { patchComposeFileForSandbox } from "../utils/sandboxComposePatch.js";
import {
  auditComposeConfig,
  isSandboxHardeningEnabled,
  writeSandboxHardeningFiles,
  writePublishPortsOverride,
} from "../utils/sandboxComposeHarden.js";
import { acquireSandboxSlot } from "../utils/sandboxConcurrency.js";
import {
  buildComposeSummary,
  redactAbsolutePaths,
} from "../utils/composeLogSummary.js";
import { discoverSandboxAccessLinks } from "../utils/sandboxAccessLinks.js";
import {
  buildServicesReport,
  enrichServicesReportWithLogs,
} from "../utils/composeServiceStatus.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function ensureDockerAvailable() {
  return new Promise((resolve, reject) => {
    const p = spawn("docker", ["version"], { stdio: "ignore" });
    p.on("error", () => reject(new Error("Docker non disponible sur le serveur")));
    p.on("exit", (code) => {
      if (code === 0) resolve(true);
      else reject(new Error("Docker non disponible sur le serveur"));
    });
  });
}

function runDocker(args, { cwd, env = {}, timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn("docker", args, {
      cwd,
      env: { ...process.env, ...env },
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let killed = false;

    const killTimer = setTimeout(() => {
      killed = true;
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
    }, Math.max(5000, timeoutMs));

    child.stdout?.on("data", (d) => {
      stdout += d.toString();
      if (stdout.length > 32000) stdout = stdout.slice(-32000);
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > 32000) stderr = stderr.slice(-32000);
    });

    child.on("close", (code) => {
      clearTimeout(killTimer);
      resolve({
        ok: !killed && code === 0,
        exitCode: killed ? null : code,
        timedOut: killed,
        stdout,
        stderr,
      });
    });

    child.on("error", (err) => {
      clearTimeout(killTimer);
      resolve({
        ok: false,
        exitCode: null,
        timedOut: false,
        stdout,
        stderr: `${stderr}\n${err?.message || "Docker error"}`.trim(),
      });
    });
  });
}

function composeTimeouts() {
  const mode = String(process.env.SANDBOX_COMPOSE_MODE || "balanced").toLowerCase();
  return {
    mode,
    configMs: Number(process.env.COMPOSE_CONFIG_TIMEOUT_MS || 20000),
    buildMs: Number(process.env.COMPOSE_BUILD_TIMEOUT_MS || 90000),
    upMs: Number(process.env.COMPOSE_UP_TIMEOUT_MS || 45000),
    downMs: Number(process.env.COMPOSE_DOWN_TIMEOUT_MS || 30000),
    waitAfterUpMs: Number(process.env.COMPOSE_WAIT_AFTER_UP_MS || 6000),
  };
}

/** Par défaut : laisser les conteneurs démarrés pour que le prof puisse tester dans le navigateur / Docker Desktop. */
function shouldKeepContainersRunning() {
  const teardown = String(process.env.SANDBOX_COMPOSE_TEARDOWN || "").toLowerCase();
  if (teardown === "1" || teardown === "true" || teardown === "yes") return false;
  const keep = String(process.env.SANDBOX_KEEP_CONTAINERS_UP ?? "true").toLowerCase();
  return !(keep === "0" || keep === "false" || keep === "no");
}

/** Arrête un ancien projet sandbox (avant un nouveau test sur la même soumission). */
export async function tearDownComposeProject({ workDir, projectName, composeFile, composeFiles }) {
  if (!projectName) return;
  const env = { COMPOSE_PROJECT_NAME: projectName };
  const files =
    Array.isArray(composeFiles) && composeFiles.length
      ? composeFiles
      : [composeFile || "docker-compose.yml"];
  const fileArgs = files.flatMap((f) => ["-f", f]);
  const baseArgs = ["compose", ...fileArgs, "-p", projectName];
  if (workDir) {
    await runDocker([...baseArgs, "down", "-v", "--remove-orphans"], {
      cwd: workDir,
      env,
      timeoutMs: 30000,
    }).catch(() => {});
    return;
  }
  const listed = await runDocker(
    ["ps", "-q", "--filter", `label=com.docker.compose.project=${projectName}`],
    { cwd: process.cwd(), env: {}, timeoutMs: 15000 }
  );
  const ids = listed.stdout
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (ids.length) {
    await runDocker(["rm", "-f", ...ids], { cwd: process.cwd(), env: {}, timeoutMs: 30000 }).catch(
      () => {}
    );
  }
}

function appendLog(parts, label, step) {
  parts.push(`=== ${label} ===`);
  if (step.timedOut) parts.push("(délai dépassé)");
  if (step.exitCode != null) parts.push(`code: ${step.exitCode}`);
  if (step.stderr) parts.push(step.stderr);
  if (step.stdout) parts.push(step.stdout);
}

/** Infos affichables côté UI. */
export function getPublicComposeHints() {
  const t = composeTimeouts();
  const modeLabel = t.mode === "fast" ? "rapide (config + build)" : "complet (config + build + démarrage court)";
  return {
    timeoutMs: t.configMs + t.buildMs + (t.mode === "fast" ? 0 : t.upMs + t.waitAfterUpMs) + t.downMs,
    composeFiles: ["docker-compose.yml", "docker-compose.yaml"],
    command: `Test ${modeLabel}`,
    description:
      "Le test est découpé en étapes : validation, build, démarrage. " +
      (t.mode === "fast"
        ? "Sans démarrage des conteneurs (mode rapide)."
        : "Les conteneurs restent démarrés après un test réussi (ports dynamiques) pour essai dans le navigateur / Docker Desktop."),
    mode: t.mode,
    keepContainersUp: shouldKeepContainersRunning(),
    hardened: isSandboxHardeningEnabled(),
    maxConcurrent: Number(process.env.SANDBOX_MAX_CONCURRENT) || 2,
  };
}

function composeFileArgs(composeFiles) {
  const files = Array.isArray(composeFiles) ? composeFiles : [composeFiles];
  return files.flatMap((f) => ["-f", f]);
}

async function listComposeServiceNames(workDir, composeArgs, env, timeoutMs) {
  const res = await runDocker(["compose", ...composeArgs, "config", "--services"], {
    cwd: workDir,
    env,
    timeoutMs,
  });
  if (!res.ok) return [];
  return res.stdout
    .trim()
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Test Docker Compose en plusieurs phases (plus rapide et plus fiable que up --build seul).
 */
export async function runDockerCompose({ workDir, composeFilePath }) {
  await ensureDockerAvailable();

  const releaseSlot = await acquireSandboxSlot();
  try {
    return await runDockerComposeInner({ workDir, composeFilePath });
  } finally {
    releaseSlot();
  }
}

async function runDockerComposeInner({ workDir, composeFilePath }) {
  const t = composeTimeouts();
  const projectName = `sandbox${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const { composeFilePath: effectiveComposePath, patched } = patchComposeFileForSandbox(composeFilePath);
  const mainComposeFile = path.basename(effectiveComposePath);
  const env = {
    COMPOSE_PROJECT_NAME: projectName,
    COMPOSE_DISABLE_ENV_FILE: "1",
  };

  const preArgs = ["compose", ...composeFileArgs([mainComposeFile]), "-p", projectName];
  const serviceNames = await listComposeServiceNames(workDir, composeFileArgs([mainComposeFile]), env, t.configMs);
  const stack = writeSandboxHardeningFiles(workDir, mainComposeFile, serviceNames);
  const composeFileArgsList = composeFileArgs(stack.composeFiles);
  const baseArgs = ["compose", ...composeFileArgsList, "-p", projectName];

  const phases = {};
  const logParts = [];
  if (stack.hardened) {
    const netNote = stack.networkInternal
      ? "Réseau internal (pas d’accès hôte — SANDBOX_NETWORK_INTERNAL=true)"
      : "Réseau publié sur l’hôte (accès navigateur pour le prof)";
    logParts.push(`=== Durcissement sandbox ===\n${netNote}, cap_drop, limites CPU/RAM, tmpfs /tmp`);
  }

  const config = await runDocker([...baseArgs, "config"], { cwd: workDir, env, timeoutMs: t.configMs });
  phases.config = config;
  appendLog(logParts, "1/3 Validation (compose config)", config);

  if (config.ok) {
    const audit = auditComposeConfig(config.stdout);
    phases.security = { ok: audit.ok, violations: audit.violations };
    if (!audit.ok) {
      config.ok = false;
      config.stderr = `${config.stderr || ""}\n[Sécurité] ${audit.violations.join(" ")}`.trim();
      appendLog(logParts, "Audit sécurité compose", {
        ok: false,
        stderr: config.stderr,
        stdout: "",
        exitCode: 1,
        timedOut: false,
      });
    }
  }

  if (!config.ok) {
    await runDocker([...baseArgs, "down", "-v", "--remove-orphans"], {
      cwd: workDir,
      env,
      timeoutMs: t.downMs,
    }).catch(() => {});
    return finalizeResult({
      ok: false,
      phases,
      logParts,
      projectName,
      composeFile: mainComposeFile,
      patched,
      hardened: stack.hardened,
      timedOut: config.timedOut,
      exitCode: config.exitCode,
    });
  }

  let composeFileArgsListActive = composeFileArgsList;
  let baseArgsActive = baseArgs;
  if (!stack.networkInternal) {
    const cfgJson = await runDocker([...baseArgs, "config", "--format", "json"], {
      cwd: workDir,
      env,
      timeoutMs: t.configMs,
    });
    if (cfgJson.ok) {
      try {
        const parsed = JSON.parse(cfgJson.stdout);
        const publishFile = writePublishPortsOverride(workDir, parsed, serviceNames);
        if (publishFile) {
          composeFileArgsListActive = composeFileArgs([...stack.composeFiles, publishFile]);
          baseArgsActive = ["compose", ...composeFileArgsListActive, "-p", projectName];
          logParts.push(
            "=== Ports hôte ===\nPublication automatique (0:…) pour services en expose uniquement (frontend, backend, adminer…)."
          );
        }
      } catch {
        /* ignore */
      }
    }
  }

  const build = await runDocker([...baseArgsActive, "build", "--pull=false"], {
    cwd: workDir,
    env,
    timeoutMs: t.buildMs,
  });
  phases.build = build;
  appendLog(logParts, "2/3 Construction (compose build)", build);

  let up = { ok: true, skipped: true, stdout: "", stderr: "" };
  let accessLinks = [];
  const keepUp = shouldKeepContainersRunning();
  if (t.mode !== "fast" && build.ok) {
    up = await runDocker(
      [...baseArgsActive, "up", "-d", "--no-build", "--remove-orphans"],
      { cwd: workDir, env, timeoutMs: t.upMs }
    );
    if (up.ok && t.waitAfterUpMs > 0) {
      await sleep(t.waitAfterUpMs);
    }
    const ps = await runDocker(
      [...baseArgsActive, "ps", "--format", "json"],
      { cwd: workDir, env, timeoutMs: 15000 }
    );
    if (!ps.stdout?.trim()) {
      const psTable = await runDocker([...baseArgsActive, "ps"], { cwd: workDir, env, timeoutMs: 15000 });
      ps.stdout = psTable.stdout;
    }
    const psAll = await runDocker(
      [...baseArgsActive, "ps", "-a", "--format", "json"],
      { cwd: workDir, env, timeoutMs: 15000 }
    );
    let servicesReport = buildServicesReport(
      psAll.stdout || ps.stdout,
      serviceNames
    );
    if (!servicesReport.allRunning && serviceNames.length > 1 && t.waitAfterUpMs > 0) {
      await sleep(Math.min(12000, t.waitAfterUpMs + 4000));
      const psAllRetry = await runDocker(
        [...baseArgsActive, "ps", "-a", "--format", "json"],
        { cwd: workDir, env, timeoutMs: 15000 }
      );
      servicesReport = buildServicesReport(psAllRetry.stdout || ps.stdout, serviceNames);
    }
    servicesReport = await enrichServicesReportWithLogs(servicesReport, runDocker, {
      workDir,
      composeArgs: composeFileArgsListActive,
      projectName,
      env,
    });

    const running =
      up.ok &&
      (servicesReport.runningCount > 0 ||
        /running|up\b/i.test(ps.stdout) ||
        /healthy/i.test(ps.stdout) ||
        /"State":"running"/i.test(ps.stdout));
    up.ok = running;
    up.allServicesRunning = servicesReport.allRunning;
    up.servicesReport = servicesReport;
    up.psStdout = ps.stdout;
    phases.up = up;
    phases.ps = ps;
    accessLinks = await discoverSandboxAccessLinks({
      workDir,
      composeArgs: composeFileArgsListActive,
      projectName,
      env,
      serviceNames,
      psStdout: ps.stdout,
    });
    appendLog(logParts, "3/3 Démarrage (compose up -d)", up);
    if (ps.stdout) logParts.push(ps.stdout);
    if (accessLinks.length) {
      logParts.push("=== Accès navigateur ===");
      for (const link of accessLinks) {
        logParts.push(`${link.service} → ${link.url}`);
      }
    }
    if (servicesReport.notRunning?.length) {
      logParts.push("=== Services non démarrés ===");
      for (const s of servicesReport.notRunning) {
        logParts.push(`${s.service} : ${s.status || s.state}`);
        if (s.logTail) logParts.push(s.logTail);
      }
    }
  } else if (t.mode === "fast") {
    phases.up = up;
    logParts.push("=== 3/3 Démarrage ===\n(ignoré en mode rapide SANDBOX_COMPOSE_MODE=fast)");
  } else {
    phases.up = { ok: false, skipped: false, stderr: "Build échoué — démarrage non tenté." };
  }

  const ok =
    config.ok &&
    build.ok &&
    (phases.up?.skipped === true || phases.up?.ok === true);

  const containersLeftRunning = Boolean(keepUp && ok && phases.up?.ok && !phases.up?.skipped);

  if (!containersLeftRunning) {
    await runDocker([...baseArgsActive, "down", "-v", "--remove-orphans"], {
      cwd: workDir,
      env,
      timeoutMs: t.downMs,
    });
  } else {
    logParts.push(
      "=== Conteneurs laissés actifs ===\nArrêt manuel : Docker Desktop (Stop) ou docker compose -p " +
        projectName +
        " down dans le dossier temporaire du test."
    );
  }

  return finalizeResult({
    ok,
    phases,
    logParts,
    projectName,
    composeFile: mainComposeFile,
    patched,
    hardened: stack.hardened,
    timedOut: config.timedOut || build.timedOut || phases.up?.timedOut,
    exitCode: phases.up?.exitCode ?? build.exitCode ?? config.exitCode,
    accessLinks,
    containersLeftRunning,
    workDir,
    servicesReport: phases.up?.servicesReport || null,
    allServicesRunning: Boolean(phases.up?.allServicesRunning),
  });
}

function finalizeResult({
  ok,
  phases,
  logParts,
  projectName,
  composeFile,
  patched,
  hardened,
  timedOut,
  exitCode,
  accessLinks,
  containersLeftRunning,
  workDir,
  servicesReport,
  allServicesRunning,
}) {
  const combined = redactAbsolutePaths(logParts.join("\n"));
  const logDetail = combined.length > 24000 ? combined.slice(-24000) : combined;
  const stderr = !ok
    ? redactAbsolutePaths(
        [phases.config, phases.build, phases.up]
          .filter(Boolean)
          .map((p) => p.stderr)
          .filter(Boolean)
          .join("\n")
      )
    : "";
  return {
    ok,
    exitCode,
    timedOut: Boolean(timedOut),
    stdout: buildComposeSummary({
      ok,
      phases,
      projectName,
      suggestedDockerTests: null,
      accessLinks,
      containersLeftRunning,
      servicesReport,
    }),
    logDetail,
    stderr,
    projectName,
    composeFile,
    mode: "docker-compose-phased",
    portsPatched: patched,
    hardened: Boolean(hardened),
    phases,
    accessLinks: accessLinks || [],
    containersLeftRunning: Boolean(containersLeftRunning),
    workDir: workDir || null,
    servicesReport: servicesReport || null,
    allServicesRunning: Boolean(allServicesRunning),
  };
}
