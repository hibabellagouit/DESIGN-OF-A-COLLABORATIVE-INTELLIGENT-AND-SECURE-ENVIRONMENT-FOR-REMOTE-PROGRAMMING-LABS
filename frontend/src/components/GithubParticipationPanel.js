import React, { useEffect, useState } from "react";
import { API_BASE } from "../apiBase";
import { authHeaders } from "../authStorage";

export default function GithubParticipationPanel({ submissionId, compact = false }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!submissionId) return undefined;
    let cancelled = false;
    setLoading(true);
    setErr("");
    setData(null);
    fetch(`${API_BASE}/api/submissions/${encodeURIComponent(submissionId)}/github-participation`, {
      headers: authHeaders(),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || body.error || "Chargement impossible");
        return body;
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message || "Erreur");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  if (!submissionId) return null;

  return (
    <div
      className="github-participation-panel"
      style={{
        marginTop: compact ? 8 : 12,
        padding: compact ? "0.5rem 0.65rem" : "0.65rem 0.85rem",
        border: "1px solid var(--stroke-subtle, #e2e8f0)",
        borderRadius: 8,
        background: "var(--surface-raised, #f8fafc)",
      }}
    >
      <h5 className="group-subheading" style={{ marginTop: 0 }}>
        Participation (commits GitHub)
      </h5>
      <p className="diagram-item__meta" style={{ marginTop: 4 }}>
        Suivi via l&apos;API GitHub (contributeurs du dépôt), rattaché aux membres par identifiant
        GitHub (@username). Sans token serveur, les dépôts privés ou les pics de trafic peuvent
        échouer.
      </p>
      {loading && <p className="diagram-card-head__hint">Analyse du dépôt…</p>}
      {err && <div className="feedback feedback--err">{err}</div>}
      {!loading && !err && data && (
        <>
          <p className="diagram-item__meta" style={{ marginTop: 8 }}>
            Dépôt{" "}
            <code className="inline-code">
              {data.owner}/{data.repo}
            </code>
            {data.submissionKind === "file" ? " · via dépôt d’équipe" : ""}
            {" · "}
            {data.totalCommits} commit(s)
            {data.truncated ? " · tronqué" : ""}
          </p>
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e2e8f0" }}>
                    Membre
                  </th>
                  <th style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid #e2e8f0" }}>
                    Commits
                  </th>
                  <th style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid #e2e8f0" }}>
                    Part
                  </th>
                </tr>
              </thead>
              <tbody>
                {(data.members || []).map((m) => (
                  <tr key={m.studentId}>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid #f1f5f9" }}>
                      <strong>{m.name || "—"}</strong>
                      {m.githubUsername ? (
                        <span className="diagram-item__meta" style={{ display: "block" }}>
                          @{m.githubUsername}
                        </span>
                      ) : null}
                    </td>
                    <td style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid #f1f5f9" }}>
                      {m.commits}
                    </td>
                    <td style={{ textAlign: "right", padding: "6px 8px", borderBottom: "1px solid #f1f5f9" }}>
                      {m.sharePercent}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
