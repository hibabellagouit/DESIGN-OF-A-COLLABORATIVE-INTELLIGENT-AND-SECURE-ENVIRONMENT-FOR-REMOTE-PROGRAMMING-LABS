import React, { useEffect, useState } from "react";
import { API_BASE } from "../../apiBase";
import { authHeaders } from "../../authStorage";
import LoadingBlock from "../LoadingBlock";

export default function TeacherSuiviPage() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/teachers/pending`, { headers: authHeaders() });
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || d.error || `Erreur ${r.status}`);
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

  const exportCsv = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/teachers/export/grades.csv`, {
        headers: authHeaders(),
      });
      if (!r.ok) throw new Error(`Export ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "notes-export.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e.message || "Export impossible");
    }
  };

  if (busy) return <LoadingBlock />;
  if (err) return <p className="form-feedback form-feedback--err">{err}</p>;

  const c = data?.counts || {};

  return (
    <div className="layout-content layout-content--wide">
      <section className="panel">
        <div className="panel__head">
          <h3 className="panel__title">À traiter</h3>
          <button type="button" className="btn btn-secondary btn-sm" onClick={exportCsv}>
            Exporter CSV
          </button>
        </div>
        <div className="dash-stats-row">
          <div className="dash-stat-card">
            <span className="dash-stat-card__value">{c.teamsWithoutSubmission ?? 0}</span>
            <span className="dash-stat-card__label">Sans soumission</span>
          </div>
          <div className="dash-stat-card">
            <span className="dash-stat-card__value">{c.teamsWithoutGrade ?? 0}</span>
            <span className="dash-stat-card__label">Sans note équipe</span>
          </div>
          <div className="dash-stat-card">
            <span className="dash-stat-card__value">{c.teamsSandboxIssue ?? 0}</span>
            <span className="dash-stat-card__label">Sandbox en échec</span>
          </div>
        </div>
        {data?.projectsNoDeadline > 0 ? (
          <p className="hint-text">
            {data.projectsNoDeadline} projet(s) sans date limite de soumission définie.
          </p>
        ) : null}
      </section>

      <PendingList title="Équipes sans soumission" items={data?.noSubmission} linkKey="assignmentId" />
      <PendingList title="Équipes sans notation" items={data?.noGrade} linkKey="assignmentId" />
      <PendingList title="Tests Docker à revoir" items={data?.sandboxFailed} linkKey="assignmentId" />

      <AiCorrelationBlock />
    </div>
  );
}

function PendingList({ title, items, linkKey }) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return null;
  return (
    <section className="panel" style={{ marginTop: "1rem" }}>
      <h4 className="panel__title">{title}</h4>
      <ul className="simple-list">
        {list.map((row) => (
          <li key={row[linkKey]}>
            <strong>{row.teamLabel || "Équipe"}</strong>
            {row.projectTitle ? ` — ${row.projectTitle}` : ""}
            {row.niveau ? ` (N${row.niveau})` : ""}
          </li>
        ))}
      </ul>
      <p className="hint-text">Ouvrez la fiche projet depuis le graphe pour traiter chaque équipe.</p>
    </section>
  );
}

function AiCorrelationBlock() {
  const [corr, setCorr] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/teachers/ai-correlation`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setCorr(d))
      .catch(() => setCorr(null));
  }, []);

  if (!corr || corr.sampleSize === 0) return null;

  return (
    <section className="panel" style={{ marginTop: "1rem" }}>
      <h4 className="panel__title">Corrélation notes IA / enseignant</h4>
      <p className="hint-text">
        Échantillon : {corr.sampleSize} soumission(s). Coefficient de Pearson :{" "}
        {corr.pearson != null ? corr.pearson : "—"}
      </p>
      {corr.hint ? <p className="hint-text">{corr.hint}</p> : null}
    </section>
  );
}
