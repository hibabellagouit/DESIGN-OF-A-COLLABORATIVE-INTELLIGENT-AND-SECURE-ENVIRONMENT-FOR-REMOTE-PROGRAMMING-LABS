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

/**
 * Extrait owner/repo pour l’API GitHub (Commits). Gist exclus.
 */
export function parseGithubRepoForApi(urlString) {
  const parsed = parseGithubSubmissionUrl(urlString);
  if (!parsed.ok) {
    return { ok: false, message: parsed.message };
  }
  let u;
  try {
    u = new URL(parsed.url);
  } catch {
    return { ok: false, message: "URL invalide" };
  }
  const host = u.hostname.toLowerCase();
  if (host === "gist.github.com" || host.startsWith("gist.")) {
    return { ok: false, message: "L’analyse des commits ne s’applique pas aux gists." };
  }
  if (host !== "github.com" && host !== "www.github.com") {
    return { ok: false, message: "Seuls les dépôts sur github.com sont pris en charge." };
  }
  const segs = u.pathname
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);
  if (segs.length < 2) {
    return { ok: false, message: "URL de dépôt incomplète (attendu : …/propriétaire/nom-du-depot)." };
  }
  const owner = segs[0];
  let repo = segs[1].replace(/\.git$/i, "");
  return { ok: true, owner, repo };
}

function normalizeEmail(s) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

/**
 * Associe un commit API GitHub à un étudiant (e-mail puis login GitHub).
 */
export function matchCommitToStudent(commit, students) {
  const email = normalizeEmail(commit?.commit?.author?.email);
  const login = (commit?.author?.login || "").trim().toLowerCase();

  if (email.endsWith("@users.noreply.github.com")) {
    const m = email.match(/^(\d+)\+([^@]+)@users\.noreply\.github\.com$/);
    if (m && m[2]) {
      const implied = m[2].trim().toLowerCase();
      for (const stu of students) {
        const gu = String(stu.githubUsername || "").trim().toLowerCase();
        if (gu && gu === implied) {
          return { student: stu, match: "githubUsername" };
        }
      }
    }
  }

  for (const stu of students) {
    if (email && normalizeEmail(stu.email) === email) {
      return { student: stu, match: "email" };
    }
  }
  if (login) {
    for (const stu of students) {
      const gu = String(stu.githubUsername || "").trim().toLowerCase();
      if (gu && gu === login) {
        return { student: stu, match: "githubUsername" };
      }
    }
  }
  return null;
}
