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
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");
  const [creatingTeacher, setCreatingTeacher] = useState(false);

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

  const createTeacher = async (e) => {
    e.preventDefault();
    if (creatingTeacher) return;
    setCreatingTeacher(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/teachers`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: teacherName.trim(),
          email: teacherEmail.trim(),
          password: teacherPassword,
        }),
      });
      const raw = await res.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        const hint =
          data.message ||
          data.error ||
          (res.status === 404
            ? "Route introuvable — redémarrez le serveur backend (npm start dans backend/)."
            : res.status === 401
              ? "Session expirée — reconnectez-vous en administrateur."
              : res.status === 403
                ? "Accès refusé — connectez-vous avec un compte administrateur."
                : raw?.slice(0, 120) || `Erreur HTTP ${res.status}`);
        throw new Error(hint);
      }
      emitToast({
        title: "Enseignant",
        message: data.message || "Compte enseignant créé.",
      });
      setTeacherName("");
      setTeacherEmail("");
      setTeacherPassword("");
      await load();
    } catch (e) {
      emitToast({ title: "Erreur", message: e.message, variant: "error" });
    } finally {
      setCreatingTeacher(false);
    }
  };

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

      <div className="home-form-card" style={{ marginBottom: "1.25rem" }}>
        <div className="home-form-card__head">
          <h2 className="home-form-card__title">Ajouter un enseignant</h2>
          <p className="diagram-item__meta" style={{ margin: "0.35rem 0 0" }}>
            Le professeur pourra se connecter avec cet e-mail et ce mot de passe.
          </p>
        </div>
        <form className="home-form-card__body" onSubmit={createTeacher}>
          <label className="form-label" htmlFor="teacher-name">
            Nom
          </label>
          <input
            id="teacher-name"
            className="form-input form-input--full"
            value={teacherName}
            onChange={(e) => setTeacherName(e.target.value)}
            required
            autoComplete="name"
          />
          <label className="form-label" htmlFor="teacher-email">
            E-mail
          </label>
          <input
            id="teacher-email"
            className="form-input form-input--full"
            type="email"
            value={teacherEmail}
            onChange={(e) => setTeacherEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <label className="form-label" htmlFor="teacher-password">
            Mot de passe
          </label>
          <input
            id="teacher-password"
            className="form-input form-input--full"
            type="password"
            value={teacherPassword}
            onChange={(e) => setTeacherPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{ marginTop: "0.75rem" }}
            disabled={creatingTeacher}
          >
            {creatingTeacher ? "Création…" : "Créer le compte enseignant"}
          </button>
        </form>
      </div>

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
