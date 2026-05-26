/** Normalise le login GitHub étudiant (sans @). */
export function normalizeStudentGithubUsername(raw) {
  const s = String(raw || "").trim().replace(/^@+/, "").slice(0, 39);
  if (!s) return "";
  if (!/^[a-zA-Z0-9-]+$/.test(s) || s.startsWith("-") || s.endsWith("-")) {
    return "";
  }
  return s;
}

export function studentHasGithubUsername(doc) {
  return Boolean(normalizeStudentGithubUsername(doc?.githubUsername || ""));
}

export const STUDENT_GITHUB_REQUIRED_MESSAGE =
  "Un identifiant GitHub valide est obligatoire (sans @ · lettres, chiffres, tirets).";
