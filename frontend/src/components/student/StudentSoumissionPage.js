import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../../apiBase";
import { authHeaders } from "../../authStorage";
import { useStudentWorkspace } from "../../context/StudentWorkspaceContext";
import { submissionStatusLabel, submissionStatusPillClass } from "../../submissionStatusUi";

function filesFromInput(fileList) {
  return Array.from(fileList || []);
}

export default function StudentSoumissionPage() {
  const {
    loading,
    error,
    activeAssignment,
    studentId,
    submissionFiles,
    setSubmissionFiles,
    submissionMode,
    setSubmissionMode,
    submissionGithubUrl,
    setSubmissionGithubUrl,
    uploading,
    uploadFeedback,
    submitWork,
    submissionHistoryTick,
  } = useStudentWorkspace();

  const [assignmentSubs, setAssignmentSubs] = useState([]);

  useEffect(() => {
    if (!activeAssignment?._id || !studentId) {
      setAssignmentSubs([]);
      return;
    }
    let cancelled = false;
    fetch(`${API_BASE}/api/submissions/student/${encodeURIComponent(studentId)}`, {
      headers: authHeaders(),
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((arr) => {
        if (cancelled) return;
        const aid = String(activeAssignment._id);
        const mine = (Array.isArray(arr) ? arr : []).filter((s) => String(s.assignment) === aid);
        mine.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setAssignmentSubs(mine);
      })
      .catch(() => {
        if (!cancelled) setAssignmentSubs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeAssignment, studentId, submissionHistoryTick]);

  const canSubmit =
    submissionMode === "file"
      ? submissionFiles.length > 0
      : Boolean(String(submissionGithubUrl || "").trim());

  return (
    <div className="layout-content">
      <div className="card card--elevated card--section-gap">
        <div className="section-intro">
          <h2 className="section-intro__title">Soumission</h2>
        </div>

        {loading && (
          <div className="state-block state-block--muted">
            <span className="skeleton-line skeleton-line--long" />
          </div>
        )}
        {error && <div className="feedback feedback--err">{error}</div>}

        {!loading && !error && !activeAssignment && (
          <div className="empty-state">
            <p className="empty-state__title">Aucun projet en cours</p>
            <p className="empty-state__text">
              <Link to="/student-dashboard/progression" className="inline-link">
                Progression
              </Link>
            </p>
          </div>
        )}

        {!loading && !error && activeAssignment && (
          <>
            <form
              className="reference-box"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (!uploading && canSubmit) submitWork();
              }}
            >
              <span className="project-card__label">Projet en cours</span>
              <p className="project-card__desc" style={{ marginTop: 6 }}>
                {activeAssignment.project?.title || "Projet"} — niveau {activeAssignment.niveau}
              </p>
              {uploadFeedback.text && (
                <div
                  className={`feedback${uploadFeedback.ok ? " feedback--ok" : " feedback--err"}`}
                  style={{ marginTop: 12 }}
                >
                  {uploadFeedback.text}
                </div>
              )}
              <div className="form-field" style={{ marginTop: 12 }}>
                <span className="form-label">Type de dépôt</span>
                <div className="cdc-actions" style={{ marginTop: 6, flexWrap: "wrap", gap: 8 }}>
                  <label className="diagram-item__meta" style={{ cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="depot"
                      checked={submissionMode === "file"}
                      onChange={() => {
                        setSubmissionMode("file");
                        setSubmissionGithubUrl("");
                      }}
                    />{" "}
                    Projet sur cet ordinateur (fichiers ou dossier)
                  </label>
                  <label className="diagram-item__meta" style={{ cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="depot"
                      checked={submissionMode === "github"}
                      onChange={() => {
                        setSubmissionMode("github");
                        setSubmissionFiles([]);
                      }}
                    />{" "}
                    Lien GitHub
                  </label>
                </div>
              </div>
              {submissionMode === "file" ? (
                <>
                  <label className="form-label" style={{ marginTop: 12, display: "block" }}>
                    Fichiers du projet (plusieurs à la fois : Ctrl ou Maj + clic)
                  </label>
                  <input
                    className="form-input form-input--file form-input--full"
                    type="file"
                    multiple
                    style={{ marginTop: 6 }}
                    onChange={(e) => setSubmissionFiles(filesFromInput(e.target.files))}
                  />
                  <label className="form-label" style={{ marginTop: 14, display: "block" }}>
                    Ou dossier entier
                  </label>
                  <input
                    className="form-input form-input--file form-input--full"
                    type="file"
                    multiple
                    style={{ marginTop: 6 }}
                    ref={(el) => {
                      if (el && !el.getAttribute("webkitdirectory")) {
                        el.setAttribute("webkitdirectory", "");
                      }
                    }}
                    onChange={(e) => setSubmissionFiles(filesFromInput(e.target.files))}
                  />
                  <p className="diagram-item__meta" style={{ marginTop: 8 }}>
                    Vous pouvez aussi envoyer une archive <strong>.zip</strong> en un seul fichier. Maximum
                    120 fichiers par envoi ; types courants (code, config, images) acceptés.
                  </p>
                  {submissionFiles.length > 0 ? (
                    <p className="diagram-item__meta" style={{ marginTop: 6 }}>
                      <strong>{submissionFiles.length}</strong> fichier
                      {submissionFiles.length > 1 ? "s" : ""} sélectionné
                      {submissionFiles.length > 1 ? "s" : ""}.
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <label className="form-label" style={{ marginTop: 12, display: "block" }}>
                    URL du dépôt (https://github.com/… ou gist)
                  </label>
                  <input
                    className="form-input form-input--full"
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="https://github.com/org/projet ou …/projet.git"
                    value={submissionGithubUrl}
                    onChange={(e) => setSubmissionGithubUrl(e.target.value)}
                  />
                  <p className="diagram-item__meta" style={{ marginTop: 6 }}>
                    Envoyez soit des fichiers / un dossier ici, soit un seul lien public — pas les deux.
                  </p>
                </>
              )}
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                style={{ marginTop: 12 }}
                disabled={uploading || !canSubmit}
              >
                {uploading ? "Envoi..." : "Soumettre"}
              </button>
            </form>

            <div className="reference-box" style={{ marginTop: 16 }}>
              <span className="project-card__label">Suivi des envois (ce projet)</span>
              <p className="diagram-item__meta" style={{ marginTop: 6 }}>
                Statuts : <strong>en attente</strong> (reçu), <strong>en cours d&apos;évaluation</strong>,
                <strong> évalué</strong>.
              </p>
              {assignmentSubs.length === 0 ? (
                <p className="diagram-item__meta" style={{ marginTop: 8 }}>
                  Aucun envoi enregistré pour cette affectation.
                </p>
              ) : (
                <ul className="diagram-item__meta" style={{ marginTop: 10, paddingLeft: 18 }}>
                  {assignmentSubs.map((s) => {
                    const when = s.createdAt ? new Date(s.createdAt).toLocaleString() : "";
                    const label =
                      s.kind === "github" && s.githubUrl
                        ? "Lien GitHub"
                        : s.fileOriginalName || "Dépôt";
                    return (
                      <li key={s._id} style={{ marginBottom: 8 }}>
                        <span className={submissionStatusPillClass(s.status)} style={{ marginRight: 8 }}>
                          {submissionStatusLabel(s.status)}
                        </span>
                        {when} — {label}
                        {s.note ? (
                          <span>
                            {" "}
                            · <em>Note enseignant</em> : {s.note}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
