/**
 * Valide le cycle sandbox : compose up → liens d’accès → refresh → arrêt.
 * Usage : node scripts/validate-sandbox-cycle.mjs
 * Prérequis : Docker Desktop démarré.
 */
import fs from "fs";
import path from "path";
import os from "os";
import assert from "node:assert/strict";
import { runDockerCompose, tearDownComposeProject } from "../services/dockerComposeRunner.js";
import { refreshAccessLinksForProject } from "../utils/sandboxAccessLinks.js";
import { runDockerCommand } from "../utils/dockerRun.js";
import {
  HARDENING_FILENAME,
  PUBLISH_PORTS_FILENAME,
} from "../utils/sandboxComposeHarden.js";

process.env.SANDBOX_NETWORK_INTERNAL = "false";
process.env.SANDBOX_KEEP_CONTAINERS_UP = "true";
process.env.SANDBOX_COMPOSE_MODE = "balanced";
process.env.COMPOSE_WAIT_AFTER_UP_MS = "8000";

const SAMPLE_COMPOSE = `services:
  frontend:
    image: nginx:alpine
    expose:
      - "80"
  backend:
    image: traefik/whoami
    expose:
      - "80"
`;

function listComposeFilesInDir(workDir) {
  const files = ["docker-compose.yml"];
  for (const name of [HARDENING_FILENAME, PUBLISH_PORTS_FILENAME]) {
    if (fs.existsSync(path.join(workDir, name))) files.push(name);
  }
  return files;
}

async function containersForProject(projectName) {
  const res = await runDockerCommand(
    [
      "ps",
      "-a",
      "--filter",
      `label=com.docker.compose.project=${projectName}`,
      "--format",
      "{{.Names}}",
    ],
    { timeoutMs: 10000 }
  );
  return res.stdout.trim().split(/\r?\n/).filter(Boolean);
}

async function main() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "sandbox-validate-"));
  const composePath = path.join(workDir, "docker-compose.yml");
  fs.writeFileSync(composePath, SAMPLE_COMPOSE, "utf8");

  console.log("1/4 Test compose (build + up)…");
  console.log("    Dossier :", workDir);

  const result = await runDockerCompose({ workDir, composeFilePath: composePath });

  assert.equal(result.ok, true, `compose devrait réussir : ${result.stderr || result.stdout}`);
  assert.equal(
    result.containersLeftRunning,
    true,
    "conteneurs doivent rester actifs (SANDBOX_KEEP_CONTAINERS_UP)"
  );
  assert.ok(
    result.accessLinks?.length >= 1,
    `au moins 1 lien attendu, reçu : ${JSON.stringify(result.accessLinks)}`
  );

  console.log("    Projet  :", result.projectName);
  console.log("    Liens   :");
  for (const link of result.accessLinks) {
    console.log(`      - ${link.service} → ${link.url}`);
  }

  const running = await containersForProject(result.projectName);
  assert.ok(running.length >= 2, `conteneurs attendus, trouvés : ${running.join(", ")}`);

  console.log("2/4 Refresh des liens…");
  const composeFiles = listComposeFilesInDir(workDir);
  const composeArgs = composeFiles.flatMap((f) => ["-f", f]);
  const refreshed = await refreshAccessLinksForProject(result.projectName, {
    workDir,
    composeArgs,
    env: { COMPOSE_PROJECT_NAME: result.projectName },
    serviceNames: ["frontend", "backend"],
  });
  assert.ok(
    refreshed.length >= 1,
    `refresh doit retrouver des ports : ${JSON.stringify(refreshed)}`
  );
  console.log("    Liens après refresh :", refreshed.map((l) => l.url).join(", "));

  console.log("3/4 Arrêt sandbox (compose down)…");
  await tearDownComposeProject({
    workDir,
    projectName: result.projectName,
    composeFiles,
  });

  await new Promise((r) => setTimeout(r, 2000));
  const after = await containersForProject(result.projectName);
  assert.equal(after.length, 0, `conteneurs encore présents : ${after.join(", ")}`);

  console.log("4/4 Nettoyage dossier temporaire…");
  fs.rmSync(workDir, { recursive: true, force: true });

  console.log("\n✓ Cycle sandbox validé : test → liens → refresh → arrêt.\n");
}

main().catch((e) => {
  console.error("\n✗ Échec validation sandbox :\n", e.message || e);
  process.exit(1);
});
