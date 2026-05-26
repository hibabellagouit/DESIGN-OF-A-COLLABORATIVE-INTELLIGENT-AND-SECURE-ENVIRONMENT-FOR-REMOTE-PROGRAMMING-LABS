import React, { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { API_BASE } from "../apiBase";
import { authHeaders, readToken } from "../authStorage";

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "";
  }
}

function typeLabel(type) {
  const map = {
    assignment_created: "Affectation",
    assignment_validated: "Validation",
    student_selected_project: "Choix de projet",
    team_project_selected: "Choix de projet (équipe)",
    submission_received: "Soumission",
    submission_status: "Suivi soumission",
  };
  return map[type] || type || "Activité";
}

export default function ActivityFeedPage() {
  const location = useLocation();
  const isTeacher = location.pathname.includes("teacher-dashboard");
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(() => {
    const token = readToken();
    if (!token) {
      setLoading(false);
      setError("Non connecté");
      return Promise.resolve();
    }
    setLoading(true);
    setError("");
    return fetch(`${API_BASE}/api/notifications/mine`, { headers: authHeaders() })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || data.error || "Chargement impossible");
        return data;
      })
      .then((data) => {
        setItems(Array.isArray(data.items) ? data.items : []);
        setUnreadCount(Number(data.unreadCount) || 0);
      })
      .catch((e) => {
        setError(e.message || "Erreur");
        setItems([]);
        setUnreadCount(0);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id) => {
    if (!id || busyId === id) return;
    setBusyId(id);
    try {
      await fetch(`${API_BASE}/api/notifications/${id}/read`, {
        method: "PATCH",
        headers: authHeaders(),
      });
      await load();
      window.dispatchEvent(new Event("notifications:refresh"));
    } finally {
      setBusyId("");
    }
  };

  const markAllRead = async () => {
    setBusyId("__all__");
    try {
      await fetch(`${API_BASE}/api/notifications/read-all`, {
        method: "POST",
        headers: authHeaders(),
      });
      await load();
      window.dispatchEvent(new Event("notifications:refresh"));
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className={isTeacher ? "layout-content layout-content--wide" : "layout-content"}>
      <section className="card card--elevated card--section-gap">
        <div className="section-intro">
          <h2 className="section-intro__title">Notifications</h2>
        </div>

        {loading && (
          <div className="state-block state-block--muted">
            <span className="skeleton-line skeleton-line--long" />
          </div>
        )}
        {error && <div className="feedback feedback--err">{error}</div>}

        {!loading && !error && (
          <>
            <div className="activity-toolbar">
              <span className="diagram-card-head__hint">
                {unreadCount > 0 ? (
                  <strong>{unreadCount}</strong>
                ) : (
                  <span>0</span>
                )}{" "}
                non lu{unreadCount > 1 ? "s" : ""}
              </span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={busyId === "__all__"}
                  onClick={markAllRead}
                >
                  {busyId === "__all__" ? "…" : "Tout marquer comme lu"}
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <p className="diagram-card-head__hint">Aucune notification.</p>
            ) : (
              <ul className="activity-feed-list">
                {items.map((n) => {
                  const id = n._id;
                  const unread = !n.read;
                  return (
                    <li
                      key={id}
                      className={`activity-feed-item${unread ? " activity-feed-item--unread" : ""}`}
                    >
                      <div className="activity-feed-item__head">
                        <span className="activity-feed-item__type">{typeLabel(n.type)}</span>
                        <time className="activity-feed-item__time" dateTime={n.createdAt}>
                          {formatDate(n.createdAt)}
                        </time>
                      </div>
                      <h4 className="activity-feed-item__title">{n.title}</h4>
                      {n.body ? <p className="activity-feed-item__body">{n.body}</p> : null}
                      {unread && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busyId === id}
                          onClick={() => markRead(id)}
                        >
                          {busyId === id ? "…" : "Marquer comme lu"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
