import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../apiBase";
import { authHeaders } from "../authStorage";
import {
  buildDockerComposeChecklistFromFiles,
  buildDockerComposeChecklistFromPaths,
} from "../utils/dockerComposeChecklist";

const STATUS_ICON = {
  ok: "✓",
  fail: "✗",
  warn: "!",
  pending: "…",
  info: "·",
};

function ChecklistRows({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="compose-checklist">
      {items.map((it) => (
        <li
          key={it.id}
          className={`compose-checklist__item compose-checklist__item--${it.status}`}
        >
          <span className="compose-checklist__mark" aria-hidden>
            {STATUS_ICON[it.status] || "·"}
          </span>
          <div>
            <strong>{it.label}</strong>
            {it.detail ? <div className="diagram-item__meta">{it.detail}</div> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Guide + checklist docker-compose à la racine (étudiant / enseignant).
 */
export default function DockerComposeGuidePanel({
  mode = "file",
  files = [],
  githubUrl = "",
  compact = false,
  showGuideDefault = false,
  submissionPaths = null,
  verifyGithubLive = true,
  githubComposeVerified = null,
}) {
  const [guideOpen, setGuideOpen] = useState(showGuideDefault);
  const [githubChecklist, setGithubChecklist] = useState(null);
  const [githubBusy, setGithubBusy] = useState(false);

  const fileChecklist = useMemo(() => {
    if (submissionPaths?.length) {
      return buildDockerComposeChecklistFromPaths(submissionPaths);
    }
    if (mode !== "file" || !files?.length) return null;
    return buildDockerComposeChecklistFromFiles(files);
  }, [mode, files, submissionPaths]);

  const verifyGithub = useCallback(async (signal) => {
    const url = String(githubUrl || "").trim();
    if (!url) {
      setGithubChecklist(null);
      return;
    }
    setGithubBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/submissions/compose-checklist`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ mode: "github", githubUrl: url }),
        signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Vérification impossible");
      if (!signal?.aborted) setGithubChecklist(data);
    } catch (e) {
      if (e?.name === "AbortError" || signal?.aborted) return;
      setGithubChecklist({
        items: [
          {
            id: "github_err",
            label: "Vérification GitHub",
            status: "fail",
            detail: e.message,
          },
        ],
        ready: false,
      });
    } finally {
      if (!signal?.aborted) setGithubBusy(false);
    }
  }, [githubUrl]);

  useEffect(() => {
    if (mode !== "github") {
      setGithubChecklist(null);
      return;
    }
    if (!verifyGithubLive) {
      const url = String(githubUrl || "").trim();
      if (!url) {
        setGithubChecklist(null);
        return;
      }
      setGithubChecklist({
        items: [
          {
            id: "github_url",
            label: "Lien GitHub renseigné",
            status: "ok",
            detail: url,
          },
          {
            id: "compose_root_github",
            label: "docker-compose à la racine du dépôt",
            status:
              githubComposeVerified === true
                ? "ok"
                : githubComposeVerified === false
                  ? "fail"
                  : "info",
            detail:
              githubComposeVerified === true
                ? "Validé (soumission ou test sandbox)."
                : githubComposeVerified === false
                  ? "Dernier test sandbox en échec — vérifiez la racine du dépôt."
                  : "Contrôlé à la soumission ; relancez « Tester (compose) » si besoin.",
          },
        ],
        ready: githubComposeVerified === true,
      });
      return;
    }
    const url = String(githubUrl || "").trim();
    if (url.length < 12) {
      setGithubChecklist(null);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(() => verifyGithub(controller.signal), 600);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [mode, githubUrl, verifyGithub, verifyGithubLive, githubComposeVerified]);

  const checklist = mode === "github" ? githubChecklist : fileChecklist;
  const ready = checklist?.ready;

  return (
    <div className={`compose-guide${compact ? " compose-guide--compact" : ""}`}>
      <button
        type="button"
        className="compose-guide__toggle btn btn-ghost btn-sm"
        onClick={() => setGuideOpen((v) => !v)}
        aria-expanded={guideOpen}
      >
        {guideOpen ? "Masquer le guide docker-compose" : "Guide : docker-compose à la racine"}
      </button>

      {guideOpen ? (
        <div className="compose-guide__body sandbox-hints-card" style={{ marginTop: 8 }}>
          <h4 className="sandbox-hints-card__title">Structure attendue</h4>
          <p className="diagram-item__meta">
            Les tests automatiques lancent <code className="inline-code">docker compose</code> depuis la{" "}
            <strong>racine</strong> du projet. Le fichier doit s’appeler{" "}
            <code className="inline-code">docker-compose.yml</code> ou{" "}
            <code className="inline-code">docker-compose.yaml</code>.
          </p>
          <pre className="compose-guide__tree" aria-label="Exemple de structure">
{`mon-projet/
├── docker-compose.yml    ← obligatoire, ici
├── README.md
├── frontend/
│   └── …
└── backend/
    └── …`}
          </pre>
          <p className="sandbox-hints-card__warn" style={{ marginTop: 10 }}>
            <strong>À éviter :</strong> <code>src/docker-compose.yml</code>,{" "}
            <code>docker/compose.yml</code>, ou un ZIP dont le compose est dans{" "}
            <code>mon-projet/sous-dossier/docker-compose.yml</code>.
          </p>
          <p className="diagram-item__meta" style={{ marginTop: 8 }}>
            <strong>GitHub :</strong> le fichier doit être visible à la racine du dépôt sur github.com
            (même niveau que README).
          </p>
          <p className="diagram-item__meta">
            <strong>En local :</strong>{" "}
            <code className="inline-code">docker compose config</code> puis{" "}
            <code className="inline-code">docker compose up</code>.
          </p>
        </div>
      ) : null}

      {(checklist?.items?.length || mode === "github") && (
        <div className="compose-guide__check" style={{ marginTop: guideOpen ? 12 : 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <strong>Checklist</strong>
            {ready === true ? (
              <span className="status-pill status-pill--ok">Prêt pour la soumission</span>
            ) : ready === false ? (
              <span className="status-pill status-pill--pending">À corriger</span>
            ) : null}
            {mode === "github" && githubBusy ? (
              <span className="diagram-item__meta">Vérification GitHub…</span>
            ) : null}
            {mode === "github" && verifyGithubLive ? (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={githubBusy || !String(githubUrl || "").trim()}
                onClick={() => verifyGithub(new AbortController().signal)}
              >
                Vérifier le dépôt
              </button>
            ) : null}
          </div>
          {checklist?.items?.length ? (
            <ChecklistRows items={checklist.items} />
          ) : mode === "file" && !files?.length && !submissionPaths?.length ? (
            <p className="diagram-item__meta" style={{ marginTop: 6 }}>
              Sélectionnez des fichiers ou un dossier pour remplir la checklist.
            </p>
          ) : null}
          {githubChecklist?.githubMessage ? (
            <p className="feedback feedback--err" style={{ marginTop: 8 }}>
              {githubChecklist.githubMessage}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Checklist compacte pour une soumission déjà enregistrée (enseignant). */
export function SubmissionComposeChecklist({ submission, composeAtRoot = null }) {
  const paths = useMemo(() => {
    if ((submission?.kind || "file") === "github") return null;
    const pf = Array.isArray(submission?.projectFiles) ? submission.projectFiles : [];
    return pf.map((p) => p.relativePath || p.storedName || "").filter(Boolean);
  }, [submission]);

  const githubVerified =
    submission?.sandboxOk === true
      ? true
      : submission?.sandboxOk === false && submission?.sandboxRanAt
        ? false
        : composeAtRoot === true
          ? true
          : composeAtRoot === false
            ? false
            : null;

  if ((submission?.kind || "file") === "github") {
    if (!submission.githubUrl) return null;
    return (
      <DockerComposeGuidePanel
        mode="github"
        githubUrl={submission.githubUrl}
        compact
        showGuideDefault={false}
        verifyGithubLive={false}
        githubComposeVerified={githubVerified}
      />
    );
  }

  if (!paths?.length) return null;

  return (
    <DockerComposeGuidePanel
      mode="file"
      submissionPaths={paths}
      compact
      showGuideDefault={false}
    />
  );
}
