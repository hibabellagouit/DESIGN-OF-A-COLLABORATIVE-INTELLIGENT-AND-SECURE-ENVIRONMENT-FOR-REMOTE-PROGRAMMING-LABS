import React from "react";
import Modal from "./Modal";
import { REFERENCE_KIND_LABELS } from "../referenceLabels";
import CahierFichierSection from "./CahierFichierSection";

export default function ProjectDetailModal({ project, isOpen, onClose, footer }) {
  if (!project) return null;
  const kind = project.referenceKind || "autre";
  const kindLabel = REFERENCE_KIND_LABELS[kind] || REFERENCE_KIND_LABELS.autre;

  return (
    <Modal isOpen={isOpen} title={project.title || "Détail du projet"} onClose={onClose}>
      <div className="project-detail-modal">
        <p className="diagram-item__meta" style={{ marginTop: 0 }}>
          Niveau {project.niveau ?? "—"}
          {typeof project.teamsAvailable === "number" ? (
            <>
              {" "}
              · {project.teamsAvailable} place{project.teamsAvailable > 1 ? "s" : ""} équipe
              {project.teamsAvailable > 1 ? "s" : ""}
            </>
          ) : project.maxStudents ? (
            <> · max. {project.maxStudents} équipe{project.maxStudents > 1 ? "s" : ""}</>
          ) : null}
        </p>
        {project.description ? (
          <div className="project-detail-modal__block">
            <h4 className="project-detail-modal__label">Description</h4>
            <p className="diagram-card-head__hint" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
              {project.description}
            </p>
          </div>
        ) : null}
        {project.cahierDeCharge ? (
          <div className="project-detail-modal__block">
            <h4 className="project-detail-modal__label">Résumé du cahier des charges</h4>
            <p className="diagram-card-head__hint" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
              {project.cahierDeCharge}
            </p>
          </div>
        ) : null}
        <CahierFichierSection project={project} />
        {project.referenceValidation ? (
          <div className="reference-box" style={{ marginTop: "1rem" }}>
            <span className="project-card__label">{kindLabel}</span>
            <p className="reference-box__text">{project.referenceValidation}</p>
          </div>
        ) : null}
        {footer ? <div className="project-detail-modal__footer">{footer}</div> : null}
      </div>
    </Modal>
  );
}
