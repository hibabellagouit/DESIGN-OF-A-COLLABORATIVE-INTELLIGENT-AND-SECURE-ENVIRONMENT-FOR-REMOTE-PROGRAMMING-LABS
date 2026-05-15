import React from "react";
import { Link } from "react-router-dom";
import { REFERENCE_KIND_LABELS } from "../../referenceLabels";
import CahierFichierSection from "../CahierFichierSection";
import { useStudentWorkspace } from "../../context/StudentWorkspaceContext";

function statusClass(status) {
  if (status === "validé") return "status-pill status-pill--ok";
  return "status-pill status-pill--pending";
}

export default function StudentMesProjetsPage() {
  const { loading, error, assignments } = useStudentWorkspace();

  return (
    <div className="layout-content">
      <div className="card card--elevated">
        {loading && (
          <div className="state-block state-block--muted">
            <span className="skeleton-line skeleton-line--long" />
            <span className="skeleton-line skeleton-line--short" />
          </div>
        )}
        {error && <div className="feedback feedback--err">{error}</div>}

        {!loading && !error && assignments.length === 0 && (
          <div className="empty-state">
            <p className="empty-state__title">Aucune affectation</p>
            <p className="empty-state__text">
              <Link to="/student-dashboard/progression" className="inline-link">
                Progression
              </Link>
            </p>
          </div>
        )}

        {!loading && !error && assignments.length > 0 && (
          <div className="project-card-list">
            {assignments.map((a) => {
              const kind = a.project?.referenceKind || "autre";
              const kindLabel = REFERENCE_KIND_LABELS[kind] || REFERENCE_KIND_LABELS.autre;
              return (
                <article key={a._id} className="project-card">
                  <div className="project-card__head">
                    <h3 className="project-card__title">{a.project?.title || "Projet"}</h3>
                    <span className={statusClass(a.status)}>{a.status}</span>
                  </div>
                  <div className="project-card__meta">
                    <span className="meta-chip">Niveau {a.niveau}</span>
                  </div>
                  {a.project?.description && (
                    <p className="project-card__desc">
                      <span className="project-card__label">Description</span>
                      {a.project.description}
                    </p>
                  )}
                  {a.project?.cahierDeCharge && (
                    <p className="project-card__desc">
                      <span className="project-card__label">Résumé CDC</span>
                      {a.project.cahierDeCharge}
                    </p>
                  )}
                  <CahierFichierSection project={a.project} />
                  {a.project?.referenceValidation && (
                    <div className="reference-box">
                      <span className="project-card__label">{kindLabel}</span>
                      <p className="reference-box__text">{a.project.referenceValidation}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
