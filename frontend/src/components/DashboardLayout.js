import React, { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { API_BASE } from "../apiBase";
import { authHeaders, readToken } from "../authStorage";
import { emitToast } from "../toastBus";

const VARIANT_COPY = {
  student: {
    defaultTitle: "Espace étudiant",
    defaultSubtitle: "",
  },
  teacher: {
    defaultTitle: "Espace enseignant",
    defaultSubtitle: "",
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

function resolveStudentPageTitle(pathname) {
  if (pathname === "/student-dashboard" || pathname === "/student-dashboard/") {
    return { title: "Accueil", subtitle: "" };
  }
  if (pathname.includes("/student-dashboard/progression")) {
    return {
      title: "Progression",
      subtitle: "Niveaux et choix de projet",
    };
  }
  if (pathname.includes("/student-dashboard/mes-projets")) {
    return {
      title: "Mes projets",
      subtitle: "Consignes et documents",
    };
  }
  if (pathname.includes("/student-dashboard/graphe")) {
    return {
      title: "Graphe de parcours",
      subtitle: "Projets par niveau",
    };
  }
  if (pathname.includes("/student-dashboard/activite")) {
    return {
      title: "Activité",
      subtitle: "Notifications",
    };
  }
  if (pathname.includes("/student-dashboard/soumission")) {
    return {
      title: "Soumission",
      subtitle: "Fichier ou lien GitHub pour le projet en cours",
    };
  }
  return null;
}

function resolveTeacherPageTitle(pathname) {
  if (pathname.includes("/teacher-dashboard/project/")) {
    return {
      title: "Fiche projet",
      subtitle: "Équipes et soumissions",
    };
  }
  if (pathname === "/teacher-dashboard" || pathname === "/teacher-dashboard/") {
    return { title: "Accueil", subtitle: "" };
  }
  if (pathname.includes("/teacher-dashboard/gestion")) {
    return {
      title: "Gestion",
      subtitle: "Étudiants, projets, affectations",
    };
  }
  if (pathname.includes("/teacher-dashboard/graphe")) {
    return {
      title: "Graphe des affectations",
      subtitle: "Projets par niveau",
    };
  }
  if (pathname.includes("/teacher-dashboard/soumissions")) {
    return {
      title: "Soumissions",
      subtitle: "Fichiers remis",
    };
  }
  if (pathname.includes("/teacher-dashboard/activite")) {
    return {
      title: "Activité",
      subtitle: "Notifications",
    };
  }
  return null;
}

export default function DashboardLayout({ variant }) {
  const navigate = useNavigate();
  const location = useLocation();
  const copy = VARIANT_COPY[variant] || VARIANT_COPY.student;
  const [notifUnread, setNotifUnread] = useState(0);
  const sessionStartRef = useRef(Date.now());
  const toastNotifIdsRef = useRef(new Set());

  const resolved =
    variant === "teacher"
      ? resolveTeacherPageTitle(location.pathname)
      : resolveStudentPageTitle(location.pathname);

  const pageTitle = resolved?.title ?? copy.defaultTitle;
  const pageSubtitle = resolved?.subtitle ?? copy.defaultSubtitle;

  const user = readUser();
  const displayName =
    variant === "teacher"
      ? user?.teacher?.name || user?.teacher?.email || "Enseignant"
      : user?.student?.name || user?.student?.email || "Étudiant";

  useEffect(() => {
    const token = readToken();
    if (!token) {
      setNotifUnread(0);
      return;
    }

    const slackMs = 4000;
    const start = sessionStartRef.current;

    const pull = () => {
      fetch(`${API_BASE}/api/notifications/mine?limit=30`, { headers: authHeaders() })
        .then((r) => r.json())
        .then((d) => {
          setNotifUnread(Number(d.unreadCount) || 0);
          const items = Array.isArray(d.items) ? d.items : [];
          for (const n of items) {
            if (!n?._id || n.read) continue;
            const idStr = String(n._id);
            if (toastNotifIdsRef.current.has(idStr)) continue;
            const ts = new Date(n.createdAt).getTime();
            if (!Number.isFinite(ts) || ts < start - slackMs) continue;
            toastNotifIdsRef.current.add(idStr);
            emitToast({
              title: n.title || "Notification",
              message: n.body || "",
              variant: "info",
            });
          }
        })
        .catch(() => setNotifUnread(0));
    };

    pull();
    const interval = setInterval(pull, 10000);
    const onRefresh = () => pull();
    window.addEventListener("notifications:refresh", onRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("notifications:refresh", onRefresh);
    };
  }, [location.pathname, variant]);

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
              <span className="layout-header__tagline">Projets &amp; TP</span>
            </div>
          </div>
          <div className="layout-header__actions">
            <div className="layout-header__user">
              <span className="layout-header__user-name">{displayName}</span>
              <span className={`role-badge role-badge--${variant}`}>
                {variant === "teacher" ? "Enseignant" : "Étudiant"}
              </span>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
              Déconnexion
            </button>
          </div>
        </div>
        <nav className="layout-nav" aria-label="Navigation principale">
          {variant === "student" ? (
            <>
              <NavLink className="layout-nav__link" to="/student-dashboard" end>
                Accueil
              </NavLink>
              <NavLink className="layout-nav__link" to="/student-dashboard/progression">
                Progression
              </NavLink>
              <NavLink className="layout-nav__link" to="/student-dashboard/mes-projets">
                Mes projets
              </NavLink>
              <NavLink className="layout-nav__link" to="/student-dashboard/graphe">
                Graphe
              </NavLink>
              <NavLink className="layout-nav__link" to="/student-dashboard/soumission">
                Soumission
              </NavLink>
              <NavLink className="layout-nav__link" to="/student-dashboard/activite">
                Activité
                {notifUnread > 0 ? (
                  <span className="layout-nav__badge">{notifUnread > 99 ? "99+" : notifUnread}</span>
                ) : null}
              </NavLink>
            </>
          ) : (
            <>
              <NavLink className="layout-nav__link" to="/teacher-dashboard" end>
                Accueil
              </NavLink>
              <NavLink className="layout-nav__link" to="/teacher-dashboard/gestion">
                Gestion
              </NavLink>
              <NavLink className="layout-nav__link" to="/teacher-dashboard/graphe">
                Graphe
              </NavLink>
              <NavLink className="layout-nav__link" to="/teacher-dashboard/soumissions">
                Soumissions
              </NavLink>
              <NavLink className="layout-nav__link" to="/teacher-dashboard/activite">
                Activité
                {notifUnread > 0 ? (
                  <span className="layout-nav__badge">{notifUnread > 99 ? "99+" : notifUnread}</span>
                ) : null}
              </NavLink>
            </>
          )}
        </nav>
        <div className="layout-header__accent" aria-hidden="true" />
      </header>

      <main className={`layout-main${variant === "teacher" ? " layout-main--wide" : ""}`}>
        <header className="page-header-block">
          <h1 className="page-title">{pageTitle}</h1>
          {pageSubtitle ? <p className="page-subtitle">{pageSubtitle}</p> : null}
        </header>
        <Outlet />
      </main>

      <footer className="layout-footer">
        <span>TP Projets</span>
      </footer>
    </div>
  );
}
