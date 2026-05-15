import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { API_BASE } from "../../apiBase";
import { authHeaders } from "../../authStorage";
import { emitToast } from "../../toastBus";

const QUICK_LINKS = [
  {
    to: "/admin-dashboard/utilisateurs",
    title: "Utilisateurs",
    text: "Comptes et accès",
    accent: "dash-hub-card--accent-teal",
  },
  {
    to: "/admin-dashboard/securite",
    title: "Politiques",
    text: "Sécurité globale",
    accent: "dash-hub-card--accent-violet",
  },
  {
    to: "/admin-dashboard/audit",
    title: "Audit",
    text: "Journal des événements",
    accent: "dash-hub-card--accent-amber",
  },
];

export default function AdminHomePage() {
  const [naName, setNaName] = useState("");
  const [naEmail, setNaEmail] = useState("");
  const [naPassword, setNaPassword] = useState("");

  const createAdmin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/admin/admins`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: naName.trim(),
          email: naEmail.trim(),
          password: naPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || "Création impossible");
      emitToast({ title: "Administrateur", message: "Nouveau compte créé." });
      setNaName("");
      setNaEmail("");
      setNaPassword("");
    } catch (err) {
      emitToast({ title: "Erreur", message: err.message, variant: "error" });
    }
  };

  return (
    <div className="layout-content layout-content--wide">
      <div className="home-wrap">
        <section className="home-hero home-hero--admin">
          <p className="home-hero__eyebrow">Administration</p>
        </section>

        <section className="home-section">
          <h3 className="home-section__title home-section__title--inline">Modules</h3>
          <div className="dash-hub-grid">
            {QUICK_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `dash-hub-card ${item.accent}${isActive ? " dash-hub-card--active" : ""}`
                }
              >
                <h3 className="dash-hub-card__title">{item.title}</h3>
                <p className="dash-hub-card__text">{item.text}</p>
                <span className="dash-hub-card__cta">Ouvrir →</span>
              </NavLink>
            ))}
          </div>
        </section>

        <div className="home-form-card">
          <div className="home-form-card__head">
            <h3 className="home-form-card__title">Nouvel administrateur</h3>
          </div>
          <form className="home-form-card__body" onSubmit={createAdmin}>
            <label className="form-label">Nom</label>
            <input
              className="form-input form-input--full"
              value={naName}
              onChange={(e) => setNaName(e.target.value)}
              required
            />
            <label className="form-label">Email</label>
            <input
              className="form-input form-input--full"
              type="email"
              value={naEmail}
              onChange={(e) => setNaEmail(e.target.value)}
              required
            />
            <label className="form-label">Mot de passe</label>
            <input
              className="form-input form-input--full"
              type="password"
              value={naPassword}
              onChange={(e) => setNaPassword(e.target.value)}
              required
              minLength={6}
            />
            <button type="submit" className="btn btn-secondary" style={{ marginTop: "0.5rem" }}>
              Créer
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
