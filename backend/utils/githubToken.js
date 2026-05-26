/** Indique si GITHUB_TOKEN doit être envoyé à l’API GitHub. */
export function resolveGithubToken() {
  const raw = String(process.env.GITHUB_TOKEN || "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (
    lower === "ghp_votre_token" ||
    lower === "ghp_..." ||
    lower.startsWith("ghp_xxx") ||
    lower.includes("votre_token") ||
    lower.includes("your_token") ||
    raw.length < 20
  ) {
    return null;
  }
  return raw;
}
