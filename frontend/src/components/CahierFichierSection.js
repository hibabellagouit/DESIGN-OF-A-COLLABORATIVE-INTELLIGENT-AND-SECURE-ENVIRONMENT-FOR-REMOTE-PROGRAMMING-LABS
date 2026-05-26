import React from "react";
import { API_BASE } from "../apiBase";

export default function CahierFichierSection({ project }) {
  const hasCdc = Boolean(project?._id && project?.cahierFileStoredName);
  const hasCompose = Boolean(project?._id && project?.composeFileStoredName);
  if (!hasCdc && !hasCompose) return null;

  const token = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}")?.token || "";
    } catch {
      return "";
    }
  })();

  const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : "";

  const cdcViewUrl = `${API_BASE}/api/projects/${project._id}/cdc?token=${encodeURIComponent(token)}`;
  const cdcDownloadUrl = `${API_BASE}/api/projects/${project._id}/cdc?download=1${tokenQuery}`;

  const composeDownloadUrl = `${API_BASE}/api/projects/${project._id}/compose?download=1${tokenQuery}`;
  const isPdf = hasCdc && (project.cahierFileMimeType || "").includes("pdf");

  return (
    <>
      {hasCdc ? (
        <div className="cdc-block">
          <h4 className="cdc-block__title">Cahier des charges (fichier)</h4>
          <p className="cdc-block__filename">{project.cahierFileOriginalName || "Document joint"}</p>
          <div className="cdc-actions">
            <a className="btn btn-outline btn-sm" href={cdcViewUrl} target="_blank" rel="noreferrer">
              Ouvrir
            </a>
            <a className="btn btn-primary btn-sm" href={cdcDownloadUrl}>
              Télécharger
            </a>
          </div>
          {isPdf ? (
            <iframe
              title={`Aperçu — ${project.title || "cahier des charges"}`}
              className="cdc-iframe"
              src={cdcViewUrl}
            />
          ) : null}
        </div>
      ) : null}

      {hasCompose ? (
        <div className="cdc-block" style={{ marginTop: hasCdc ? "1rem" : 0 }}>
          <h4 className="cdc-block__title">Référence Docker (docker-compose)</h4>
          <p className="cdc-block__filename">{project.composeFileOriginalName || "docker-compose.yml"}</p>
          <p className="diagram-item__meta" style={{ marginTop: 6 }}>
            Modèle livré par l&apos;enseignant — les tests utilisent Docker. Votre dépôt ou vos fichiers doivent
            inclure <strong>docker-compose.yml</strong> (ou .yaml) <strong>à la racine</strong> (voir guide sur la
            page Soumission).
          </p>
          <div className="cdc-actions">
            <a className="btn btn-primary btn-sm" href={composeDownloadUrl}>
              Télécharger
            </a>
          </div>
        </div>
      ) : null}
    </>
  );
}
