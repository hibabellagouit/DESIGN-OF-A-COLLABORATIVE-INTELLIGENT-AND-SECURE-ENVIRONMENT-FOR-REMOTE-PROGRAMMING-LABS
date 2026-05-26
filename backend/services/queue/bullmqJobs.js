import { Queue, Worker } from "bullmq";
import {
  getRedisConnection,
  isRedisConfigured,
  pingRedis,
  getResolvedQueueBackend,
} from "../../config/redis.js";
import { handleSandboxJob, handleOllamaJob } from "./jobHandlers.js";

const QUEUE_NAME = "tp-jobs";

let queue;
let worker;

function mapBullState(state) {
  switch (state) {
    case "waiting":
    case "waiting-children":
    case "delayed":
    case "prioritized":
      return "pending";
    case "active":
      return "running";
    case "completed":
      return "done";
    case "failed":
      return "failed";
    default:
      return state;
  }
}

export function getJobsQueue() {
  if (!queue) {
    const connection = getRedisConnection();
    if (!connection) throw new Error("REDIS_URL non configuré");
    queue = new Queue(QUEUE_NAME, { connection });
  }
  return queue;
}

export async function enqueueBullJob(type, data) {
  const job = await getJobsQueue().add(type, data, {
    removeOnComplete: { age: 3600, count: 500 },
    removeOnFail: { age: 86400, count: 200 },
    attempts: 1,
  });
  return String(job.id);
}

export async function getBullJobPublic(jobId) {
  const job = await getJobsQueue().getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  const status = mapBullState(state);

  return {
    id: String(job.id),
    type: job.name,
    status,
    createdAt: job.timestamp,
    updatedAt: job.finishedOn || job.processedOn || job.timestamp,
    result: status === "done" ? job.returnvalue : undefined,
    error: status === "failed" ? job.failedReason || "Erreur" : undefined,
    queueBackend: "redis",
  };
}

export function startBullWorkers() {
  if (worker) return worker;

  const connection = getRedisConnection();
  if (!connection) {
    throw new Error("Impossible de démarrer le worker : REDIS_URL manquant");
  }

  const concurrency = Math.max(1, Number(process.env.QUEUE_CONCURRENCY) || 2);

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === "sandbox") {
        return handleSandboxJob(job.data.submissionId);
      }
      if (job.name === "ollama") {
        return handleOllamaJob(job.data.submissionId);
      }
      throw new Error(`Type de tâche inconnu : ${job.name}`);
    },
    { connection, concurrency }
  );

  worker.on("failed", (job, err) => {
    console.error(`[worker] job ${job?.id} (${job?.name})`, err?.message || err);
  });

  worker.on("completed", (job) => {
    console.log(`[worker] job ${job.id} (${job.name}) terminé`);
  });

  console.log(`[worker] BullMQ actif (concurrency=${concurrency})`);
  return worker;
}

export async function closeBullQueues() {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
}

export { isRedisConfigured, pingRedis, getResolvedQueueBackend };
