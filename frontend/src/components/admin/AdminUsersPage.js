import React, { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../apiBase";
import { authHeaders } from "../../authStorage";
import { emitToast } from "../../toastBus";

const ROLE_LABEL = {
  admin: "Administrateur",
  teacher: "Enseignant",
  student: "Étudiant",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/api/admin/users`, { headers: authHeaders() })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || data.error || "Chargement impossible");
        return data;
      })
      .then((d) => setUsers(Array.isArray(d.users) ? d.users : []))
      .catch((e) => {
        setError(e.message || "Erreur");
        setUsers([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (role, id, nextDisabled) => {
    const key = `${role}-${id}`;
    if (busyId === key) return;
    setBusyId(key);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${role}/${id}`, {
        method: "PATCH",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ isDisabled: nextDisabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || "Mise à jour impossible");
      emitToast({
        title: "Compte mis à jour",
        message: nextDisabled ? "L’utilisateur ne peut plus se connecter." : "Compte réactivé.",
      });
      await load();
    } catch (e) {
      emitToast({ title: "Erreur", message: e.message, variant: "error" });
    } finally {
      setBusyId("");
    }
  };

  return (
    <div>
      <header className="page-header-block">
        <h1 className="page-title">Utilisateurs</h1>
      </header>

      {loading ? <p className="panel__hint">Chargement…</p> : null}
      {error ? (
        <div className="feedback feedback--err">{error}</div>
      ) : null}

      {!loading && !error ? (
        <div className="panel">
          <div className="panel__body" style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Rôle</th>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>État</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const key = `${u.role}-${u.id}`;
                  const busy = busyId === key;
                  return (
                    <tr key={key}>
                      <td>{ROLE_LABEL[u.role] || u.role}</td>
                      <td>{u.name || "—"}</td>
                      <td>{u.email}</td>
                      <td>{u.isDisabled ? <span className="tag tag--muted">Désactivé</span> : <span className="tag tag--ok">Actif</span>}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          disabled={busy}
                          onClick={() => toggle(u.role, u.id, !u.isDisabled)}
                        >
                          {u.isDisabled ? "Réactiver" : "Désactiver"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
