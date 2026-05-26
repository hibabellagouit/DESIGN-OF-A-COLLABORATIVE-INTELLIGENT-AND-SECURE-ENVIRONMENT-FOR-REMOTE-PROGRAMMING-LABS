import React, { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../apiBase";
import { apiErrorMessage, authHeaders } from "../authStorage";
import { emitToast } from "../toastBus";
import { useGradingResources } from "../context/GradingResourcesContext";
import { pollJobUntilDone } from "../utils/pollJob";

const CRITERION_LABELS = {
  cahier_charges: "Cahier des charges",
  fonctionnalite: "Fonctionnalités",
  qualite_code: "Qualité du code",
  docker_tests: "Docker & tests",
  documentation: "Documentation",
};

export default function SubmissionAiGradePanel({ submission, onAiGraded, onApplyPreliminary }) {
  const { ollamaStatus } = useGradingResources();
  const ollamaOk = ollamaStatus;
  const [busy, setBusy] = useState(false);

  const runAiGrade = useCallback(async () => {
    const sid = submission?._id;
    if (!sid || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/jobs/ollama`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ submissionId: sid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiErrorMessage(data, res, "Évaluation IA impossible"));

      let result = data;
      if (res.status === 202 && data.jobId) {
        emitToast({
          title: "Ollama",
          message: "Analyse en cours…",
          variant: "info",
        });
        const job = await pollJobUntilDone(data.jobId);
        result = job.result || {};
      }

      emitToast({
        title: "Ollama",
        message: result.message || "Note préliminaire calculée.",
      });
      onAiGraded?.(result.submission, result.preliminary);
    } catch (e) {
      emitToast({ title: "Ollama", message: e.message || "Erreur", variant: "error" });
    } finally {
      setBusy(false);
    }
  }, [submission, busy, onAiGraded]);

  const aiTotal = submission?.aiGradeTotal;
  const hasAi =
    aiTotal != null && Number.isFinite(Number(aiTotal)) && submission?.aiEvaluatedAt;
  const aiScores = submission?.aiRubricScores || {};

  return React.createElement(
    "div",
    {
      style: {
        marginTop: 10,
        padding: "0.65rem 0.85rem",
        border: "1px dashed var(--stroke-subtle, #cbd5e1)",
        borderRadius: 8,
        background: "#f0f9ff",
      },
    },
    React.createElement("h5", { className: "group-subheading", style: { marginTop: 0 } }, "Évaluation automatique (Ollama)"),
    React.createElement(
      "p",
      { className: "diagram-item__meta", style: { marginTop: 0 } },
      "Génère une ",
      React.createElement("strong", null, "note préliminaire"),
      " selon le barème /20. L’enseignant valide ensuite la note définitive."
    ),
    ollamaOk === null
      ? React.createElement("p", { className: "diagram-card-head__hint" }, "Vérification d’Ollama…")
      : ollamaOk.ok
        ? React.createElement(
            "p",
            { className: "diagram-item__meta", style: { color: "#0d9488" } },
            "Ollama disponible",
            submission?.aiModel ? ` · modèle : ${submission.aiModel}` : ""
          )
        : React.createElement(
            "div",
            { className: "feedback feedback--err", style: { marginTop: 8 } },
            ollamaOk.message ||
              "Ollama injoignable. Lancez « ollama serve » et installez un modèle (ex. ollama pull llama3.2)."
          ),
    hasAi
      ? React.createElement(
          "div",
          { style: { marginTop: 10 } },
          React.createElement(
            "p",
            { className: "diagram-item__meta" },
            React.createElement("strong", null, `Préliminaire : ${aiTotal}/20`),
            submission.aiEvaluatedAt
              ? ` · ${new Date(submission.aiEvaluatedAt).toLocaleString()}`
              : ""
          ),
          submission.aiGradeSummary
            ? React.createElement("p", { className: "diagram-item__meta" }, submission.aiGradeSummary)
            : null,
          React.createElement(
            "ul",
            { style: { margin: "8px 0", paddingLeft: 18, fontSize: "0.85rem" } },
            Object.entries(aiScores).map(([id, pts]) =>
              React.createElement(
                "li",
                { key: id },
                `${CRITERION_LABELS[id] || id} : `,
                React.createElement("strong", null, String(pts))
              )
            )
          ),
          submission.aiGradeComment
            ? React.createElement(
                "p",
                { className: "diagram-item__meta" },
                React.createElement("em", null, "Commentaire IA :"),
                ` ${submission.aiGradeComment}`
              )
            : null,
          onApplyPreliminary
            ? React.createElement(
                "button",
                {
                  type: "button",
                  className: "btn btn-outline btn-sm",
                  style: { marginTop: 8 },
                  onClick: () => onApplyPreliminary(submission),
                },
                "Appliquer au formulaire de notation"
              )
            : null
        )
      : null,
    React.createElement(
      "button",
      {
        type: "button",
        className: "btn btn-secondary btn-sm",
        style: { marginTop: 10 },
        disabled: busy || ollamaOk?.ok === false,
        onClick: runAiGrade,
      },
      busy ? "Analyse Ollama…" : hasAi ? "Recalculer la note préliminaire" : "Lancer l’évaluation IA"
    )
  );
}
