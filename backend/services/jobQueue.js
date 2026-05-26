import crypto from "crypto";

const jobs = new Map();
const MAX_JOBS = 200;
const TTL_MS = 60 * 60 * 1000;

function prune() {
  if (jobs.size <= MAX_JOBS) return;
  const now = Date.now();
  for (const [id, j] of jobs) {
    if (now - j.createdAt > TTL_MS) jobs.delete(id);
  }
}

export function createJob(type, runner) {
  prune();
  const id = crypto.randomUUID();
  const job = {
    id,
    type,
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    result: null,
    error: null,
  };
  jobs.set(id, job);

  setImmediate(async () => {
    job.status = "running";
    job.updatedAt = Date.now();
    try {
      job.result = await runner();
      job.status = "done";
    } catch (e) {
      job.status = "failed";
      job.error = e.message || "Erreur";
    }
    job.updatedAt = Date.now();
  });

  return id;
}

export function getJob(id) {
  return jobs.get(id) || null;
}

export function publicJobView(job) {
  if (!job) return null;
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    result: job.status === "done" ? job.result : undefined,
    error: job.status === "failed" ? job.error : undefined,
  };
}
