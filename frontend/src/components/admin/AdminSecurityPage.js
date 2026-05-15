import React, { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../apiBase";
import { authHeaders } from "../../authStorage";
import { emitToast } from "../../toastBus";

export default function AdminSecurityPage() {
  const [allowReg, setAllowReg] = useState(true);
  const [retention, setRetention] = useState(365);
  const [minLen, setMinLen] = useState(6);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/admin/security-policy`, { headers: authHeaders() })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || data.error);
        return data;
      })
      .then((d) => {
        setAllowReg(d.allowStudentSelfRegistration !== false);
        setRetention(Number(d.auditLogRetentionDays) || 365);
        setMinLen(Math.max(6, Math.min(128, Number(d.minPasswordLength) || 6)));
      })
      .catch(() => emitToast({ title: "Politiques", message: "Chargement impossible.", variant: "error" }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/security-policy`, {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          allowStudentSelfRegistration: allowReg,
          auditLogRetentionDays: retention,
          minPasswordLength: minLen,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || "Erreur");
      emitToast({ title: "Politiques", message: "Réglages enregistrés." });
    } catch (err) {
      emitToast({ title: "Erreur", message: err.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <header className="page-header-block">
        <h1 className="page-title">Politiques de sécurité</h1>
      </header>

      {loading ? (
        <p className="panel__hint">Chargement…</p>
      ) : (
        <form className="panel" onSubmit={save}>
          <div className="panel__body">
            <label className="form-check">
              <input
                type="checkbox"
                checked={allowReg}
                onChange={(e) => setAllowReg(e.target.checked)}
              />
              <span>Inscription libre des étudiants (page publique)</span>
            </label>

            <label className="form-label" style={{ marginTop: "1rem" }}>
              Longueur minimale des mots de passe (6–128)
            </label>
            <input
              className="form-input"
              type="number"
              min={6}
              max={128}
              value={minLen}
              onChange={(e) => setMinLen(Number(e.target.value))}
            />

            <label className="form-label" style={{ marginTop: "1rem" }}>
              Rétention audit (jours, 30–3650)
            </label>
            <input
              className="form-input"
              type="number"
              min={30}
              max={3650}
              value={retention}
              onChange={(e) => setRetention(Number(e.target.value))}
            />
            <button type="submit" className="btn btn-primary" style={{ marginTop: "1rem" }} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
