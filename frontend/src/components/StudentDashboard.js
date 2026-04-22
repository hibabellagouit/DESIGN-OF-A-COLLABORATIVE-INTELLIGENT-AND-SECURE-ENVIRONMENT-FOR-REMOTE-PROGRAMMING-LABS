import React, { useEffect, useState } from "react";
import { API_BASE } from "../apiBase";
import { REFERENCE_KIND_LABELS } from "../referenceLabels";

function CahierFichierSection({ project }) {
  if (!project?._id || !project?.cahierFileStoredName) return null;

  const viewUrl = `${API_BASE}/api/projects/${project._id}/cdc`;
  const downloadUrl = `${viewUrl}?download=1`;
  const isPdf = (project.cahierFileMimeType || "").includes("pdf");

  return (
    <div className="cdc-block">
      <h4 className="cdc-block__title">Cahier des charges (fichier)</h4>
      <p className="cdc-block__filename">
        {project.cahierFileOriginalName || "Document joint"}
      </p>
      <div className="cdc-actions">
        <a
          className="btn btn-outline btn-sm"
          href={viewUrl}
          target="_blank"
          rel="noreferrer"
        >
          Ouvrir
        </a>
        <a className="btn btn-primary btn-sm" href={downloadUrl}>
          Télécharger
        </a>
      </div>
      {isPdf && (
        <iframe
          title={`Aperçu — ${project.title || "cahier des charges"}`}
          className="cdc-iframe"
          src={viewUrl}
        />
      )}
    </div>
  );
}

function statusClass(status) {
  if (status === "validé") return "status-pill status-pill--ok";
  return "status-pill status-pill--pending";
}

const StudentDashboard = () => {
  const [assignments, setAssignments] = useState([]);
  const [selectableProjects, setSelectableProjects] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFeedback, setActionFeedback] = useState({ ok: true, text: "" });
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) {
      setLoading(false);
      setError("Session invalide");
      return;
    }
    let user;
    try {
      user = JSON.parse(raw);
    } catch {
      setLoading(false);
      setError("Session invalide");
      return;
    }
    const studentId = user.student?._id;
    if (!studentId) {
      setLoading(false);
      setError("Session invalide");
      return;
    }

    Promise.all([
      fetch(`${API_BASE}/api/assignments/student/${studentId}`).then((res) => {
        if (!res.ok) throw new Error("Impossible de charger vos projets");
        return res.json();
      }),
      fetch(`${API_BASE}/api/assignments/student/${studentId}/selectable-projects`).then(
        (res) => {
          if (!res.ok) throw new Error("Impossible de charger le schéma des niveaux");
          return res.json();
        }
      ),
    ])
      .then(([assignmentData, selectionData]) => {
        setAssignments(assignmentData);
        setSelectableProjects(selectionData.projects || []);
        setCurrentLevel(selectionData.currentLevel || 1);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const userRaw = localStorage.getItem("user");
  let studentId = "";
  try {
    studentId = JSON.parse(userRaw || "{}")?.student?._id || "";
  } catch {
    studentId = "";
  }

  const activeAssignment = assignments.find((a) => a.status === "en cours");

  const chooseProject = async (projectId) => {
    setActionFeedback({ ok: true, text: "" });
    setSelecting(true);
    try {
      if (!studentId) throw new Error("Session invalide");
      const res = await fetch(`${API_BASE}/api/assignments/student/select-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error);
      setActionFeedback({
        ok: true,
        text: "Projet sélectionné. Terminez-le pour débloquer le niveau suivant.",
      });

      const [assignmentData, selectionData] = await Promise.all([
        fetch(`${API_BASE}/api/assignments/student/${studentId}`).then((r) => r.json()),
        fetch(`${API_BASE}/api/assignments/student/${studentId}/selectable-projects`).then(
          (r) => r.json()
        ),
      ]);
      setAssignments(assignmentData);
      setSelectableProjects(selectionData.projects || []);
      setCurrentLevel(selectionData.currentLevel || 1);
    } catch (err) {
      setActionFeedback({ ok: false, text: err.message });
    } finally {
      setSelecting(false);
    }
  };

  const projectsByLevel = [1, 2, 3, 4, 5].map((level) => ({
    level,
    list: selectableProjects.filter((p) => Number(p.niveau) === level),
  }));

  const activeProjectId = activeAssignment?.project?._id
    ? String(activeAssignment.project._id)
    : "";

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
              <span className="meta-chip">Niveau débloqué : {currentLevel} / 5</span>
            </div>

            <div className="level-track">
              {[1, 2, 3, 4, 5].map((n) => {
                const isCurrent = n === currentLevel;
                const locked = n > currentLevel;
                return (
                  <div
                    key={n}
                    className={`level-track__item${
                      isCurrent
                        ? " level-track__item--current"
                        : locked
                        ? " level-track__item--locked"
                        : " level-track__item--done"
                    }`}
                  >
                    <span className="level-track__bubble">{n}</span>
                    <span className="level-track__label">
                      {isCurrent ? "Actuel" : locked ? "Verrouillé" : "Débloqué"}
                    </span>
                  </div>
                );
              })}
            </div>

            {actionFeedback.text && (
              <div
                className={`feedback${actionFeedback.ok ? " feedback--ok" : " feedback--err"}`}
              >
                {actionFeedback.text}
              </div>
            )}
            {activeAssignment && (
              <p className="project-card__desc level-schema__active">
                <span className="project-card__label">Projet en cours</span>
                {activeAssignment.project?.title || "Projet"} (niveau {activeAssignment.niveau}) —
                validez pour débloquer le niveau suivant.
              </p>
            )}
            <div className="level-schema__grid">
              {projectsByLevel.map(({ level, list }) => {
                const locked = level > currentLevel;
                const isCurrent = level === currentLevel;
                return (
                  <article
                    key={level}
                    className={`level-card${
                      isCurrent
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
                          isCurrent
                            ? "status-pill status-pill--current"
                            : locked
                            ? "status-pill status-pill--locked"
                            : "status-pill status-pill--ok"
                        }
                      >
                        {isCurrent ? "Actuel" : locked ? "Verrouillé" : "Débloqué"}
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
                          className={`level-project${
                            isActive ? " level-project--active" : ""
                          }`}
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
                            onClick={() => {
                              chooseProject(project._id);
                            }}
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

        {!loading && !error && assignments.length === 0 && (
          <div className="empty-state">
            <p className="empty-state__title">Aucune affectation pour le moment</p>
            <p className="empty-state__text">
              Lorsqu’un enseignant vous affectera à un projet, il apparaîtra ici avec le
              cahier des charges et les références.
            </p>
          </div>
        )}

        {!loading && !error && assignments.length > 0 && (
          <div className="project-card-list">
            {assignments.map((a) => {
              const kind = a.project?.referenceKind || "autre";
              const kindLabel =
                REFERENCE_KIND_LABELS[kind] || REFERENCE_KIND_LABELS.autre;
              return (
                <article key={a._id} className="project-card">
                  <div className="project-card__head">
                    <h3 className="project-card__title">
                      {a.project?.title || "Projet"}
                    </h3>
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
};

export default StudentDashboard;
