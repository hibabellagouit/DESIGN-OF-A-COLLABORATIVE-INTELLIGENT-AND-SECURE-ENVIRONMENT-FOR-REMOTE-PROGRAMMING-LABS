/** Statuts métier (soumission). Anciennes valeurs : submitted / reviewed */
export const SUBMISSION_STATUSES = ["en attente", "en cours d'évaluation", "évalué"];

/** Pour règles de transition */
export function submissionStatusForRules(raw) {
  const s = String(raw || "").trim();
  if (s === "submitted") return "en attente";
  if (s === "reviewed") return "évalué";
  return s;
}

/** Réponse API : toujours les libellés métier */
export function submissionStatusForApi(raw) {
  return submissionStatusForRules(raw);
}

export function canChangeSubmissionStatus(fromRaw, toRaw) {
  const from = submissionStatusForRules(fromRaw);
  const to = String(toRaw || "").trim();
  if (!SUBMISSION_STATUSES.includes(to)) return false;
  if (from === "en attente") {
    return to === "en cours d'évaluation" || to === "évalué";
  }
  if (from === "en cours d'évaluation") {
    return to === "évalué";
  }
  if (from === "évalué") return false;
  return false;
}
