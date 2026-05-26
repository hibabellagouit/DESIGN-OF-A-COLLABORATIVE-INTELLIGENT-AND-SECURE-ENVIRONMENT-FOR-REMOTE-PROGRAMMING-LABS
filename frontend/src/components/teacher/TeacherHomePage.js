import React from "react";
import QuickAccessHub from "../QuickAccessHub";

const LINKS = [
  {
    to: "/teacher-dashboard/gestion",
    title: "Gestion",
    text: "Créer des projets, inscrire des étudiants et former les équipes.",
    icon: "G",
    accent: "dash-hub-card--accent-rose",
    featured: true,
  },
  {
    to: "/teacher-dashboard/graphe",
    title: "Graphe",
    text: "Visualiser tous les projets par niveau (N1 à N5).",
    icon: "◉",
    accent: "dash-hub-card--accent-violet",
  },
  {
    to: "/teacher-dashboard/suivi",
    title: "À traiter",
    text: "Soumissions manquantes, notation, export CSV et corrélation IA.",
    icon: "!",
    accent: "dash-hub-card--accent-rose",
    featured: true,
  },
  {
    to: "/teacher-dashboard/classement",
    title: "Classement",
    text: "Scores globaux, notes et progression des étudiants.",
    icon: "★",
    accent: "dash-hub-card--accent-teal",
  },
  {
    to: "/teacher-dashboard/activite",
    title: "Activité",
    text: "Notifications : choix de projet, dépôts et validations.",
    icon: "◇",
    accent: "dash-hub-card--accent-amber",
  },
];

export default function TeacherHomePage() {
  return (
    <div className="layout-content layout-content--wide">
      <div className="home-wrap">
        <section className="home-hero home-hero--teacher">
          <p className="home-hero__eyebrow">Espace enseignant</p>
          <h2 className="home-hero__title">Tableau de bord</h2>
          <p className="home-hero__lead">
            Gérez les projets, consultez le graphe des niveaux, notez les travaux depuis chaque fiche
            projet et suivez le classement.
          </p>
        </section>

        <QuickAccessHub
          subtitle="Accédez aux principales fonctions de la plateforme. La notation se fait depuis le graphe, en ouvrant une fiche projet."
          links={LINKS}
        />
      </div>
    </div>
  );
}
