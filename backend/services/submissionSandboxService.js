import Submission from "../models/Submission.js";
import { prepareSubmissionWorkspace } from "../utils/submissionWorkspace.js";
import { prepareGithubSubmissionWorkspace } from "./githubRepoClone.js";
import fs from "fs";
import path from "path";
import { runDockerCompose, tearDownComposeProject } from "./dockerComposeRunner.js";
import {
  HARDENING_FILENAME,
  PUBLISH_PORTS_FILENAME,
} from "../utils/sandboxComposeHarden.js";
import { PROJECT_GRADING_CRITERIA } from "../utils/projectGradingRubric.js";
import {
  isPortBindConflict,
  composeBuildLikelySucceeded,
} from "../utils/sandboxComposePatch.js";
import { buildComposeSummary } from "../utils/composeLogSummary.js";
import { refreshAccessLinksForProject } from "../utils/sandboxAccessLinks.js";

const DOCKER_CRITERION = PROJECT_GRADING_CRITERIA.find((c) => c.id === "docker_tests");
const DOCKER_MAX = DOCKER_CRITERION?.maxPoints ?? 3;

function suggestDockerTestsPoints(sandboxResult) {
  if (!sandboxResult) return null;
  const phases = sandboxResult.phases;
  if (phases && typeof phases === "object") {
    if (phases.security && phases.security.ok === false) return 0;
    let pts = 0;
    if (phases.config?.ok) pts += 1;
    if (phases.build?.ok) pts += 1;
    if (phases.up?.skipped || phases.up?.ok) pts += 1;
    if (phases.up?.servicesReport && !phases.up.servicesReport.allRunning && pts >= 2) {
      pts = Math.max(1, pts - 1);
    }
    return Math.min(DOCKER_MAX, pts);
  }
  if (sandboxResult.ok) return DOCKER_MAX;
  if (sandboxResult.timedOut) return Math.max(0, Math.floor(DOCKER_MAX / 2));
  if (
    isPortBindConflict(sandboxResult.stderr, sandboxResult.stdout) &&
    composeBuildLikelySucceeded(sandboxResult.stderr, sandboxResult.stdout)
  ) {
    return Math.max(1, DOCKER_MAX - 1);
  }
  if (composeBuildLikelySucceeded(sandboxResult.stderr, sandboxResult.stdout)) {
    return Math.max(1, Math.floor(DOCKER_MAX / 2));
  }
  return 0;
}

function resolveSandboxComposeFiles(sandboxResult) {
  const main = sandboxResult?.composeFile || "docker-compose.yml";
  const files = [main];
  const workDir = sandboxResult?.workDir;
  if (workDir) {
    const hardeningPath = path.join(workDir, HARDENING_FILENAME);
    if (fs.existsSync(hardeningPath)) files.push(HARDENING_FILENAME);
    const publishPath = path.join(workDir, PUBLISH_PORTS_FILENAME);
    if (fs.existsSync(publishPath)) files.push(PUBLISH_PORTS_FILENAME);
  }
  return files;
}

/** Re-détecte les ports publiés pour un sandbox déjà démarré (Docker Desktop). */
export async function refreshSubmissionSandboxLinks(submissionId) {
  const sub = await Submission.findById(submissionId);
  if (!sub) throw new Error("Soumission introuvable");

  const sr = sub.sandboxResult;
  if (!sr?.projectName) {
    return { ok: false, message: "Aucun projet sandbox — lancez d’abord « Tester (compose) »." };
  }

  const composeFiles = resolveSandboxComposeFiles(sr);
  const composeArgs = composeFiles.flatMap((f) => ["-f", f]);
  const serviceNames = sr.servicesReport?.expected || [];

  const accessLinks = await refreshAccessLinksForProject(sr.projectName, {
    workDir: sr.workDir || null,
    composeArgs,
    env: { COMPOSE_PROJECT_NAME: sr.projectName },
    serviceNames,
  });

  sub.sandboxResult = {
    ...sr,
    accessLinks,
    containersLeftRunning: accessLinks.length > 0 || Boolean(sr.containersLeftRunning),
  };
  sub.markModified("sandboxResult");
  await sub.save();

  return {
    ok: true,
    accessLinks,
    message:
      accessLinks.length > 0
        ? `${accessLinks.length} lien(s) d’accès mis à jour.`
        : "Aucun port publié détecté — vérifiez que frontend/backend exposent des ports dans docker-compose, puis relancez le test.",
  };
}

