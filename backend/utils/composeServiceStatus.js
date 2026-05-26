/**
 * État des services après `docker compose ps -a`.
 */

import { parseComposePsRows } from "./composeLogSummary.js";

function serviceFromRow(row) {
  if (row.Service) return String(row.Service);
  const name = String(row.Name || "");
  const parts = name.split("-");
  if (parts.length >= 3 && /^\d+$/.test(parts[parts.length - 1])) {
    return parts.slice(1, -1).join("-") || parts[parts.length - 2];
  }
  return name.replace(/-\d+$/, "") || "service";
}

function stateFromRow(row) {
  const state = String(row.State || row.Status || "").toLowerCase();
  if (/running|up\b|healthy/.test(state)) return "running";
  if (/exited|dead|stopped/.test(state)) return "exited";
  if (/restarting|starting|created/.test(state)) return "starting";
  return state || "unknown";
}

/**
 * @param {string} psAllStdout - sortie de `docker compose ps -a --format json`
 * @param {string[]} expectedServices - noms des services du compose
 */
export function buildServicesReport(psAllStdout, expectedServices) {
  const expected = [...new Set((expectedServices || []).filter(Boolean))];
  const rows = parseComposePsRows(psAllStdout);
  const byService = new Map();

  for (const row of rows) {
    const service = serviceFromRow(row);
    const state = stateFromRow(row);
    const prev = byService.get(service);
    if (!prev || state === "running") {
      byService.set(service, {
        service,
        state,
        status: String(row.Status || row.State || "").trim(),
        name: String(row.Name || "").trim(),
      });
    }
  }

  const running = [];
  const notRunning = [];

  for (const svc of expected) {
    const info = byService.get(svc);
    if (info && info.state === "running") {
      running.push(svc);
    } else {
      notRunning.push({
        service: svc,
        state: info?.state || "absent",
        status: info?.status || "Conteneur non démarré ou introuvable",
        name: info?.name || "",
      });
    }
  }

  return {
    expected,
    running,
    notRunning,
    allRunning: expected.length > 0 && notRunning.length === 0,
    runningCount: running.length,
    expectedCount: expected.length,
  };
}

/**
 * Récupère les dernières lignes de logs pour un service arrêté.
 */
export async function fetchServiceLogTail(runDocker, { workDir, composeArgs, projectName, env, service }) {
  const withProject = projectName ? [...composeArgs, "-p", projectName] : composeArgs;
  const res = await runDocker(
    ["compose", ...withProject, "logs", "--tail", "25", "--no-color", service],
    { cwd: workDir, env, timeoutMs: 12000 }
  );
  if (!res.ok) return "";
  const text = String(res.stdout || "") + String(res.stderr || "");
  return text.trim().slice(-4000);
}

export async function enrichServicesReportWithLogs(
  report,
  runDocker,
  { workDir, composeArgs, projectName, env }
) {
  if (!report?.notRunning?.length) return report;
  const enriched = [];
  for (const item of report.notRunning) {
    const logTail = await fetchServiceLogTail(runDocker, {
      workDir,
      composeArgs,
      projectName,
      env,
      service: item.service,
    });
    enriched.push({ ...item, logTail: logTail || undefined });
  }
  return { ...report, notRunning: enriched };
}
