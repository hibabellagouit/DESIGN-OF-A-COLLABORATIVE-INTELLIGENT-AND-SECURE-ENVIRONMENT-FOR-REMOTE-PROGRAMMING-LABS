import React, { useState } from "react";
import { API_BASE } from "../apiBase";
import { authHeaders } from "../authStorage";
import { emitToast } from "../toastBus";
import { getSandboxServicePresentation } from "../utils/sandboxServiceLabels";

/** Affichage lisible du résultat du test Docker Compose. */
export default function SandboxResultPanel({ result, submissionId, onStopped, onLinksRefreshed }) {
  const [showLogs, setShowLogs] = useState(false);
  const [stopBusy, setStopBusy] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [stoppedLocally, setStoppedLocally] = useState(false);
  const [localLinks, setLocalLinks] = useState(null);

  if (!result) return null;

  const ok = Boolean(result.ok);
  const partial =
    ok &&
    result.servicesReport &&
    !result.allServicesRunning &&
    (result.servicesReport.notRunning?.length || 0) > 0;
  const pts = result.suggestedDockerTests;
  const phases = result.phases;
  const servicesReport = result.servicesReport;
  const hasDetail = Boolean(result.logDetail && result.logDetail.length > 80);

  const containersActive =
    Boolean(result.containersLeftRunning) &&
    Boolean(result.projectName) &&
    !stoppedLocally;

  const accessLinks = (localLinks ?? result.accessLinks ?? []).filter(
    (link) => link.hostPort > 0 && link.url
  );

  const sortedLinks = [...accessLinks].sort((a, b) => {
    const pa = getSandboxServicePresentation(a.service, a.containerPort).primary ? 0 : 1;
    const pb = getSandboxServicePresentation(b.service, b.containerPort).primary ? 0 : 1;
    return pa - pb;
  });

  async function handleRefreshLinks() {
    if (!submissionId || refreshBusy) return;
    setRefreshBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/sandbox/refresh-links`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ submissionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || "Échec");
      setLocalLinks(data.accessLinks || []);
      onLinksRefreshed?.(submissionId, data.accessLinks || []);
      emitToast({
        title: "Sandbox",
        message: data.message || "Liens mis à jour",
        variant: data.accessLinks?.length ? "success" : "error",
      });
    } catch (e) {
      emitToast({ title: "Sandbox", message: e.message, variant: "error" });
    } finally {
      setRefreshBusy(false);
    }
  }

  async function handleStopSandbox() {
    if (!submissionId || stopBusy) return;
    setStopBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/sandbox/stop-submission`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ submissionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || "Arrêt impossible");
      setStoppedLocally(true);
      emitToast({
        title: "Sandbox",
        message: data.message || "Conteneurs arrêtés.",
        variant: "success",
      });
      onStopped?.(submissionId);
    } catch (e) {
      emitToast({
        title: "Sandbox",
        message: e.message || "Erreur",
        variant: "error",
      });
    } finally {
      setStopBusy(false);
    }
  }

  return (
    <div
      className={`sandbox-result${ok ? " sandbox-result--ok" : " sandbox-result--err"}`}
      role="status"
    >
      <div className="sandbox-result__head">
        <span
          className={
            partial
              ? "status-pill status-pill--pending"
              : ok
                ? "status-pill status-pill--ok"
                : "status-pill status-pill--pending"
          }
        >
          {partial ? "Test partiel" : ok ? "Test réussi" : "Test en échec partiel ou total"}
        </span>
        {pts != null ? (
          <span className="meta-chip">Suggestion barème : {pts}/3</span>
        ) : null}
        {containersActive || result.projectName ? (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={refreshBusy}
            onClick={handleRefreshLinks}
          >
            {refreshBusy ? "Ports…" : "Détecter les ports"}
          </button>
        ) : null}
        {containersActive ? (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={stopBusy}
            onClick={handleStopSandbox}
          >
            {stopBusy ? "Arrêt…" : "Arrêter le sandbox"}
          </button>
        ) : null}
      </div>

      {phases ? (
        <ul className="sandbox-result__steps">
          <li className={phases.config?.ok ? "sandbox-result__step--ok" : "sandbox-result__step--fail"}>
            Validation du fichier compose
          </li>
          <li className={phases.build?.ok ? "sandbox-result__step--ok" : "sandbox-result__step--fail"}>
            Construction des images
          </li>
          <li
            className={
              phases.up?.skipped
                ? "sandbox-result__step--skip"
                : phases.up?.ok
                  ? "sandbox-result__step--ok"
                  : "sandbox-result__step--fail"
            }
          >
            Démarrage des conteneurs
            {phases.up?.skipped ? " (mode rapide)" : ""}
          </li>
        </ul>
      ) : null}

      {result.stdout ? (
        <p className="sandbox-result__summary" style={{ whiteSpace: "pre-line" }}>
          {result.stdout}
        </p>
      ) : null}

      <div className="sandbox-access-section">
        {sortedLinks.length > 0 && !stoppedLocally ? (
          <div className="sandbox-access-card" style={{ marginTop: 10 }}>
            <div className="diagram-item__meta" style={{ marginBottom: 8 }}>
              <strong>Ouvrir le projet étudiant</strong> — conteneurs laissés démarrés :
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {sortedLinks.map((link) => {
                const pres = getSandboxServicePresentation(link.service, link.containerPort);
                return (
                  <li
                    key={`${link.service}-${link.hostPort}`}
                    style={{
                      marginBottom: 10,
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: pres.primary
                        ? "2px solid var(--accent, #2563eb)"
                        : "1px solid var(--stroke-subtle, #e2e8f0)",
                      background: pres.primary
                        ? "var(--surface-raised, #f0f7ff)"
                        : "var(--surface-raised, #f8fafc)",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{pres.title}</div>
                    <div className="diagram-item__meta" style={{ marginTop: 4 }}>
                      Service <code className="inline-code">{link.service}</code>
                      {link.containerPort != null ? ` · conteneur :${link.containerPort}` : ""}
                    </div>
                    <div className="diagram-item__meta" style={{ marginTop: 4 }}>
                      {pres.hint}
                    </div>
                    <a
                      className={pres.primary ? "btn btn-primary btn-sm" : "btn btn-outline btn-sm"}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ marginTop: 8, display: "inline-block" }}
                    >
                      {pres.primary ? "Ouvrir le site" : "Ouvrir l’API"}
                    </a>
                    <span className="diagram-item__meta" style={{ marginLeft: 8 }}>
                      {link.url}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        {sortedLinks.length === 0 &&
        !stoppedLocally &&
        (containersActive || result.projectName) ? (
          <div className="sandbox-access-card sandbox-access-card--warn" style={{ marginTop: 10 }}>
            <div className="diagram-item__meta">
              <strong>Aucun lien automatique</strong> — les conteneurs tournent peut‑être sans ports publiés sur
              l’hôte (réseau <code className="inline-code">internal</code> ou compose sans{" "}
              <code className="inline-code">ports:</code>).
            </div>
            <div className="diagram-item__meta" style={{ marginTop: 6 }}>
              Docker Desktop → projet <code className="inline-code">{result.projectName}</code> → colonne{" "}
              <strong>Ports</strong> (ex. <code className="inline-code">32768→80</code>). Ouvrez{" "}
              <code className="inline-code">http://127.0.0.1:PORT</code> pour <strong>frontend</strong>, pas pour db
              / postgres.
            </div>
            <div className="diagram-item__meta" style={{ marginTop: 6 }}>
              Relancez <strong>Tester (compose)</strong> ou cliquez <strong>Détecter les ports</strong> (
              <code className="inline-code">SANDBOX_NETWORK_INTERNAL=false</code> dans{" "}
              <code className="inline-code">backend/.env</code>).
            </div>
          </div>
        ) : null}
        {stoppedLocally ? (
          <div className="diagram-item__meta" style={{ marginTop: 8 }}>
            Sandbox arrêté — les conteneurs Docker de ce test ne tournent plus.
          </div>
        ) : null}
      </div>

      {servicesReport?.expected?.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          <p className="diagram-item__meta" style={{ marginBottom: 6 }}>
            État des services ({servicesReport.runningCount}/{servicesReport.expectedCount}{" "}
            démarré(s)) :
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {servicesReport.expected.map((svc) => {
              const down = servicesReport.notRunning?.find((n) => n.service === svc);
              const link = accessLinks.find((l) => l.service === svc);
              const pres = getSandboxServicePresentation(svc, link?.containerPort);
              return (
                <li key={svc} style={{ marginBottom: 4 }}>
                  <strong>{pres.title}</strong>{" "}
                  <span className="diagram-item__meta">({svc})</span>
                  {down ? (
                    <span className="feedback feedback--err" style={{ display: "inline", marginLeft: 6 }}>
                      — {down.status || down.state}
                    </span>
                  ) : (
                    <span style={{ color: "var(--ok, #15803d)", marginLeft: 6 }}>— en cours</span>
                  )}
                </li>
              );
            })}
          </ul>
          {(servicesReport.notRunning || [])
            .filter((s) => s.logTail)
            .map((s) => (
              <details key={`log-${s.service}`} style={{ marginTop: 8 }}>
                <summary className="diagram-item__meta">Logs {s.service} (extrait)</summary>
                <pre className="sandbox-output sandbox-output--err-inline" style={{ marginTop: 6 }}>
                  {s.logTail}
                </pre>
              </details>
            ))}
        </div>
      ) : null}

      {result.projectName ? (
        <p className="diagram-item__meta" style={{ marginTop: 8 }}>
          Docker Desktop : projet <code className="inline-code">{result.projectName}</code>
          {result.workDir && !stoppedLocally ? (
            <>
              {" "}
              · dossier <code className="inline-code">{result.workDir}</code>
            </>
          ) : null}
        </p>
      ) : null}

      {result.timedOut ? <p className="feedback feedback--err">Délai dépassé pendant le test.</p> : null}

      {hasDetail ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm sandbox-result__toggle"
          onClick={() => setShowLogs((v) => !v)}
        >
          {showLogs ? "Masquer les logs techniques" : "Voir les logs techniques"}
        </button>
      ) : null}

      {showLogs && hasDetail ? (
        <pre className="sandbox-output sandbox-output--detail">{result.logDetail}</pre>
      ) : null}

      {!showLogs && result.stderr ? (
        <pre className="sandbox-output sandbox-output--err-inline">{result.stderr}</pre>
      ) : null}
    </div>
  );
}
