import React, { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { useStudentWorkspace } from "../../context/StudentWorkspaceContext";
import TeamInfoCard from "../TeamInfoCard";
import QuickAccessHub from "../QuickAccessHub";

const BASE_LINKS = [
  {
    to: "/student-dashboard/progression",
    title: "Progression",
    text: "Choisir un projet niveau par niveau et suivre les validations.",
    icon: "1→5",
    accent: "dash-hub-card--accent-teal",
    featureKey: "progression",
  },
  {
    to: "/student-dashboard/mes-projets",
    title: "Mes projets",
    text: "Consignes, cahier des charges et fichier docker-compose.",
    icon: "P",
    accent: "",
    featureKey: "mes-projets",
  },
  {
    to: "/student-dashboard/graphe",
    title: "Graphe",
    text: "Vue circulaire de votre parcours par niveau.",
    icon: "◉",
    accent: "dash-hub-card--accent-amber",
    featureKey: "graphe",
  },
  {
    to: "/student-dashboard/soumission",
    title: "Soumission",
    text: "Déposer un fichier, un dossier ou un lien GitHub.",
    icon: "↑",
    accent: "dash-hub-card--accent-violet",
    featureKey: "soumission",
  },
  {
    to: "/student-dashboard/classement",
    title: "Classement",
    text: "Votre score et le détail du barème.",
    icon: "★",
    accent: "dash-hub-card--accent-slate",
    featureKey: "classement",
  },
  {
    to: "/student-dashboard/ma-note",
    title: "Ma note",
    text: "Détail : 50 % note d’équipe + 50 % commits GitHub.",
    icon: "/20",
    accent: "dash-hub-card--accent-rose",
    featureKey: "ma-note",
  },
  {
    to: "/student-dashboard/activite",
    title: "Activité",
    text: "Messages et mises à jour de vos projets.",
    icon: "◇",
    accent: "dash-hub-card--accent-slate",
    featureKey: "activite",
  },
];

export default function StudentHomePage() {
  const { loading, error, noTeam, currentLevel, activeAssignment, team } = useStudentWorkspace();

  const projectTitle = activeAssignment?.project?.title || "";

  const quickLinks = useMemo(() => {
    let featuredKey = "progression";
    if (!noTeam && activeAssignment) featuredKey = "soumission";
    else if (!noTeam && !activeAssignment) featuredKey = "progression";

    return BASE_LINKS.map((item) => ({
      ...item,
      featured: !noTeam && item.featureKey === featuredKey,
    }));
  }, [noTeam, activeAssignment]);

  const quickSubtitle = useMemo(() => {
    if (noTeam) {
      return "Rejoignez une équipe pour débloquer le choix de projet et les soumissions.";
    }
    if (activeAssignment) {
      return `Projet en cours : « ${projectTitle || "—"} » — pensez à déposer votre travail quand il est prêt.`;
    }
    return `Niveau accessible : ${currentLevel} / 5 — choisissez un projet avec votre équipe dans Progression.`;
  }, [noTeam, activeAssignment, projectTitle, currentLevel]);

  return (
    <div className="layout-content">
      <div className="home-wrap">
        <section className="home-hero home-hero--student">
          <p className="home-hero__eyebrow">Espace étudiant</p>
          <h2 className="home-hero__title">Tableau de bord</h2>
          <p className="home-hero__lead">
            Progressez niveau par niveau avec votre équipe, consultez vos projets et déposez vos travaux.
          </p>

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

          {!loading && noTeam && (
            <div className="feedback feedback--err" style={{ marginTop: "1rem", maxWidth: "100%" }}>
              Vous devez appartenir à une équipe. Demandez à votre enseignant de vous inscrire avant de
              choisir un projet.
            </div>
          )}

          {!loading && !error && (
            <>
              {team?.name ? (
                <div style={{ marginTop: "1rem", maxWidth: 420 }}>
                  <TeamInfoCard team={team} />
                </div>
              ) : null}
              <div className="home-stat-row">
                <div className="home-stat">
                  <span className="home-stat__label">Niveau accessible</span>
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
                    <span className="home-stat__hint">
                      Ouvrez <strong>Progression</strong> pour choisir un projet avec votre équipe.
                    </span>
                  ) : (
                    <span className="home-stat__hint">
                      <NavLink to="/student-dashboard/soumission" className="inline-link">
                        Déposer le travail
                      </NavLink>
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </section>

        <QuickAccessHub subtitle={quickSubtitle} links={quickLinks} />
      </div>
    </div>
  );
}
