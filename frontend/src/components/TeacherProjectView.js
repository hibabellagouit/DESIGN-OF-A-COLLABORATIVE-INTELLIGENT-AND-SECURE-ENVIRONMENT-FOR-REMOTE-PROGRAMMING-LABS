import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../apiBase";
import { REFERENCE_KIND_LABELS } from "../referenceLabels";
import { authHeaders, readToken } from "../authStorage";
import CahierFichierSection from "./CahierFichierSection";
import { mongoIdString } from "../mongoIdString";
import { emitToast } from "../toastBus";
import {
  displaySubmissionStatus,
  submissionStatusLabel,
  submissionStatusPillClass,
} from "../submissionStatusUi";

function formatSize(n) {
  const v = Number(n) || 0;
  if (v < 1024) return `${v} o`;
  if (v < 1024 * 1024) return `${Math.round(v / 1024)} Ko`;
  return `${(v / (1024 * 1024)).toFixed(1)} Mo`;
}

function SandboxHintsPanel({ hints }) {
  if (!hints?.languages?.length) return null;
  return (
    <div className="sandbox-hints-card">
      <h4 className="sandbox-hints-card__title">Exécution (.py / .js)</h4>
      <p className="sandbox-hints-card__warn" style={{ marginTop: 0 }}>
        Fichier = <strong>code uniquement</strong> (pas <code>python</code> ni <code>node</code> dans le
        source). Timeout ~{hints.timeoutMs / 1000}s · {hints.memory}.
      </p>
      <ul className="sandbox-hints-card__list">
        {hints.languages.map((lang) => (
          <li key={lang.extensions.join(",")} className="sandbox-hints-card__item">
            <strong>{lang.extensions.join(", ")}</strong> — <code>{lang.dockerImage}</code> ·{" "}
            <code>{lang.command.join(" ")}</code>
          </li>
        ))}
      </ul>
      <p className="sandbox-hints-card__docker">
        <strong>Où ?</strong> Sur la machine du <strong>serveur API</strong> (même hôte que Node.js, là où
        Docker est installé). Un <strong>conteneur à usage unique</strong> est créé : le fichier choisi (ou un
        .py / .js dans un projet multi-fichiers) est copié dans un dossier temporaire, monté en lecture seule
        sur <code>/workspace</code> dans le conteneur,
        puis <code>python</code> ou <code>node</code> lance le script ; le conteneur est supprimé à la fin.
      </p>
    </div>
  );
}

