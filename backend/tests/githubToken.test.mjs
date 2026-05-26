import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveGithubToken } from "../utils/githubToken.js";

test("resolveGithubToken ignore les placeholders", () => {
  const prev = process.env.GITHUB_TOKEN;
  try {
    process.env.GITHUB_TOKEN = "ghp_votre_token";
    assert.equal(resolveGithubToken(), null);
    process.env.GITHUB_TOKEN = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
    assert.ok(resolveGithubToken()?.startsWith("ghp_"));
  } finally {
    if (prev === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = prev;
  }
});