/** Arrête les conteneurs Docker laissés actifs après un test compose. */
export async function stopSubmissionSandbox(submissionId) {
  const sub = await Submission.findById(submissionId);
  if (!sub) throw new Error("Soumission introuvable");

  const sr = sub.sandboxResult;
  if (!sr?.projectName) {
    return { ok: false, message: "Aucun projet sandbox enregistré pour cette soumission." };
  }

  await tearDownComposeProject({
    workDir: sr.workDir || null,
    projectName: sr.projectName,
    composeFiles: resolveSandboxComposeFiles(sr),
  });

  sub.sandboxResult = {
    ...sr,
    containersLeftRunning: false,
    accessLinks: [],
  };
  sub.markModified("sandboxResult");
  await sub.save();

  return { ok: true, message: "Conteneurs sandbox arrêtés.", projectName: sr.projectName };
}

export function prepareSubmissionWorkspaceAny(sub) {
  if ((sub.kind || "file") === "github" && sub.githubUrl) {
    return prepareGithubSubmissionWorkspace(sub.githubUrl);
  }
  return Promise.resolve(prepareSubmissionWorkspace(sub));
}

/**
 * Lance Docker Compose pour une soumission et enregistre le résultat.
 */
export async function runSubmissionSandbox(submissionId) {
  if (process.env.INTEGRATION_TEST_MOCK_SANDBOX === "true") {
    const sub = await Submission.findById(submissionId);
    if (!sub) throw new Error("Soumission introuvable");
    const result = {
      ok: true,
      phases: {
        config: { ok: true },
        build: { ok: true },
        up: { skipped: true },
      },
      stdout: "Sandbox mocké (tests d’intégration)",
    };
    sub.sandboxOk = true;
    sub.sandboxRanAt = new Date();
    sub.sandboxLastError = "";
    sub.sandboxResult = result;
    await sub.save();
    return { ok: true, result };
  }

  const sub = await Submission.findById(submissionId);
  if (!sub) throw new Error("Soumission introuvable");

  let workspace;
  try {
    workspace = await prepareSubmissionWorkspaceAny(sub);
  } catch (e) {
    const errMsg = e.message || "Impossible de préparer le projet.";
    sub.sandboxLastError = errMsg;
    sub.sandboxRanAt = new Date();
    sub.sandboxOk = false;
    await sub.save();
    return { ok: false, error: errMsg };
  }

  const { workDir, composeFilePath, cleanup } = workspace;
  const prev = sub.sandboxResult;
  if (prev?.projectName) {
    await tearDownComposeProject({
      workDir: prev.workDir || null,
      projectName: prev.projectName,
      composeFiles: resolveSandboxComposeFiles(prev),
    });
  }
  let containersLeftRunning = false;
  try {
    const result = await runDockerCompose({ workDir, composeFilePath });
    containersLeftRunning = Boolean(result.containersLeftRunning);
    const suggestedDockerTests = suggestDockerTestsPoints(result);
    const summary = buildComposeSummary({
      ok: result.ok,
      phases: result.phases,
      projectName: result.projectName,
      suggestedDockerTests,
      accessLinks: result.accessLinks,
      containersLeftRunning: result.containersLeftRunning,
    });
    sub.sandboxResult = {
      ok: result.ok,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      stdout: summary,
      logDetail: result.logDetail,
      stderr: result.stderr,
      projectName: result.projectName,
      composeFile: result.composeFile,
      mode: result.mode,
      hardened: Boolean(result.hardened),
      phases: result.phases,
      suggestedDockerTests,
      accessLinks: result.accessLinks || [],
      containersLeftRunning: Boolean(result.containersLeftRunning),
      workDir: result.containersLeftRunning ? result.workDir : null,
      portsPatched: result.portsPatched,
      servicesReport: result.servicesReport || null,
      allServicesRunning: Boolean(result.allServicesRunning),
    };
    sub.sandboxOk = Boolean(result.ok);
    if (result.ok) {
      sub.sandboxLastError = "";
    } else if (result.timedOut) {
      sub.sandboxLastError = "Délai dépassé";
    } else if (isPortBindConflict(result.stderr, result.stdout)) {
      sub.sandboxLastError =
        "Conflit de port sur la machine du serveur (ex. 3000 déjà utilisé). Les images ont pu être construites ; le test utilise des ports dynamiques lors des prochains essais.";
    } else {
      sub.sandboxLastError = "Échec docker compose";
    }
    sub.sandboxRanAt = new Date();
    await sub.save();
    return { ok: result.ok, result: sub.sandboxResult };
  } finally {
    if (!containersLeftRunning) {
      cleanup();
    }
  }
}

/** Lance le sandbox en arrière-plan (ne bloque pas la réponse HTTP). */
export function scheduleSubmissionSandbox(submissionId) {
  if (process.env.SANDBOX_AUTO_ON_SUBMIT !== "true") return;
  setImmediate(() => {
    runSubmissionSandbox(submissionId).catch((e) => {
      console.error("scheduleSubmissionSandbox", submissionId, e.message);
    });
  });
}