function SubmissionWorkRow({ submission, token, onRun, runBusy, runResult, onPatchStatus, statusBusy }) {
  const sid = mongoIdString(submission._id);
  const isGithub = (submission.kind || "file") === "github" && submission.githubUrl;
  const projectFiles = Array.isArray(submission.projectFiles) ? submission.projectFiles : [];
  const isBundle = Boolean(submission.bundleId) && projectFiles.length > 0 && !isGithub;
  const nProjectFiles = projectFiles.length;
  const hasRunnableInBundle = projectFiles.some((p) =>
    /\.(py|js)$/i.test(p.relativePath || p.storedName || "")
  );
  const downloadUrl = `${API_BASE}/api/submissions/${sid}/file?download=1&token=${encodeURIComponent(token)}`;
  const viewUrl = `${API_BASE}/api/submissions/${sid}/file?token=${encodeURIComponent(token)}`;
  const name = submission.student?.name || submission.student?.email || "Étudiant";
  const when = submission.createdAt ? new Date(submission.createdAt).toLocaleString() : "";
  const ext = (submission.fileOriginalName || "").toLowerCase();
  const canRun =
    !isGithub && (hasRunnableInBundle || ext.endsWith(".py") || ext.endsWith(".js"));
  const st = displaySubmissionStatus(submission.status);

  return (
    <div className="submission-work-row">
      <div className="submission-work-row__main">
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <strong>{name}</strong>
            <span className={submissionStatusPillClass(submission.status)}>
              {submissionStatusLabel(submission.status)}
            </span>
          </div>
          <span className="submission-work-row__meta">
            {" "}
            · {when} ·{" "}
            {isGithub ? (
              <span style={{ wordBreak: "break-all" }}>{submission.githubUrl}</span>
            ) : isBundle ? (
              <>
                {submission.fileOriginalName}
                {nProjectFiles > 1 ? ` — ${nProjectFiles} fichiers` : ""} ({formatSize(submission.fileSize)})
              </>
            ) : (
              <>
                {submission.fileOriginalName} ({formatSize(submission.fileSize)})
              </>
            )}
          </span>
        </div>
        <div className="submission-work-row__actions">
          {isGithub ? (
            <a
              className="btn btn-primary btn-sm"
              href={submission.githubUrl}
              target="_blank"
              rel="noreferrer"
            >
              Ouvrir GitHub
            </a>
          ) : (
            <>
              <a className="btn btn-outline btn-sm" href={viewUrl} target="_blank" rel="noreferrer">
                {isBundle && nProjectFiles > 1 ? "Aperçu (ZIP)" : "Consulter"}
              </a>
              <a className="btn btn-primary btn-sm" href={downloadUrl}>
                {isBundle && nProjectFiles > 1 ? "Télécharger le projet (ZIP)" : "Télécharger"}
              </a>
            </>
          )}
          {canRun ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={runBusy}
              onClick={() => onRun(sid)}
            >
              {runBusy ? "…" : "Lancer"}
            </button>
          ) : isGithub ? (
            <span className="diagram-item__meta">Sandbox : fichier .py / .js uniquement</span>
          ) : (
            <span className="diagram-item__meta">.py / .js dans le dépôt</span>
          )}
        </div>
      </div>
      {onPatchStatus && (st === "en attente" || st === "en cours d'évaluation") ? (
        <div className="cdc-actions" style={{ marginTop: 10, flexWrap: "wrap", gap: 8 }}>
          {st === "en attente" ? (
            <>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={statusBusy}
                onClick={() => onPatchStatus(sid, "en cours d'évaluation")}
              >
                En cours d’évaluation
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={statusBusy}
                onClick={() => onPatchStatus(sid, "évalué")}
              >
                Évalué
              </button>
            </>
          ) : null}
          {st === "en cours d'évaluation" ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={statusBusy}
              onClick={() => onPatchStatus(sid, "évalué")}
            >
              Marquer évalué
            </button>
          ) : null}
        </div>
      ) : null}
      {submission.note ? (
        <p className="diagram-item__meta" style={{ marginTop: 8 }}>
          <strong>Note</strong> : {submission.note}
        </p>
      ) : null}
      {runResult != null && (
        <>
          {runResult.hint ? (
            <div className="sandbox-hint-banner" role="note">
              {runResult.hint}
            </div>
          ) : null}
          <pre
            className={`sandbox-output${runResult.ok ? " sandbox-output--ok" : " sandbox-output--err"}`}
            role="status"
          >
          {runResult.timedOut ? "Temps dépassé.\n" : ""}
          {runResult.exitCode != null ? `Code sortie : ${runResult.exitCode}\n` : ""}
          {runResult.image ? `Image : ${runResult.image}\n` : ""}
          {runResult.stdout ? `--- stdout ---\n${runResult.stdout}\n` : ""}
          {runResult.stderr ? `--- stderr ---\n${runResult.stderr}\n` : ""}
          {!runResult.stdout && !runResult.stderr && !runResult.timedOut && runResult.ok
            ? "(aucune sortie)"
            : ""}
        </pre>
        </>
      )}
    </div>
  );
}

