import {
  enqueueSandbox,
  enqueueOllama,
  getJobPublic,
  getQueueMode,
} from "../services/jobService.js";
import { checkOllamaAvailable } from "../services/ollamaService.js";
import Submission from "../models/Submission.js";

export async function getJobStatus(req, res) {
  try {
    const job = await getJobPublic(req.params.id);
    if (!job) return res.status(404).json({ message: "Tâche introuvable" });
    res.json(job);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function getQueueInfo(_req, res) {
  const ollama = await checkOllamaAvailable();
  res.json({
    mode: getQueueMode(),
    redis: getQueueMode() === "redis",
    ollama: { ok: ollama.ok, message: ollama.message || null },
    hint:
      getQueueMode() === "redis"
        ? "Jobs traités par BullMQ. Lancez « npm run worker » si QUEUE_RUN_WORKER_IN_API n’est pas true."
        : "File en mémoire (définissez REDIS_URL pour Redis/BullMQ).",
  });
}

export async function enqueueSandboxRun(req, res) {
  try {
    const { submissionId } = req.body || {};
    if (!submissionId) return res.status(400).json({ message: "submissionId requis" });

    const jobId = await enqueueSandbox(submissionId);

    res.status(202).json({
      message: "Test Docker mis en file d’attente",
      jobId,
      queue: getQueueMode(),
      statusUrl: `/api/jobs/${jobId}`,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function enqueueOllamaGrade(req, res) {
  try {
    const { submissionId } = req.body || {};
    if (!submissionId) return res.status(400).json({ message: "submissionId requis" });

    const sub = await Submission.findById(submissionId).select("_id");
    if (!sub) return res.status(404).json({ message: "Soumission introuvable" });

    const ollama = await checkOllamaAvailable();
    if (!ollama.ok) {
      return res.status(503).json({
        message:
          ollama.message ||
          "Ollama n’est pas disponible. Lancez Ollama localement (ollama serve).",
      });
    }

    const jobId = await enqueueOllama(submissionId);

    res.status(202).json({
      message: "Évaluation IA mise en file d’attente",
      jobId,
      queue: getQueueMode(),
      statusUrl: `/api/jobs/${jobId}`,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
