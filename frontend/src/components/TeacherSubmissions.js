import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../apiBase";
import { apiErrorMessage, authHeaders } from "../authStorage";
import { emitToast } from "../toastBus";
import {
  displaySubmissionStatus,
  submissionStatusLabel,
  submissionStatusPillClass,
} from "../submissionStatusUi";
import SubmissionGradeForm from "./SubmissionGradeForm";

function readToken() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}")?.token || "";
  } catch {
    return "";
  }
}

function formatSize(n) {
  const v = Number(n) || 0;
  if (v < 1024) return `${v} o`;
  if (v < 1024 * 1024) return `${Math.round(v / 1024)} Ko`;
  return `${(v / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function TeacherSubmissions({ refreshKey = 0 }) {
  const [assignments, setAssignments] = useState([]);
  const [assignmentId, setAssignmentId] = useState("");
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [error, setError] = useState("");
  const [statusBusyId, setStatusBusyId] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/api/assignments`, { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error("Impossible de charger les affectations");
        return r.json();
      })
      .then((data) => setAssignments(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const selectedAssignment = useMemo(
    () => assignments.find((a) => String(a._id) === String(assignmentId)),
    [assignments, assignmentId]
  );

  const reloadSubs = useCallback(() => {
    if (!assignmentId) {
      setSubmissions([]);
      return Promise.resolve();
    }
    setLoadingSubs(true);
    setError("");
    return fetch(`${API_BASE}/api/submissions/assignment/${assignmentId}`, {
      headers: authHeaders(),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Impossible de charger les soumissions");
        return r.json();
      })
      .then((data) => setSubmissions(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoadingSubs(false));
  }, [assignmentId]);

  useEffect(() => {
    reloadSubs();
  }, [reloadSubs]);

  const patchStatus = useCallback(
    async (submissionId, status) => {
      const sid = String(submissionId || "");
      if (!sid || statusBusyId) return;
      setStatusBusyId(sid);
      try {
        const res = await fetch(`${API_BASE}/api/submissions/${sid}/status`, {
          method: "PATCH",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ status }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(apiErrorMessage(data, res, "Mise à jour impossible"));
        emitToast({ title: "Statut", message: "Soumission mise à jour." });
        await reloadSubs();
      } catch (e) {
        emitToast({ title: "Statut", message: e.message || "Erreur", variant: "error" });
      } finally {
        setStatusBusyId("");
      }
    },
    [statusBusyId, reloadSubs]
  );

  const token = readToken();

  return (
    <section className="card card--elevated">
      <div className="section-intro" style={{ marginBottom: 14 }}>
        <h2 className="section-intro__title">Soumissions</h2>
      </div>

      {error && <div className="feedback feedback--err">{error}</div>}

      <div className="panel panel--wide" style={{ marginTop: 0 }}>
        <div className="panel__body">
          <label className="form-label">Affectation</label>
          <select
            className="form-select form-input--full"
            value={assignmentId}
            onChange={(e) => setAssignmentId(e.target.value)}
            disabled={loading}
          >
            <option value="">{loading ? "Chargement..." : "— Choisir une affectation —"}</option>
            {assignments.map((a) => (
              <option key={a._id} value={a._id}>
                {(a.project?.title || "Projet")} — Niveau {a.niveau} — {a.status}
              </option>
            ))}
          </select>

          {selectedAssignment ? (
            <p className="diagram-item__meta" style={{ marginTop: 10 }}>
              {selectedAssignment.students?.length || 0} étudiant(s)
            </p>
          ) : null}
        </div>
      </div>

      {assignmentId && (
        <div style={{ marginTop: 14 }}>
          {loadingSubs && (
            <div className="state-block state-block--muted">
              <span className="skeleton-line skeleton-line--long" />
              <span className="skeleton-line skeleton-line--short" />
            </div>
          )}

          {!loadingSubs && submissions.length === 0 && (
            <div className="empty-state">
              <p className="empty-state__title">Aucune soumission</p>
              <p className="empty-state__text">
                Les étudiants n’ont pas encore envoyé de fichier ni de lien GitHub pour cette affectation.
              </p>
            </div>
          )}

          {!loadingSubs && submissions.length > 0 && (
            <div className="project-card-list">
              {submissions.map((s) => {
                const studentName = s.student?.name || s.student?.email || "Étudiant";
                const when = s.createdAt ? new Date(s.createdAt).toLocaleString() : "";
                const isGithub = (s.kind || "file") === "github" && s.githubUrl;
                const projectFiles = Array.isArray(s.projectFiles) ? s.projectFiles : [];
                const isBundle = Boolean(s.bundleId) && projectFiles.length > 0 && !isGithub;
                const nFiles = projectFiles.length;
                const fileUrl = `${API_BASE}/api/submissions/${s._id}/file?download=1&token=${encodeURIComponent(
                  token
                )}`;
                const st = displaySubmissionStatus(s.status);
                const busy = statusBusyId === String(s._id);
                return (
                  <article key={s._id} className="project-card">
                    <div className="project-card__head">
                      <h3 className="project-card__title">{studentName}</h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        <span className={submissionStatusPillClass(s.status)}>{submissionStatusLabel(s.status)}</span>
                        <span className="meta-chip">{when}</span>
                      </div>
                    </div>
                    <p className="project-card__desc">
                      <span className="project-card__label">
                        {isGithub ? "Lien" : isBundle ? "Projet" : "Fichier"}
                      </span>
                      {isGithub ? (
                        <span style={{ wordBreak: "break-all" }}>{s.githubUrl}</span>
                      ) : isBundle ? (
                        <>
                          {s.fileOriginalName}
                          {nFiles > 1 ? ` · ${nFiles} fichiers` : ""} · {formatSize(s.fileSize)}
                        </>
                      ) : (
                        <>
                          {s.fileOriginalName} · {formatSize(s.fileSize)}
                        </>
                      )}
                    </p>
                    {s.note ? (
                      <p className="diagram-item__meta" style={{ marginTop: 6 }}>
                        <span className="project-card__label">Note</span> {s.note}
                      </p>
                    ) : null}
                    <SubmissionGradeForm submission={s} onGraded={() => reloadSubs()} compact />
                    <div className="cdc-actions" style={{ flexWrap: "wrap", gap: 8 }}>
                      {isGithub ? (
                        <a
                          className="btn btn-primary btn-sm"
                          href={s.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Ouvrir sur GitHub
                        </a>
                      ) : (
                        <a className="btn btn-primary btn-sm" href={fileUrl}>
                          {isBundle && nFiles > 1 ? "Télécharger le projet (ZIP)" : "Télécharger"}
                        </a>
                      )}
                      {st === "en attente" ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            disabled={busy}
                            onClick={() => patchStatus(s._id, "en cours d'évaluation")}
                          >
                            En cours d’évaluation
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={busy}
                            onClick={() => patchStatus(s._id, "évalué")}
                          >
                            Évalué
                          </button>
                        </>
                      ) : null}
                      {st === "en cours d'évaluation" ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busy}
                          onClick={() => patchStatus(s._id, "évalué")}
                        >
                          Marquer évalué
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
