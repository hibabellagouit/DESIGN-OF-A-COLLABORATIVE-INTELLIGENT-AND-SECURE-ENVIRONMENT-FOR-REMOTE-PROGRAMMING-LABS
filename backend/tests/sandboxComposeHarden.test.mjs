import test from "node:test";
import assert from "node:assert/strict";
import {
  auditComposeConfig,
  buildHardeningOverrideYaml,
  isSandboxHardeningEnabled,
} from "../utils/sandboxComposeHarden.js";

test("auditComposeConfig refuse docker.sock et privileged", () => {
  const bad = `
services:
  evil:
    privileged: true
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
`;
  const audit = auditComposeConfig(bad);
  assert.equal(audit.ok, false);
  assert.ok(audit.violations.length >= 2);
});

test("auditComposeConfig accepte un compose minimal", () => {
  const ok = `
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
`;
  assert.equal(auditComposeConfig(ok).ok, true);
});

test("buildHardeningOverrideYaml ajoute limites par service", () => {
  const yaml = buildHardeningOverrideYaml(["backend", "frontend"]);
  assert.match(yaml, /sandbox_isolated/);
  assert.match(yaml, /backend:/);
  assert.match(yaml, /cap_drop:\s*\n\s+- NET_ADMIN/);
  assert.doesNotMatch(yaml, /cap_drop:\s*\n\s+- ALL/);
  assert.match(yaml, /var\/cache\/nginx/);
  assert.match(yaml, /mem_limit: 512m/);
});

test("isSandboxHardeningEnabled respecte SANDBOX_COMPOSE_HARDEN=false", () => {
  const prev = process.env.SANDBOX_COMPOSE_HARDEN;
  process.env.SANDBOX_COMPOSE_HARDEN = "false";
  assert.equal(isSandboxHardeningEnabled(), false);
  if (prev === undefined) delete process.env.SANDBOX_COMPOSE_HARDEN;
  else process.env.SANDBOX_COMPOSE_HARDEN = prev;
});
