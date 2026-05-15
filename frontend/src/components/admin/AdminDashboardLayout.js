import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

function readUser() {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function AdminDashboardLayout() {
  const navigate = useNavigate();
  const user = readUser();
  const displayName = user?.admin?.name || user?.admin?.email || "Administrateur";

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
              <span className="layout-header__tagline">Administration</span>
            </div>
          </div>
          <div className="layout-header__actions">
            <div className="layout-header__user">
              <span className="layout-header__user-name">{displayName}</span>
              <span className="role-badge role-badge--admin">Administrateur</span>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
              Déconnexion
            </button>
          </div>
        </div>
        <nav className="layout-nav" aria-label="Navigation administration">
          <NavLink className="layout-nav__link" to="/admin-dashboard" end>
            Accueil
          </NavLink>
          <NavLink className="layout-nav__link" to="/admin-dashboard/utilisateurs">
            Utilisateurs
          </NavLink>
          <NavLink className="layout-nav__link" to="/admin-dashboard/securite">
            Politiques
          </NavLink>
          <NavLink className="layout-nav__link" to="/admin-dashboard/audit">
            Journal d&apos;audit
          </NavLink>
        </nav>
        <div className="layout-header__accent" aria-hidden="true" />
      </header>

      <main className="layout-main layout-main--wide">
        <Outlet />
      </main>

      <footer className="layout-footer">
        <span>TP Projets</span>
      </footer>
    </div>
  );
}
