import React from "react";
import { NavLink } from "react-router-dom";
import { useStudentWorkspace } from "../../context/StudentWorkspaceContext";

const LINKS = [
  {
    to: "/student-dashboard/progression",
    title: "Progression",
    text: "Niveaux et choix de projet",
    accent: "dash-hub-card--accent-teal",
  },
  {
    to: "/student-dashboard/mes-projets",
    title: "Mes projets",
    text: "Consignes et documents",
    accent: "",
  },
  {
    to: "/student-dashboard/graphe",
    title: "Graphe",
    text: "Vue par niveau",
    accent: "dash-hub-card--accent-amber",
  },
  {
    to: "/student-dashboard/activite",
    title: "Activité",
    text: "Notifications",
    accent: "dash-hub-card--accent-slate",
  },
  {
    to: "/student-dashboard/soumission",
    title: "Soumission",
    text: "Envoi de fichier",
    accent: "dash-hub-card--accent-violet",
  },
];

export default function StudentHomePage() {
  const { loading, error, currentLevel, activeAssignment } = useStudentWorkspace();

  const projectTitle = activeAssignment?.project?.title || "";

  return (
    <div className="layout-content">
      <div className="home-wrap">
        <section className="home-hero home-hero--student">
          <p className="home-hero__eyebrow">Étudiant</p>
          {loading && (
            <div className="home-stat-row" aria-busy="true">
              <div className="home-stat" style={{ flex: "1 1 200px" }}>
                <span className="home-stat__label">Chargement</span>
                <span className="skeleton-line skeleton-line--long" style={{ marginTop: "0.35rem" }} />
              </div>
            </div>
          )}

          {error && (
            <div className="feedback feedback--err" style={{ marginTop: "1rem", maxWidth: "100%" }}>
              {error}
            </div>
          )}

          {!loading && !error && (
            <div className="home-stat-row">
              <div className="home-stat">
                <span className="home-stat__label">Niveau</span>
                <span className="home-stat__value">
                  {currentLevel} <span style={{ fontWeight: 600, opacity: 0.75 }}>/ 5</span>
                </span>
              </div>
              <div className="home-stat" style={{ flex: "2 1 220px" }}>
                <span className="home-stat__label">Projet en cours</span>
                <span className="home-stat__value" style={{ fontSize: "1rem", fontWeight: 700 }}>
                  {projectTitle || "—"}
                </span>
                {!activeAssignment ? (
                  <span className="home-stat__hint">Voir Progression pour choisir un projet.</span>
                ) : null}
              </div>
            </div>
          )}
        </section>

        <section className="home-section">
          <h3 className="home-section__title home-section__title--inline">Sections</h3>
          <div className="dash-hub-grid">
            {LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `dash-hub-card${item.accent ? ` ${item.accent}` : ""}${isActive ? " dash-hub-card--active" : ""}`
                }
              >
                <h3 className="dash-hub-card__title">{item.title}</h3>
                <p className="dash-hub-card__text">{item.text}</p>
                <span className="dash-hub-card__cta">Ouvrir →</span>
              </NavLink>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
