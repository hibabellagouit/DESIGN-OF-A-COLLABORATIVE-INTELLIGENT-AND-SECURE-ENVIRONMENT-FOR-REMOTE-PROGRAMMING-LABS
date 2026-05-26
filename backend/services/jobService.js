import { createJob, getJob, publicJobView } from "./jobQueue.js";
import {
  enqueueBullJob,
  getBullJobPublic,
  startBullWorkers,
} from "./queue/bullmqJobs.js";
import {
  resolveQueueBackend,
  getResolvedQueueBackend,
  forceMemoryQueueBackend,
} from "../config/redis.js";
import { handleSandboxJob, handleOllamaJob } from "./queue/jobHandlers.js";

export function getQueueMode() {
  return getResolvedQueueBackend();
}

let embeddedWorkerStarted = false;

/** Démarre le worker BullMQ dans le process API si Redis est joignable. */
export function maybeStartEmbeddedWorker() {
  if (getResolvedQueueBackend() !== "redis") return;
  if (process.env.QUEUE_RUN_WORKER_IN_API !== "true") return;
  if (embeddedWorkerStarted) return;
  startBullWorkers();
  embeddedWorkerStarted = true;
}

async function enqueueWithFallback(type, submissionId) {
  const mode = getResolvedQueueBackend();
  if (mode === "redis") {
    try {
      return await enqueueBullJob(type, { submissionId: String(submissionId) });
    } catch (e) {
      console.warn(`[queue] BullMQ indisponible (${e.message}) — bascule mémoire`);
      forceMemoryQueueBackend();
    }
  }
  const runner =
    type === "sandbox"
      ? () => handleSandboxJob(submissionId)
      : () => handleOllamaJob(submissionId);
  return createJob(type, runner);
}

export async function enqueueSandbox(submissionId) {
  await resolveQueueBackend();
  return enqueueWithFallback("sandbox", submissionId);
}

export async function enqueueOllama(submissionId) {
  await resolveQueueBackend();
  return enqueueWithFallback("ollama", submissionId);
}

export async function getJobPublic(jobId) {
  if (getResolvedQueueBackend() === "redis") {
    const bull = await getBullJobPublic(jobId);
    if (bull) return bull;
  }
  return publicJobView(getJob(jobId));
}

export { resolveQueueBackend };
