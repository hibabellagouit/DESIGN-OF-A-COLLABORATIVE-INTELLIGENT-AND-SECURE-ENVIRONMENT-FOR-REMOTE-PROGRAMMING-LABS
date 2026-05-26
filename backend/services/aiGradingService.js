import {
  PROJECT_GRADING_CRITERIA,
  PROJECT_GRADE_MAX,
  validateRubricScoresForGrade,
  computeGradeTotal,
} from "../utils/projectGradingRubric.js";
import { ollamaChatJson, getOllamaConfig } from "./ollamaService.js";
import { buildSubmissionAiContext } from "../utils/submissionAiContext.js";

function buildSystemPrompt() {
  const criteriaLines = PROJECT_GRADING_CRITERIA.map(
    (c) => `- ${c.id} : ${c.label} (max ${c.maxPoints} pts) — ${c.description}`
  ).join("\n");

  return `Tu es un assistant pédagogique pour l'évaluation de projets étudiants.
Tu dois attribuer une note PRÉLIMINAIRE selon le barème /${PROJECT_GRADE_MAX} suivant :
${criteriaLines}

Réponds UNIQUEMENT en JSON valide (sans markdown) avec cette structure exacte :
{
  "rubricScores": {
    "cahier_charges": <nombre 0-max>,
    "fonctionnalite": <nombre>,
    "qualite_code": <nombre>,
    "docker_tests": <nombre>,
    "documentation": <nombre>
  },
  "comment": "<feedback constructif pour l'étudiant, 2-4 phrases>",
  "summary": "<synthèse courte pour l'enseignant, 1-2 phrases>"
}

Règles :
- Respecte strictement le maximum de chaque critère.
- Sois exigeant mais juste ; en cas de doute, note légèrement en dessous.
- Si le contexte est insuffisant (ex. dépôt GitHub sans code), note prudemment et explique-le dans comment.
- Les nombres peuvent avoir une demi-point (ex. 3.5).`;
}

export function parseAiGradingJson(raw) {
  const text = String(raw || "").trim();
  if (!text) throw new Error("Réponse Ollama vide");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      parsed = JSON.parse(text.slice(start, end + 1));
    } else {
      throw new Error("Réponse Ollama non JSON");
    }
  }
  const rubricScores = parsed.rubricScores || parsed.scores || parsed.criteria || {};
  const validation = validateRubricScoresForGrade(rubricScores, { requireAll: true });
  if (!validation.ok) {
    throw new Error(validation.message || "Barème IA invalide");
  }
  return {
    rubricScores: validation.scores,
    gradeTotal: validation.total,
    gradeComment: String(parsed.comment || parsed.feedback || "").trim().slice(0, 2000),
    summary: String(parsed.summary || "").trim().slice(0, 1000),
  };
}

/**
 * Évalue une soumission via Ollama et retourne la note préliminaire.
 */
export async function runAiPreliminaryGrade(sub, project) {
  const ctx = buildSubmissionAiContext(sub, project);
  const userPrompt = `Évalue ce projet étudiant et produis la note préliminaire JSON.

${ctx.promptText}`;

  const { content, model } = await ollamaChatJson({
    system: buildSystemPrompt(),
    user: userPrompt,
  });

  const graded = parseAiGradingJson(content);
  return {
    ...graded,
    model: model || getOllamaConfig().model,
    evaluatedAt: new Date(),
    contextBytes: ctx.promptText.length,
    fileSnippetCount: ctx.fileSnippets?.length ?? 0,
  };
}

export { computeGradeTotal, PROJECT_GRADE_MAX };
