import React, { useEffect, useState } from "react";
import { API_BASE } from "../../apiBase";
import { authHeaders } from "../../authStorage";

export default function TeacherClassementPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({ bareme: null, ranking: [] });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/api/students/ranking`, { headers: authHeaders() })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || body.error || "Chargement impossible");
        return body;
      })
      .then((body) => {
        if (!cancelled) {
          setData({
            bareme: body?.bareme || null,
            ranking: Array.isArray(body?.ranking) ? body.ranking : [],
          });
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "Erreur");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="layout-content layout-content--wide">
      <section className="card card--elevated card--section-gap">
        <div className="section-intro">
          <h2 className="section-intro__title">Classement étudiants</h2>
        </div>
        {data.bareme ? (
          <p className="diagram-item__meta" style={{ marginTop: 0 }}>
            Barème : progression {data.bareme.progression}% · notes {data.bareme.notes}% · régularité{" "}
            {data.bareme.regularite}%. Le score global part de <strong>0</strong> : la progression ne
            compte que les niveaux déjà validés (niveau 1 au départ = 0 %).
          </p>
        ) : null}
        {loading ? <p className="page-subtitle">Calcul du classement…</p> : null}
        {error ? <div className="feedback feedback--err">{error}</div> : null}
        {!loading && !error && data.ranking.length === 0 ? (
          <p className="diagram-card-head__hint">Aucun étudiant disponible pour le moment.</p>
        ) : null}
        {!loading && !error && data.ranking.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #e2e8f0" }}>#</th>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #e2e8f0" }}>
                    Étudiant
                  </th>
                  <th style={{ textAlign: "right", padding: "8px", borderBottom: "1px solid #e2e8f0" }}>
                    Score global
                  </th>
                  <th style={{ textAlign: "right", padding: "8px", borderBottom: "1px solid #e2e8f0" }}>
                    Progression
                  </th>
                  <th style={{ textAlign: "right", padding: "8px", borderBottom: "1px solid #e2e8f0" }}>
                    Notes
                  </th>
                  <th style={{ textAlign: "right", padding: "8px", borderBottom: "1px solid #e2e8f0" }}>
                    Régularité
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.ranking.map((row, i) => (
                  <tr key={row.studentId}>
                    <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>{i + 1}</td>
                    <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>
                      <strong>{row.name || "—"}</strong>
                      <div className="diagram-item__meta">{row.email || "—"}</div>
                    </td>
                    <td style={{ textAlign: "right", padding: "8px", borderBottom: "1px solid #f1f5f9" }}>
                      <strong>{row.score}</strong>
                    </td>
                    <td style={{ textAlign: "right", padding: "8px", borderBottom: "1px solid #f1f5f9" }}>
                      {row.metrics?.progressionPercent ?? 0}% (N{row.currentLevel ?? 1})
                    </td>
                    <td style={{ textAlign: "right", padding: "8px", borderBottom: "1px solid #f1f5f9" }}>
                      {row.metrics?.avgNotePercent ?? 0}%
                    </td>
                    <td style={{ textAlign: "right", padding: "8px", borderBottom: "1px solid #f1f5f9" }}>
                      {row.metrics?.regularitePercent ?? 0}% ({row.metrics?.submissionsEvaluees ?? 0}/
                      {row.metrics?.submissionsTotal ?? 0})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
