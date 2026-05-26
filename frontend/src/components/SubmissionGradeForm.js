import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../apiBase";
import { apiErrorMessage, authHeaders } from "../authStorage";
import { emitToast } from "../toastBus";
import SubmissionAiGradePanel from "./SubmissionAiGradePanel";
import { useGradingResources } from "../context/GradingResourcesContext";

const FALLBACK_RUBRIC = {
  maxTotal: 20,
  criteria: [
    { id: "cahier_charges", label: "Respect du cahier des charges", maxPoints: 6 },
    { id: "fonctionnalite", label: "Fonctionnalités et complétude", maxPoints: 5 },
    { id: "qualite_code", label: "Qualité du code", maxPoints: 4 },
    { id: "docker_tests", label: "Docker & tests", maxPoints: 3 },
    { id: "documentation", label: "Documentation", maxPoints: 2 },
  ],
};

function initialScoresFromSubmission(submission, criteria) {
  const existing = submission?.rubricScores || {};
  const out = {};
  for (const c of criteria) {
    const v = existing[c.id];
    out[c.id] = v != null && v !== "" ? String(v) : "";
  }
  return out;
}

export default function SubmissionGradeForm({ submission: submissionProp, onGraded, compact = false }) {
  const [submission, setSubmission] = useState(submissionProp);
  const { rubric: sharedRubric } = useGradingResources();
  const rubric = sharedRubric?.criteria?.length ? sharedRubric : FALLBACK_RUBRIC;
  const [scores, setScores] = useState({});
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSubmission(submissionProp);
  }, [submissionProp]);

  const criteria = useMemo(() => rubric.criteria || FALLBACK_RUBRIC.criteria, [rubric]);
  const maxTotal = rubric.maxTotal || 20;

  useEffect(() => {
    setScores(initialScoresFromSubmission(submission, criteria));
    setComment(String(submission?.gradeComment || "").trim());
  }, [submission, criteria]);

  const computedTotal = useMemo(() => {
    let sum = 0;
    for (const c of criteria) {
      const n = Number(scores[c.id]);
      if (Number.isFinite(n)) sum += Math.max(0, Math.min(c.maxPoints, n));
    }
    return Math.round(sum * 100) / 100;
  }, [scores, criteria]);

  const allFilled = useMemo(
    () => criteria.every((c) => scores[c.id] !== "" && Number.isFinite(Number(scores[c.id]))),
    [criteria, scores]
  );

  const submit = useCallback(
    async (e) => {
      e.preventDefault();
      const sid = submission?._id;
      if (!sid || busy) return;
      if (!allFilled) {
        emitToast({
          title: "Notation",
          message: "Renseignez tous les critères du barème.",
          variant: "error",
        });
        return;
      }
      const rubricScores = {};
      for (const c of criteria) {
        rubricScores[c.id] = Number(scores[c.id]);
      }
      setBusy(true);
      try {
        const res = await fetch(`${API_BASE}/api/submissions/${sid}/grade`, {
          method: "PATCH",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            rubricScores,
            gradeComment: comment,
            markEvaluated: true,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(apiErrorMessage(data, res, "Enregistrement impossible"));
        emitToast({
          title: "Notation",
          message: data.message || "Note enregistrée.",
        });
        onGraded?.(data.submission);
      } catch (err) {
        emitToast({ title: "Notation", message: err.message || "Erreur", variant: "error" });
      } finally {
        setBusy(false);
      }
    },
    [submission, busy, allFilled, criteria, scores, comment, onGraded]
  );

  if (!submission?._id) return null;

  const alreadyGraded = submission.gradeTotal != null && Number.isFinite(Number(submission.gradeTotal));

  const applyPreliminary = (sub) => {
    const ai = sub?.aiRubricScores || {};
    const next = {};
    for (const c of criteria) {
      const v = ai[c.id];
      next[c.id] = v != null && v !== "" ? String(v) : "";
    }
    setScores(next);
    if (sub?.aiGradeComment) setComment(String(sub.aiGradeComment));
    emitToast({
      title: "Ollama",
      message: "Note préliminaire copiée dans le formulaire — vérifiez puis enregistrez.",
    });
  };

  return (
    <>
    <SubmissionAiGradePanel
      submission={submission}
      onAiGraded={(updated) => {
        setSubmission(updated);
        onGraded?.(updated);
      }}
      onApplyPreliminary={applyPreliminary}
    />
    <form
      className="submission-grade-form"
      onSubmit={submit}
      style={{
        marginTop: compact ? 8 : 12,
        padding: compact ? "0.5rem 0.65rem" : "0.75rem 0.85rem",
        border: "1px solid var(--stroke-subtle, #e2e8f0)",
        borderRadius: 8,
        background: "var(--surface-raised, #f8fafc)",
      }}
    >
      <header className="submission-grade-form__head">
        <h5 className="group-subheading" style={{ margin: 0 }}>
          Notation individuelle (/20)
        </h5>
        {!compact ? (
          <p className="diagram-item__meta" style={{ marginTop: 6, marginBottom: 0 }}>
            Barème officiel — chaque critère a un plafond. Le total sur {maxTotal} est calculé
            automatiquement.
          </p>
        ) : null}
      </header>
      {submission?.sandboxResult?.suggestedDockerTests != null ? (
        <p className="diagram-item__meta" style={{ marginTop: 0, marginBottom: 8 }}>
          Test Docker auto : suggestion{" "}
          <strong>{submission.sandboxResult.suggestedDockerTests}/3</strong> pour « Docker &amp; tests »
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ marginLeft: 8 }}
            onClick={() =>
              setScores((prev) => ({
                ...prev,
                docker_tests: String(submission.sandboxResult.suggestedDockerTests),
              }))
            }
          >
            Appliquer
          </button>
        </p>
      ) : null}
      <div className="submission-grade-form__grid">
        {criteria.map((c) => (
          <label key={c.id} className="submission-grade-form__row">
            <span className="submission-grade-form__label">
              {c.label}
              <span className="diagram-item__meta"> / {c.maxPoints}</span>
            </span>
            <input
              type="number"
              className="form-input"
              min={0}
              max={c.maxPoints}
              step={0.5}
              value={scores[c.id] ?? ""}
              onChange={(e) => setScores((prev) => ({ ...prev, [c.id]: e.target.value }))}
              disabled={busy}
              required
            />
          </label>
        ))}
      </div>
      <label className="form-label" style={{ marginTop: 10 }}>
        Commentaire (optionnel)
      </label>
      <textarea
        className="form-textarea form-input--full"
        rows={compact ? 2 : 3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        disabled={busy}
        placeholder="Retour sur le travail remis par cet étudiant…"
        maxLength={2000}
      />
      <p className="diagram-item__meta" style={{ marginTop: 10, marginBottom: 0 }}>
        <strong>
          Total : {computedTotal}/{maxTotal}
        </strong>
        {alreadyGraded && submission.note ? <span> · enregistré : {submission.note}</span> : null}
      </p>
      <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: 10 }} disabled={busy}>
        {busy ? "Enregistrement…" : "Enregistrer la note individuelle"}
      </button>
    </form>
    </>
  );
}
