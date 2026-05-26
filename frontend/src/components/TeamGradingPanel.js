import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../apiBase";
import { apiErrorMessage, authHeaders } from "../authStorage";
import { emitToast } from "../toastBus";
import { useGradingResources } from "../context/GradingResourcesContext";
import { mongoIdString } from "../mongoIdString";

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

function initialScoresFromTeam(assignment, criteria) {
  const existing = assignment?.teamRubricScores || {};
  const out = {};
  for (const c of criteria) {
    const v = existing[c.id];
    out[c.id] = v != null && v !== "" ? String(v) : "";
  }
  return out;
}

function computeTotal(scores, criteria) {
  let sum = 0;
  for (const c of criteria) {
    const n = Number(scores[c.id]);
    if (Number.isFinite(n)) sum += Math.max(0, Math.min(c.maxPoints, n));
  }
  return Math.round(sum * 100) / 100;
}

function TeamGradesSummary({ assignment, students }) {
  const finals = assignment?.memberFinalGrades || {};
  const teamTotal = assignment?.teamGradeTotal;
  if (teamTotal == null) return null;

  return (
    <div className="team-grades-summary">
      <p className="diagram-item__meta" style={{ marginTop: 0 }}>
        Note d&apos;équipe enregistrée : <strong>{teamTotal}/20</strong> (50 %). Les notes individuelles
        incluent 50 % de participation GitHub (commits).
      </p>
      <div style={{ overflowX: "auto", marginTop: 10 }}>
        <table className="ranking-table">
          <thead>
            <tr>
              <th>Étudiant</th>
              <th className="num">Commits</th>
              <th className="num">Part équipe (/10)</th>
              <th className="num">Part commits (/10)</th>
              <th className="num">Final /20</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const sid = mongoIdString(s._id);
              const f = finals[sid] || {};
              return (
                <tr key={sid}>
                  <td>{s.name || s.email || "—"}</td>
                  <td className="num">{f.commits ?? 0}</td>
                  <td className="num">{f.teamHalfScore ?? "—"}</td>
                  <td className="num">{f.commitHalfScore ?? "—"}</td>
                  <td className="num">
                    <strong>{f.finalTotal ?? "—"}</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Note unique pour l’équipe ; répartition automatique 50 % commits par membre. */
export default function TeamGradingPanel({ assignment, students, hasSubmission, validated, onGraded }) {
  const { rubric: sharedRubric } = useGradingResources();
  const rubric = sharedRubric?.criteria?.length ? sharedRubric : FALLBACK_RUBRIC;
  const criteria = rubric.criteria || FALLBACK_RUBRIC.criteria;
  const maxTotal = rubric.maxTotal || 20;
  const aid = mongoIdString(assignment?._id);

  const [scores, setScores] = useState({});
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setScores(initialScoresFromTeam(assignment, criteria));
    setComment(String(assignment?.teamGradeComment || "").trim());
  }, [assignment, criteria]);

  const computedTotal = useMemo(() => computeTotal(scores, criteria), [scores, criteria]);
  const allFilled = useMemo(
    () => criteria.every((c) => scores[c.id] !== "" && Number.isFinite(Number(scores[c.id]))),
    [criteria, scores]
  );

  const submit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!aid || busy || !allFilled) {
        if (!allFilled) {
          emitToast({
            title: "Notation",
            message: "Renseignez tous les critères du barème pour l’équipe.",
            variant: "error",
          });
        }
        return;
      }
      const rubricScores = {};
      for (const c of criteria) rubricScores[c.id] = Number(scores[c.id]);
      setBusy(true);
      try {
        const res = await fetch(`${API_BASE}/api/assignments/${aid}/grade-team`, {
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
        emitToast({ title: "Notation équipe", message: data.message || "Note enregistrée." });
        onGraded?.(data.assignment);
      } catch (err) {
        const hint =
          err.message === "Failed to fetch"
            ? "Serveur injoignable — vérifiez que le backend tourne (port 5000) et redémarrez-le après mise à jour."
            : err.message || "Erreur";
        emitToast({ title: "Notation", message: hint, variant: "error" });
      } finally {
        setBusy(false);
      }
    },
    [aid, busy, allFilled, criteria, scores, comment, onGraded]
  );

  if (validated) {
    if (assignment?.teamGradeTotal == null) {
      return null;
    }
    return (
      <section className="group-grading-panel group-grading-panel--done">
        <h5 className="group-subheading">Récapitulatif des notes</h5>
        <TeamGradesSummary assignment={assignment} students={students} />
      </section>
    );
  }

  if (!hasSubmission) {
    return (
      <p className="diagram-card-head__hint" style={{ marginTop: "0.75rem" }}>
        En attente du premier dépôt (fichier ou GitHub) pour noter l&apos;équipe.
      </p>
    );
  }

  const alreadyGraded = assignment?.teamGradeTotal != null;

  return (
    <section className="group-grading-panel">
      <header className="group-grading-panel__head">
        <h5 className="group-subheading">Notation de l&apos;équipe (/20)</h5>
        <p className="diagram-item__meta" style={{ marginTop: 4 }}>
          Vous attribuez <strong>une seule note</strong> pour toute l&apos;équipe (50 % de la note finale).
          L&apos;autre moitié (50 %) est calculée automatiquement selon la <strong>participation GitHub</strong>{" "}
          (nombre de commits par étudiant). Chaque membre obtient ainsi une note finale différente.
        </p>
      </header>

      {alreadyGraded ? (
        <TeamGradesSummary assignment={assignment} students={students} />
      ) : null}

      <form onSubmit={submit} className="submission-grade-form" style={{ marginTop: alreadyGraded ? 12 : 0 }}>
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
          Commentaire pour l&apos;équipe (optionnel)
        </label>
        <textarea
          className="form-textarea form-input--full"
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={busy}
          maxLength={2000}
        />
        <p className="diagram-item__meta" style={{ marginTop: 10 }}>
          <strong>Note d&apos;équipe : {computedTotal}/{maxTotal}</strong> → répartie à 10 pts max par membre
          + jusqu&apos;à 10 pts selon les commits.
        </p>
        <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: 10 }} disabled={busy}>
          {busy ? "Calcul…" : alreadyGraded ? "Mettre à jour la note d’équipe" : "Enregistrer et calculer les notes"}
        </button>
      </form>
    </section>
  );
}
