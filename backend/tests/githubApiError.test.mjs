import test from "node:test";
import assert from "node:assert/strict";
import { formatGithubApiError } from "../utils/githubApiError.js";

test("formatGithubApiError détecte la page timeout GitHub", () => {
  const html = "<!DOCTYPE html><html><p>We couldn't respond to your request in time.</p></html>";
  const { message, status } = formatGithubApiError(html, 503);
  assert.match(message, /n’a pas répondu/i);
  assert.equal(status, 503);
});

test("formatGithubApiError parse le JSON GitHub", () => {
  const { message } = formatGithubApiError('{"message":"Not Found"}', 404);
  assert.equal(message, "Not Found");
});
