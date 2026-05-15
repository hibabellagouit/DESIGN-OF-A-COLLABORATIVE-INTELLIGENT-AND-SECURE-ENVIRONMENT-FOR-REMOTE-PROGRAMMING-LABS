import React, { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../apiBase";
import { authHeaders } from "../../authStorage";

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "";
  }
}

export default function AdminAuditPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/api/admin/audit-logs?limit=100`, { headers: authHeaders() })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || data.error || "Chargement impossible");
        return data;
      })
      .then((d) => {
        setItems(Array.isArray(d.items) ? d.items : []);
      })
      .catch((e) => {
        setError(e.message || "Erreur");
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <header className="page-header-block">
        <h1 className="page-title">Journal d&apos;audit</h1>
      </header>

      {loading ? <p className="panel__hint">Chargement…</p> : null}
      {error ? <div className="feedback feedback--err">{error}</div> : null}

      {!loading && !error ? (
        <div className="panel">
          <div className="panel__body" style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Acteur</th>
                  <th>Cible</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.createdAt)}</td>
                    <td>
                      <code style={{ fontSize: "0.8rem" }}>{row.action}</code>
                    </td>
                    <td>
                      {row.actorRole}
                      {row.actorId ? (
                        <>
                          <br />
                          <span className="panel__hint" style={{ fontSize: "0.75rem" }}>
                            {row.actorId}
                          </span>
                        </>
                      ) : null}
                    </td>
                    <td>
                      {row.targetType || "—"}
                      {row.targetId ? (
                        <>
                          <br />
                          <span className="panel__hint" style={{ fontSize: "0.75rem" }}>
                            {row.targetId}
                          </span>
                        </>
                      ) : null}
                    </td>
                    <td style={{ maxWidth: "120px", wordBreak: "break-all" }}>{row.ip || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 ? <p className="panel__hint">Aucune entrée.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
