import crypto from "crypto";
import Submission from "../../models/Submission.js";
import Project from "../../models/Project.js";
import { runSubmissionSandbox } from "../submissionSandboxService.js";
import { runAiPreliminaryGrade } from "../aiGradingService.js";
import { checkOllamaAvailable } from "../ollamaService.js";
import { submissionStatusForApi } from "../../utils/submissionStatus.js";
import {
  PROJECT_GRADE_MAX,
  PROJECT_GRADING_CRITERIA,
} from "../../utils/projectGradingRubric.js";

export async function handleSandboxJob(submissionId) {
  const out = await runSubmissionSandbox(submissionId);
  if (out.error && !out.result) {
    throw new Error(out.error);
  }
  return { ok: out.ok, result: out.result };
}

function mockOllamaGrade() {
  const rubricScores = {};
  for (const c of PROJECT_GRADING_CRITERIA) {
    rubricScores[c.id] = Math.floor(c.maxPoints / 2);
  }
  const gradeTotal = Object.values(rubricScores).reduce((s, n) => s + n, 0);
  return {
    rubricScores,
    gradeTotal,
    gradeComment: "Note mockée (tests d’intégration)",
    summary: "Évaluation simulée",
    model: "mock",
    evaluatedAt: new Date(),
  };
}

export async function handleOllamaJob(submissionId) {
  const sub = await Submission.findById(submissionId);
  if (!sub) throw new Error("Soumission introuvable");

  const project = await Project.findById(sub.project).lean();
  if (!project) throw new Error("Projet introuvable pour cette soumission.");

  let result;
  const started = Date.now();
  const requestId = crypto.randomUUID();

  if (process.env.INTEGRATION_TEST_MOCK_OLLAMA === "true") {
    result = mockOllamaGrade();
  } else {
    const ollama = await checkOllamaAvailable();
    if (!ollama.ok) {
      throw new Error(
        ollama.message ||
          "Ollama n’est pas disponible. Lancez Ollama (ollama serve) et vérifiez OLLAMA_BASE_URL."
      );
    }
    result = await runAiPreliminaryGrade(sub, project);
  }

  sub.aiRubricScores = result.rubricScores;
  sub.aiGradeTotal = result.gradeTotal;
  sub.aiGradeComment = result.gradeComment;
  sub.aiGradeSummary = result.summary;
  sub.aiEvaluatedAt = result.evaluatedAt;
  sub.aiModel = result.model;
  sub.aiGradeTrace = {
    requestId,
    durationMs: Date.now() - started,
    model: result.model,
    evaluatedAt: result.evaluatedAt,
    queue: process.env.REDIS_URL?.trim() ? "redis" : "memory",
  };

  const current = submissionStatusForApi(sub.status);
  if (current === "en attente") {
    sub.status = "en cours d'évaluation";
  }

  await sub.save();

  return {
    message: `Note préliminaire IA : ${result.gradeTotal}/${PROJECT_GRADE_MAX}`,
    preliminary: {
      rubricScores: result.rubricScores,
      gradeTotal: result.gradeTotal,
      gradeComment: result.gradeComment,
      summary: result.summary,
      model: result.model,
      evaluatedAt: result.evaluatedAt,
    },
    submission: sub.toObject(),
  };
}
