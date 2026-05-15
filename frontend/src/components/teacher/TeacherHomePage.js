import React from "react";
import { NavLink } from "react-router-dom";

const LINKS = [
  {
    to: "/teacher-dashboard/gestion",
    title: "Gestion",
    text: "Étudiants, projets, affectations",
    accent: "",
  },
  {
    to: "/teacher-dashboard/graphe",
    title: "Graphe",
    text: "Projets par niveau",
    accent: "dash-hub-card--accent-violet",
  },
  {
    to: "/teacher-dashboard/soumissions",
    title: "Soumissions",
    text: "Fichiers remis",
    accent: "dash-hub-card--accent-amber",
  },
  {
    to: "/teacher-dashboard/activite",
    title: "Activité",
    text: "Notifications",
    accent: "dash-hub-card--accent-teal",
  },
];

export default function TeacherHomePage() {
  return (
    <div className="layout-content layout-content--wide">
      <div className="home-wrap">
        <section className="home-hero home-hero--teacher">
          <p className="home-hero__eyebrow">Enseignant</p>
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
