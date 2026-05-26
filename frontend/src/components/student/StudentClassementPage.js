import React, { useEffect, useState } from "react";
import { API_BASE } from "../../apiBase";
import { authHeaders } from "../../authStorage";
import LoadingBlock from "../LoadingBlock";

export default function StudentClassementPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState({ bareme: null, ranking: [], myRank: null, myEntry: null });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/api/students/ranking/me`, { headers: authHeaders() })
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
            myRank: body?.myRank ?? null,
            myEntry: body?.myEntry ?? null,
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
    <div className="layout-content">
      <section className="card card--elevated card--section-gap">
        <div className="section-intro">
          <h2 className="section-intro__title">Classement</h2>
        </div>
        {data.myRank != null ? (
          <p className="diagram-item__meta" style={{ marginTop: 0 }}>
            Votre position : <strong>#{data.myRank}</strong>
            {data.myEntry?.score != null ? ` · score ${data.myEntry.score}` : ""}
          </p>
        ) : null}
        {data.bareme ? (
          <p className="diagram-item__meta">
            Barème : progression {data.bareme.progression}% · notes {data.bareme.notes}% · régularité{" "}
            {data.bareme.regularite}%
          </p>
        ) : null}
        {loading ? <LoadingBlock label="Calcul du classement…" compact /> : null}
        {error ? <div className="feedback feedback--err">{error}</div> : null}
        {!loading && !error && data.ranking.length > 0 ? (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table className="ranking-table admin-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #e2e8f0" }}>#</th>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #e2e8f0" }}>
                    Étudiant
                  </th>
                  <th style={{ textAlign: "right", padding: "8px", borderBottom: "1px solid #e2e8f0" }}>
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.ranking.map((row) => (
                  <tr
                    key={row.studentId}
                    style={row.isMe ? { background: "var(--surface-raised, #f0f9ff)" } : undefined}
                  >
                    <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>{row.rank}</td>
                    <td style={{ padding: "8px", borderBottom: "1px solid #f1f5f9" }}>
                      <strong>{row.name}</strong>
                      {row.isMe ? " (vous)" : ""}
                    </td>
                    <td style={{ textAlign: "right", padding: "8px", borderBottom: "1px solid #f1f5f9" }}>
                      {row.score}
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
