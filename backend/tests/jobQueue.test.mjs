import { test } from "node:test";
import assert from "node:assert/strict";
import { createJob, getJob } from "../services/jobQueue.js";

test("jobQueue exécute et termine un job", async () => {
  const id = createJob("test", async () => ({ ok: true }));
  assert.ok(id);
  await new Promise((r) => setTimeout(r, 80));
  const job = getJob(id);
  assert.ok(job);
  assert.equal(job.status, "done");
  assert.deepEqual(job.result, { ok: true });
});

test("jobQueue enregistre une erreur", async () => {
  const id = createJob("fail", async () => {
    throw new Error("boom");
  });
  await new Promise((r) => setTimeout(r, 80));
  const job = getJob(id);
  assert.equal(job.status, "failed");
  assert.equal(job.error, "boom");
});
