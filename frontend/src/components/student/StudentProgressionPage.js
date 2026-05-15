import React from "react";
import { Link } from "react-router-dom";
import { useStudentWorkspace } from "../../context/StudentWorkspaceContext";

export default function StudentProgressionPage() {
  const {
    loading,
    error,
    currentLevel,
    actionFeedback,
    selecting,
    activeAssignment,
    activeProjectId,
    projectsByLevel,
    chooseProject,
  } = useStudentWorkspace();

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

        {!loading && !error && (
          <section className="level-schema">
            <div className="level-schema__head">
              <h3 className="level-schema__title">Schéma des niveaux</h3>
              <span className="meta-chip">Prochain niveau accessible : {currentLevel} / 5</span>
            </div>
            <p className="diagram-item__meta" style={{ marginTop: 0, marginBottom: 12 }}>
              Validez chaque niveau dans l&apos;ordre (1, puis 2, etc.) : la validation du niveau{" "}
              <strong>{Math.max(1, currentLevel - 1)}</strong> débloque le choix d&apos;un projet de niveau{" "}
              <strong>{currentLevel}</strong>.
            </p>

            <div className="level-track">
              {[1, 2, 3, 4, 5].map((n) => {
                const isNext = n === currentLevel;
                const locked = n > currentLevel;
                const validated = n < currentLevel;
                return (
                  <div
                    key={n}
                    className={`level-track__item${
                      isNext
                        ? " level-track__item--current"
                        : locked
                          ? " level-track__item--locked"
                          : " level-track__item--done"
                    }`}
                  >
                    <span className="level-track__bubble">{n}</span>
                    <span className="level-track__label">
                      {validated ? "Validé" : isNext ? "À choisir" : "Verrouillé"}
                    </span>
                  </div>
                );
              })}
            </div>

            {actionFeedback.text && (
              <div className={`feedback${actionFeedback.ok ? " feedback--ok" : " feedback--err"}`}>
                {actionFeedback.text}
              </div>
            )}

            {activeAssignment && (
              <div className="level-schema__active">
                <p className="project-card__desc">
                  <span className="project-card__label">Projet en cours</span>
                  {activeAssignment.project?.title || "Projet"} (niveau {activeAssignment.niveau})
                </p>
                <p className="diagram-item__meta" style={{ marginTop: 8 }}>
                  <Link to="/student-dashboard/soumission" className="inline-link">
                    Soumission
                  </Link>
                </p>
              </div>
            )}

            <div className="level-schema__grid">
              {projectsByLevel.map(({ level, list }) => {
                const locked = level > currentLevel;
                const isNext = level === currentLevel;
                const validated = level < currentLevel;
                return (
                  <article
                    key={level}
                    className={`level-card${
                      isNext
                        ? " level-card--current"
                        : locked
                          ? " level-card--locked"
                          : " level-card--done"
                    }`}
                  >
                    <div className="level-card__head">
                      <h4 className="level-card__title">Niveau {level}</h4>
                      <span
                        className={
                          isNext
                            ? "status-pill status-pill--current"
                            : locked
                              ? "status-pill status-pill--locked"
                              : "status-pill status-pill--ok"
                        }
                      >
                        {validated ? "Validé" : isNext ? "À choisir" : "Verrouillé"}
                      </span>
                    </div>
                    {list.length === 0 && (
                      <p className="project-card__desc level-card__empty">
                        Aucun projet disponible à ce niveau.
                      </p>
                    )}
                    {list.map((project) => {
                      const isActive = activeProjectId && String(project._id) === activeProjectId;
                      const disabled =
                        locked || selecting || !!activeAssignment || project.isAssigned;
                      let buttonLabel = "Choisir ce projet";
                      if (locked) buttonLabel = "Verrouillé";
                      else if (selecting) buttonLabel = "Sélection...";
                      else if (isActive) buttonLabel = "En cours";
                      else if (!!activeAssignment) buttonLabel = "Projet en cours ailleurs";
                      else if (project.isAssigned) buttonLabel = "Déjà sélectionné";
                      return (
                        <div
                          key={project._id}
                          className={`level-project${isActive ? " level-project--active" : ""}`}
                        >
                          <p className="reference-box__text">
                            <strong>{project.title}</strong> (max {project.maxStudents})
                          </p>
                          {project.description && (
                            <p className="project-card__desc">{project.description}</p>
                          )}
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={disabled}
                            onClick={() => chooseProject(project._id)}
                          >
                            {buttonLabel}
                          </button>
                        </div>
                      );
                    })}
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
