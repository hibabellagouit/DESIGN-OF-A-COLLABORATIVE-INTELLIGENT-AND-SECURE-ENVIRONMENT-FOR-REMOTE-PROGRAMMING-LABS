import React from "react";
import { API_BASE } from "../apiBase";

export default function CahierFichierSection({ project }) {
  if (!project?._id || !project?.cahierFileStoredName) return null;

  const token = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}")?.token || "";
    } catch {
      return "";
    }
  })();

  const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : "";
  const viewUrl = `${API_BASE}/api/projects/${project._id}/cdc?token=${encodeURIComponent(token)}`;
  const downloadUrl = `${API_BASE}/api/projects/${project._id}/cdc?download=1${tokenQuery}`;
  const isPdf = (project.cahierFileMimeType || "").includes("pdf");

  return (
    <div className="cdc-block">
      <h4 className="cdc-block__title">Cahier des charges (fichier)</h4>
      <p className="cdc-block__filename">{project.cahierFileOriginalName || "Document joint"}</p>
      <div className="cdc-actions">
        <a className="btn btn-outline btn-sm" href={viewUrl} target="_blank" rel="noreferrer">
          Ouvrir
        </a>
        <a className="btn btn-primary btn-sm" href={downloadUrl}>
          Télécharger
        </a>
      </div>
      {isPdf && (
        <iframe
          title={`Aperçu — ${project.title || "cahier des charges"}`}
          className="cdc-iframe"
          src={viewUrl}
        />
      )}
    </div>
  );
}
