import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDockerComposeChecklist } from "../utils/dockerComposeChecklist.js";

test("checklist OK pour compose à la racine", () => {
  const { ready, items } = buildDockerComposeChecklist({
    relativePaths: ["README.md", "docker-compose.yml", "backend/app.js"],
  });
  assert.equal(ready, true);
  const root = items.find((i) => i.id === "compose_root");
  assert.equal(root.status, "ok");
});

test("checklist échoue si compose uniquement en sous-dossier", () => {
  const { ready, blockingFail } = buildDockerComposeChecklist({
    relativePaths: ["app/docker-compose.yml"],
  });
  assert.equal(ready, false);
  assert.equal(blockingFail, true);
});

test("checklist GitHub OK quand API confirme la racine", () => {
  const { ready } = buildDockerComposeChecklist({
    isGithub: true,
    githubComposeOk: true,
  });
  assert.equal(ready, true);
});
