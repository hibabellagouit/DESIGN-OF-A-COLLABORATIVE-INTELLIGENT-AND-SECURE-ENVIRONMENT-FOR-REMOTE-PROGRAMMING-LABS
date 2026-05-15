/** Affichage des statuts de soumission (API normalise submitted/reviewed) */

export function displaySubmissionStatus(raw) {
  const s = String(raw || "").trim();
  if (s === "submitted") return "en attente";
  if (s === "reviewed") return "évalué";
  return s || "en attente";
}

export function submissionStatusLabel(raw) {
  const d = displaySubmissionStatus(raw);
  if (d === "en attente") return "En attente";
  if (d === "en cours d'évaluation") return "En cours d'évaluation";
  if (d === "évalué") return "Évalué";
  return d;
}

export function submissionStatusPillClass(raw) {
  const d = displaySubmissionStatus(raw);
  if (d === "en attente") return "status-pill status-pill--pending";
  if (d === "en cours d'évaluation") return "status-pill status-pill--current";
  if (d === "évalué") return "status-pill status-pill--ok";
  return "status-pill";
}
