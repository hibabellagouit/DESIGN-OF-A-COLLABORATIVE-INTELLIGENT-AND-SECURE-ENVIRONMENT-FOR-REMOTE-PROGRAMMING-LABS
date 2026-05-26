import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useStudentWorkspace } from "../../context/StudentWorkspaceContext";
import TeamInfoCard from "../TeamInfoCard";
import ProjectDetailModal from "../ProjectDetailModal";

export default function StudentProgressionPage() {
  const {
    loading,
    error,
    noTeam,
    team,
    currentLevel,
    actionFeedback,
    selecting,
    activeAssignment,
    activeProjectId,
    projectsByLevel,
    chooseProject,
  } = useStudentWorkspace();

  const [detailProject, setDetailProject] = useState(null);

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
            <div className="level-schema__intro">
              <p>
                Votre équipe choisit un projet pour chaque niveau. Les niveaux doivent être validés dans
                l&apos;ordre (niveau 1, puis niveau 2, etc.). La validation d&apos;un niveau débloque
                automatiquement l&apos;accès au niveau suivant.
              </p>
            </div>
            {team?.name ? (
              <div style={{ marginBottom: 12 }}>
                <TeamInfoCard team={team} />
              </div>
            ) : null}
            {noTeam ? (
              <div className="feedback feedback--err" style={{ marginBottom: 12 }}>
                Vous devez appartenir à une équipe. Demandez à votre enseignant de vous inscrire dans une
                équipe avant de choisir un projet.
              </div>
            ) : null}

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
                    Aller à la soumission
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
                      const full = (project.teamsAvailable ?? 1) <= 0;
                      const disabled =
                        noTeam ||
                        locked ||
                        selecting ||
                        !!activeAssignment ||
                        project.isAssigned ||
                        full;
                      let buttonLabel = "Choisir pour l’équipe";
                      if (noTeam) buttonLabel = "Sans équipe";
                      else if (locked) buttonLabel = "Verrouillé";
                      else if (selecting) buttonLabel = "Sélection…";
                      else if (isActive) buttonLabel = "En cours";
                      else if (!!activeAssignment) buttonLabel = "Projet en cours ailleurs";
                      else if (project.isAssigned) buttonLabel = "Déjà choisi";
                      else if (full) buttonLabel = "Complet";
                      return (
                        <div
                          key={project._id}
                          className={`level-project${isActive ? " level-project--active" : ""}`}
                        >
                          <button
                            type="button"
                            className="level-project__title-btn"
                            onClick={() => setDetailProject(project)}
                          >
                            <strong>{project.title}</strong>
                          </button>
                          <p className="diagram-item__meta" style={{ marginTop: 4 }}>
                            {typeof project.teamsAvailable === "number" ? (
                              <>
                                {project.teamsAvailable} place{project.teamsAvailable > 1 ? "s" : ""}{" "}
                                équipe{project.teamsAvailable > 1 ? "s" : ""}
                                {project.maxTeams ? ` / ${project.maxTeams}` : ""}
                              </>
                            ) : (
                              <>Max. {project.maxStudents} équipes</>
                            )}
                          </p>
                          {project.description ? (
                            <p className="project-card__desc level-project__excerpt">
                              {project.description.length > 120
                                ? `${project.description.slice(0, 118)}…`
                                : project.description}
                            </p>
                          ) : null}
                          <div className="level-project__actions">
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => setDetailProject(project)}
                            >
                              Voir le détail
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={disabled}
                              onClick={() => chooseProject(project._id)}
                            >
                              {buttonLabel}
                            </button>
                          </div>
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

      <ProjectDetailModal
        project={detailProject}
        isOpen={Boolean(detailProject)}
        onClose={() => setDetailProject(null)}
        footer={
          detailProject && !noTeam && detailProject._id ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={
                selecting ||
                !!activeAssignment ||
                detailProject.isAssigned ||
                (detailProject.teamsAvailable ?? 1) <= 0 ||
                (detailProject.niveau ?? 1) > currentLevel
              }
              onClick={() => {
                chooseProject(detailProject._id);
                setDetailProject(null);
              }}
            >
              Choisir ce projet pour l&apos;équipe
            </button>
          ) : null
        }
      />
    </div>
  );
}
