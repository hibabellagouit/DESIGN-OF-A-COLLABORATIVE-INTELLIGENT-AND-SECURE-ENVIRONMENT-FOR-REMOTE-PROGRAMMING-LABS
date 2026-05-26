import React from "react";
import { NavLink } from "react-router-dom";

/**
 * Grille d’accès rapide (accueil enseignant / étudiant).
 * @param {{ links: Array<{ to: string, title: string, text: string, accent?: string, icon?: string, featured?: boolean }>, subtitle?: string }} props
 */
export default function QuickAccessHub({ links, subtitle }) {
  return (
    <section className="quick-access" aria-labelledby="quick-access-title">
      <header className="quick-access__head">
        <div>
          <h3 id="quick-access-title" className="quick-access__title">
            Accès rapide
          </h3>
          {subtitle ? <p className="quick-access__subtitle">{subtitle}</p> : null}
        </div>
        <span className="quick-access__count" aria-hidden="true">
          {links.length} section{links.length > 1 ? "s" : ""}
        </span>
      </header>

      <ul className="quick-access__grid">
        {links.map((item) => (
          <li key={item.to} className="quick-access__item">
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                [
                  "dash-hub-card",
                  item.accent || "",
                  item.featured ? "dash-hub-card--featured" : "",
                  isActive ? "dash-hub-card--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              {item.featured ? (
                <span className="dash-hub-card__badge">Recommandé</span>
              ) : null}
              <span className="dash-hub-card__icon" aria-hidden="true">
                {item.icon || item.title.charAt(0)}
              </span>
              <div className="dash-hub-card__body">
                <h4 className="dash-hub-card__title">{item.title}</h4>
                <p className="dash-hub-card__text">{item.text}</p>
              </div>
              <span className="dash-hub-card__cta">
                <span className="dash-hub-card__cta-label">Ouvrir</span>
                <span className="dash-hub-card__cta-arrow" aria-hidden="true">
                  →
                </span>
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
