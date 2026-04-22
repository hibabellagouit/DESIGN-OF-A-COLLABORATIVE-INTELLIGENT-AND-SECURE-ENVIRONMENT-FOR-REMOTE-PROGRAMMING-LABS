import React from "react";
import { useNavigate } from "react-router-dom";

const VARIANT_COPY = {
  student: {
    title: "Espace étudiant",
    subtitle:
      "Consultez vos affectations, le cahier des charges et les références du projet.",
  },
  teacher: {
    title: "Espace enseignant",
    subtitle:
      "Créez des projets, inscrivez ou affectez des étudiants, suivez le graphe par niveau.",
  },
};

function readUser() {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function DashboardLayout({ variant, children }) {
  const navigate = useNavigate();
  const copy = VARIANT_COPY[variant] || VARIANT_COPY.student;
  const user = readUser();
  const displayName =
    variant === "teacher"
      ? user?.teacher?.name || user?.teacher?.email || "Enseignant"
      : user?.student?.name || user?.student?.email || "Étudiant";

  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  return (
    <div className="layout">
      <header className="layout-header">
        <div className="layout-header__bar">
          <div className="layout-header__brand">
            <span className="layout-header__logo" aria-hidden="true" />
            <div>
              <span className="layout-header__name">TP Projets</span>
              <span className="layout-header__tagline">Gestion de projets &amp; TP</span>
            </div>
          </div>
          <div className="layout-header__actions">
            <div className="layout-header__user">
              <span className="layout-header__user-name">{displayName}</span>
              <span className={`role-badge role-badge--${variant}`}>
                {variant === "teacher" ? "Enseignant" : "Étudiant"}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleLogout}
            >
              Déconnexion
            </button>
          </div>
        </div>
        <div className="layout-header__accent" aria-hidden="true" />
      </header>

      <main
        className={`layout-main${variant === "teacher" ? " layout-main--wide" : ""}`}
      >
        <header className="page-header-block">
          <h1 className="page-title">{copy.title}</h1>
          <p className="page-subtitle">{copy.subtitle}</p>
        </header>
        {children}
      </main>

      <footer className="layout-footer">
        <span>Plateforme pédagogique — projets de programmation</span>
      </footer>
    </div>
  );
}