export default function TeacherProjectView() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [groups, setGroups] = useState([]);
  const [sandboxHints, setSandboxHints] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [validatingId, setValidatingId] = useState("");
  const [runBusy, setRunBusy] = useState({});
  const [runResults, setRunResults] = useState({});
  const [statusBusyId, setStatusBusyId] = useState("");

  const token = readToken();

  const load = useCallback(() => {
    const id = mongoIdString(projectId);
    if (!id) {
      setLoading(false);
      setError("Lien du projet invalide.");
      setProject(null);
      setGroups([]);
      setSandboxHints(null);
      return;
    }
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/api/projects/${encodeURIComponent(id)}/detail`, { headers: authHeaders() })
      .then(async (res) => {
        const text = await res.text();
        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = { message: text || "Réponse invalide du serveur" };
        }
        if (!res.ok) {
          const msg =
            data.message ||
            data.error ||
            (res.status === 401
              ? "Session expirée ou non autorisée — reconnectez-vous."
              : res.status === 403
                ? "Accès refusé (rôle enseignant requis)."
                : `Erreur serveur (${res.status})`);
          throw new Error(msg);
        }
        return data;
      })
      .then((data) => {
        setProject(data.project || null);
        setGroups(Array.isArray(data.groups) ? data.groups : []);
        setSandboxHints(data.sandboxHints || null);
        setRunResults({});
      })
      .catch((e) => {
        setError(e.message || "Erreur");
        setProject(null);
        setGroups([]);
        setSandboxHints(null);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const validate = async (assignmentId) => {
    if (!assignmentId || validatingId === assignmentId) return;
    setValidatingId(assignmentId);
    try {
      const res = await fetch(`${API_BASE}/api/assignments/validate`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ assignmentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || "Validation impossible");
      }
      emitToast({
        title: "Niveau validé",
        message: data.message || "Le niveau supérieur est débloqué pour les étudiants.",
      });
      load();
    } catch (e) {
      emitToast({ title: "Validation", message: e.message || "Erreur", variant: "error" });
    } finally {
      setValidatingId("");
    }
  };

  const runSubmission = async (submissionId) => {
    if (!submissionId || runBusy[submissionId]) return;
    setRunBusy((b) => ({ ...b, [submissionId]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/sandbox/run-submission`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ submissionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRunResults((r) => ({
          ...r,
          [submissionId]: {
            ok: false,
            stderr: data.error || data.message || `Erreur ${res.status}`,
          },
        }));
        return;
      }
      setRunResults((r) => ({ ...r, [submissionId]: data.result || { ok: false, stderr: "Réponse vide" } }));
    } catch (e) {
      setRunResults((r) => ({
        ...r,
        [submissionId]: { ok: false, stderr: e.message || "Échec réseau" },
      }));
    } finally {
      setRunBusy((b) => ({ ...b, [submissionId]: false }));
    }
  };

  const patchSubmissionStatus = useCallback(
    async (submissionId, status) => {
      const sid = mongoIdString(submissionId);
      if (!sid || statusBusyId) return;
      setStatusBusyId(sid);
      try {
        const res = await fetch(`${API_BASE}/api/submissions/${sid}/status`, {
          method: "PATCH",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ status }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || data.error || "Mise à jour impossible");
        emitToast({ title: "Statut", message: "Soumission mise à jour." });
        load();
      } catch (e) {
        emitToast({ title: "Statut", message: e.message || "Erreur", variant: "error" });
      } finally {
        setStatusBusyId("");
      }
    },
    [statusBusyId, load]
  );

  if (loading) {
    return (
      <div className="layout-content layout-content--wide">
        <p className="page-subtitle">Chargement du projet…</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="layout-content layout-content--wide">
        <div className="card card--elevated card--section-gap">
          <p className="diagram-card-head__hint">{error || "Projet introuvable."}</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate("/teacher-dashboard")}>
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  const refLabel = REFERENCE_KIND_LABELS[project.referenceKind] || project.referenceKind;

  return (
    <div className="layout-content layout-content--wide">
      <div className="teacher-project-toolbar">
        <Link to="/teacher-dashboard" className="btn btn-ghost btn-sm">
          Retour
        </Link>
      </div>

      <section className="card card--elevated card--section-gap">
        <div className="section-intro">
          <h2 className="section-intro__title">{project.title}</h2>
          <p className="diagram-item__meta">
            Niveau {project.niveau ?? "—"} · max. {project.maxStudents ?? "—"} étudiant(s)
          </p>
        </div>
        {project.description ? <p className="diagram-card-head__hint">{project.description}</p> : null}
        {project.cahierDeCharge ? (
          <div className="form-field-stack" style={{ marginTop: "0.75rem" }}>
            <h4 className="cdc-block__title">Cahier des charges (texte)</h4>
            <p className="diagram-card-head__hint" style={{ whiteSpace: "pre-wrap" }}>
              {project.cahierDeCharge}
            </p>
          </div>
        ) : null}
        {project.referenceValidation ? (
          <p className="diagram-item__meta" style={{ marginTop: "0.75rem" }}>
            <strong>{refLabel}</strong> — {project.referenceValidation}
          </p>
        ) : null}
        <CahierFichierSection project={project} />
      </section>

      <section className="card card--elevated card--section-gap">
        <div className="section-intro">
          <h2 className="section-intro__title">Équipes &amp; travail</h2>
        </div>

        <SandboxHintsPanel hints={sandboxHints} />

        {groups.length === 0 ? (
          <p className="diagram-card-head__hint">Aucune affectation pour ce projet pour le moment.</p>
        ) : (
          <ul className="project-groups-list">
            {groups.map((g, idx) => {
              const done = g.status === "validé";
              const students = g.students || [];
              const busy = validatingId === g._id;
              const submissions = Array.isArray(g.submissions) ? g.submissions : [];
              const aid = mongoIdString(g._id);

              return (
                <li key={aid || idx} className="project-groups-list__item project-groups-list__item--rich">
                  <div className="project-groups-list__head">
                    <span className="diagram-item__index">{idx + 1}</span>
                    <div>
                      <h4 className="diagram-item__title">
                        {g.groupName?.trim() ? g.groupName.trim() : `Équipe ${idx + 1}`}
                      </h4>
                      <p className="diagram-item__meta">
                        {!g.groupName?.trim() ? "" : `Libellé interne · `}
                        Affectation <code className="inline-code">{aid}</code> · Niveau {g.niveau ?? "—"} ·{" "}
                        {students.length} membre{students.length > 1 ? "s" : ""} · {submissions.length}{" "}
                        soumission{submissions.length > 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className={done ? "status-pill status-pill--ok" : "status-pill status-pill--pending"}>
                      {done ? "Validé" : "En cours"}
                    </span>
                  </div>

                  <div className="group-team-block">
                    <h5 className="group-subheading">Membres</h5>
                    <div className="group-team-grid">
                      {students.map((s) => {
                        const sid = mongoIdString(s._id);
                        return (
                          <div key={sid} className="group-team-card">
                            <p className="group-team-card__name">{s.name || "—"}</p>
                            <p className="group-team-card__email">{s.email || "—"}</p>
                            <p className="group-team-card__meta">
                              Niveau actuel : {s.currentLevel ?? "—"} · id :{" "}
                              <code className="inline-code">{sid}</code>
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="group-work-block">
                    <h5 className="group-subheading">Travail remis</h5>
                    {submissions.length === 0 ? (
                      <p className="diagram-card-head__hint">Aucun fichier soumis pour cette équipe.</p>
                    ) : (
                      <div className="submission-work-stack">
                        {submissions.map((sub) => {
                          const subId = mongoIdString(sub._id);
                          return (
                            <SubmissionWorkRow
                              key={subId}
                              submission={sub}
                              token={token}
                              onRun={runSubmission}
                              runBusy={!!runBusy[subId]}
                              runResult={runResults[subId]}
                              onPatchStatus={patchSubmissionStatus}
                              statusBusy={statusBusyId === subId}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {!done && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ marginTop: "0.65rem" }}
                      disabled={busy}
                      onClick={() => validate(g._id)}
                    >
                      {busy
                        ? "Validation…"
                        : `Valider le niveau ${g.niveau ?? "—"} (débloque le suivant)`}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
