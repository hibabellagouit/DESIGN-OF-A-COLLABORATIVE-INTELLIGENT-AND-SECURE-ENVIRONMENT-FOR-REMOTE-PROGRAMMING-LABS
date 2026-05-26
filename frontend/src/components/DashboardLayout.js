import React, { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { API_BASE } from "../apiBase";
import { authHeaders, readToken, readUser } from "../authStorage";
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

function studentNeedsGithubAccount(u) {
  return u?.role === "student" && !String(u?.student?.githubUsername || "").trim();
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
  if (pathname.includes("/student-dashboard/classement")) {
    return {
      title: "Classement",
      subtitle: "Scores pondérés selon le barème",
    };
  }
  if (pathname.includes("/student-dashboard/ma-note")) {
    return {
      title: "Ma note",
      subtitle: "Détail 50 % équipe + 50 % commits GitHub",
    };
  }
  return null;
}

function resolveTeacherPageTitle(pathname) {
  if (pathname.includes("/teacher-dashboard/project/")) {
    return {
      title: "Fiche projet",
      subtitle: "Équipes, dépôts et notation /20",
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
  if (pathname.includes("/teacher-dashboard/classement")) {
    return {
      title: "Classement",
      subtitle: "Scores pondérés par barème",
    };
  }
  if (pathname.includes("/teacher-dashboard/suivi")) {
    return {
      title: "À traiter",
      subtitle: "Soumissions, notation et export CSV",
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
  const [studentGithubBlocked, setStudentGithubBlocked] = useState(false);
  const [githubUsernameDraft, setGithubUsernameDraft] = useState("");
  const [githubSaveBusy, setGithubSaveBusy] = useState(false);
  const sessionStartRef = useRef(Date.now());
  const toastNotifIdsRef = useRef(new Set());

  const resolved =
    variant === "teacher"
      ? resolveTeacherPageTitle(location.pathname)
      : resolveStudentPageTitle(location.pathname);

  const pageTitle = resolved?.title ?? copy.defaultTitle;
  const pageSubtitle = resolved?.subtitle ?? copy.defaultSubtitle;

  const pageTitleShown =
    variant === "student" && studentGithubBlocked ? "Compte GitHub requis" : pageTitle;
  const pageSubtitleShown =
    variant === "student" && studentGithubBlocked
      ? "Renseignez votre identifiant GitHub (sans @) — obligation pour la plateforme."
      : pageSubtitle;

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
    const interval = setInterval(pull, 30000);
    const onRefresh = () => pull();
    window.addEventListener("notifications:refresh", onRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("notifications:refresh", onRefresh);
    };
  }, [variant]);

  useEffect(() => {
    if (variant !== "student") {
      setStudentGithubBlocked(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/students/me`, { headers: authHeaders() });
        const data = await r.json();
        if (r.ok && data?.student) {
          const u = readUser();
          if (u?.role === "student") {
            const next = { ...u, student: { ...u.student, ...data.student } };
            localStorage.setItem("user", JSON.stringify(next));
          }
        }
      } catch {
        /* ignore */
      }
      if (cancelled) return;
      const u2 = readUser();
      setStudentGithubBlocked(studentNeedsGithubAccount(u2));
      setGithubUsernameDraft(String(u2?.student?.githubUsername || "").replace(/^@/, ""));
    })();
    return () => {
      cancelled = true;
    };
  }, [variant]);

  const saveStudentGithub = async (e) => {
    e.preventDefault();
    const gh = githubUsernameDraft.trim().replace(/^@/, "");
    if (!gh) {
      emitToast({
        title: "GitHub",
        message: "L’identifiant GitHub est obligatoire.",
        variant: "error",
      });
      return;
    }
    setGithubSaveBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/students/me/github`, {
        method: "PATCH",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ githubUsername: gh }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error);
      const u = readUser();
      const next = { ...u, student: { ...u.student, ...(data.student || {}) } };
      localStorage.setItem("user", JSON.stringify(next));
      setStudentGithubBlocked(false);
      emitToast({ title: "GitHub", message: data.message || "Profil à jour." });
    } catch (err) {
      emitToast({
        title: "GitHub",
        message: err.message || "Erreur",
        variant: "error",
      });
    } finally {
      setGithubSaveBusy(false);
    }
  };

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
          {variant === "student" && !studentGithubBlocked ? (
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
              <NavLink className="layout-nav__link" to="/student-dashboard/classement">
                Classement
              </NavLink>
              <NavLink className="layout-nav__link" to="/student-dashboard/ma-note">
                Ma note
              </NavLink>
              <NavLink className="layout-nav__link" to="/student-dashboard/activite">
                Activité
                {notifUnread > 0 ? (
                  <span className="layout-nav__badge">{notifUnread > 99 ? "99+" : notifUnread}</span>
                ) : null}
              </NavLink>
            </>
          ) : variant === "teacher" ? (
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
              <NavLink className="layout-nav__link" to="/teacher-dashboard/classement">
                Classement
              </NavLink>
              <NavLink className="layout-nav__link" to="/teacher-dashboard/suivi">
                À traiter
              </NavLink>
              <NavLink className="layout-nav__link" to="/teacher-dashboard/activite">
                Activité
                {notifUnread > 0 ? (
                  <span className="layout-nav__badge">{notifUnread > 99 ? "99+" : notifUnread}</span>
                ) : null}
              </NavLink>
            </>
          ) : null}
        </nav>
        <div className="layout-header__accent" aria-hidden="true" />
      </header>

      <main className={`layout-main${variant === "teacher" ? " layout-main--wide" : ""}`}>
        <header className="page-header-block">
          <h1 className="page-title">{pageTitleShown}</h1>
          {pageSubtitleShown ? <p className="page-subtitle">{pageSubtitleShown}</p> : null}
        </header>
        {variant === "student" && studentGithubBlocked ? (
          <div className="card card--elevated" style={{ padding: "1.5rem", maxWidth: 480 }}>
            <p className="page-subtitle" style={{ marginBottom: "1rem" }}>
              Pour continuer (équipes, choix de projet, soumissions), chaque étudiant doit fournir son
              identifiant GitHub public.
            </p>
            <form onSubmit={saveStudentGithub}>
              <label htmlFor="student-github-gate" style={{ display: "block", marginBottom: 6 }}>
                Identifiant GitHub <span style={{ color: "var(--accent-warn, #c0392b)" }}>*</span>
              </label>
              <input
                id="student-github-gate"
                className="form-input form-input--full"
                autoComplete="username"
                placeholder="ex : octocat"
                value={githubUsernameDraft}
                onChange={(e) => setGithubUsernameDraft(e.target.value)}
                style={{ width: "100%", marginBottom: 12 }}
              />
              <button type="submit" className="btn btn-primary" disabled={githubSaveBusy}>
                {githubSaveBusy ? "Enregistrement…" : "Valider et continuer"}
              </button>
            </form>
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      <footer className="layout-footer">
        <span>TP Projets</span>
      </footer>
    </div>
  );
}
