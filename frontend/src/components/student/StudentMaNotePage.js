import React, { useEffect, useState } from "react";
import { API_BASE } from "../../apiBase";
import { authHeaders } from "../../authStorage";
import LoadingBlock from "../LoadingBlock";

export default function StudentMaNotePage() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/students/me/grades`, { headers: authHeaders() });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || d.message || `Erreur ${r.status}`);
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setErr(e.message || "Erreur");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (busy) return <LoadingBlock />;
  if (err) return <p className="form-feedback form-feedback--err">{err}</p>;

  const grades = Array.isArray(data?.grades) ? data.grades : [];

  return (
    <div className="layout-content">
      <p className="hint-text">{data?.breakdownHint}</p>
      {grades.length === 0 ? (
        <p className="hint-text">Aucune note enregistrée pour le moment.</p>
      ) : (
        <div className="grades-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Projet</th>
                <th>Équipe</th>
                <th>Note équipe /20</th>
                <th>50 % équipe</th>
                <th>50 % commits</th>
                <th>Final /20</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((g) => (
                <tr key={g.assignmentId}>
                  <td>
                    {g.projectTitle || "—"}
                    {g.niveau ? ` (N${g.niveau})` : ""}
                  </td>
                  <td>{g.groupName || "—"}</td>
                  <td>{fmt(g.teamGradeTotal)}</td>
                  <td>{fmt(g.teamHalfScore)}</td>
                  <td>
                    {fmt(g.commitHalfScore)}
                    {g.commits != null ? (
                      <span className="hint-text"> ({g.commits} commits)</span>
                    ) : null}
                  </td>
                  <td>
                    <strong>{fmt(g.finalTotal)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function fmt(v) {
  if (v == null || v === "") return "—";
  return String(v);
}
