/**
 * Valide et normalise une URL de dépôt GitHub (https uniquement).
 * @param {string} raw
 * @returns {{ ok: boolean, url?: string, message?: string }}
 */
export function parseGithubSubmissionUrl(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    return { ok: false, message: "Lien GitHub requis" };
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, message: "URL invalide" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, message: "Utilisez une adresse https://github.com/…" };
  }
  const host = parsed.hostname.toLowerCase();
  const allowed =
    host === "github.com" ||
    host === "www.github.com" ||
    host === "gist.github.com" ||
    host.endsWith(".github.com");
  if (!allowed) {
    return { ok: false, message: "Seuls les liens github.com ou gist.github.com sont acceptés" };
  }

  // URL de clonage « …/repo.git » → même dépôt que la page web « …/repo »
  let pathname = parsed.pathname || "";
  if (/\.git$/i.test(pathname)) {
    pathname = pathname.slice(0, -4) || "/";
    parsed.pathname = pathname;
  }

  return { ok: true, url: parsed.toString() };
}
