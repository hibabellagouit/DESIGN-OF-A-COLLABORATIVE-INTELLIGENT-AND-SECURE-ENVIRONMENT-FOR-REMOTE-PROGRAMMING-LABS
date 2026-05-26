import { parseGithubRepoForApi } from "../utils/githubUrl.js";
import { formatGithubApiError } from "../utils/githubApiError.js";
import { resolveGithubToken } from "../utils/githubToken.js";

const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = "tp-projets-edu/1.0";

function githubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": USER_AGENT,
  };
  const token = resolveGithubToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function fetchComposeFileExists(owner, repo, file) {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${file}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: githubHeaders(), signal: controller.signal });
    const text = await res.text();
    if (res.status === 200) return { ok: true };
    if (res.status === 404) return { ok: false, notFound: true };
    if (res.status === 401) {
      return {
        ok: false,
        message:
          "Token GitHub invalide ou expiré (Bad credentials). Corrigez GITHUB_TOKEN dans backend/.env " +
          "(https://github.com/settings/tokens) ou commentez la ligne pour un dépôt public, puis redémarrez le serveur.",
      };
    }
    if (res.status === 403) {
      return {
        ok: false,
        message:
          "Impossible de vérifier le dépôt GitHub (accès refusé). Pour un dépôt privé, configurez GITHUB_TOKEN sur le serveur.",
      };
    }
    if (res.status === 429) {
      return {
        ok: false,
        message: "Limite d’API GitHub atteinte — réessayez plus tard ou ajoutez GITHUB_TOKEN.",
      };
    }
    const { message } = formatGithubApiError(text, res.status);
    return { ok: false, message: `Vérification GitHub impossible : ${message}` };
  } catch (e) {
    if (e.name === "AbortError") {
      return {
        ok: false,
        message:
          "GitHub n’a pas répondu à temps lors de la vérification du docker-compose. Réessayez ou ajoutez GITHUB_TOKEN.",
      };
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Vérifie la présence de docker-compose.yml ou .yaml à la racine du dépôt GitHub.
 */
export async function githubRepoHasRootDockerCompose(urlString) {
  if (process.env.INTEGRATION_TEST_MOCK_GITHUB === "true") {
    return { ok: true, mocked: true };
  }
  const repoInfo = parseGithubRepoForApi(urlString);
  if (!repoInfo.ok) {
    return { ok: false, message: repoInfo.message };
  }
  const { owner, repo } = repoInfo;

  for (const file of ["docker-compose.yml", "docker-compose.yaml"]) {
    const hit = await fetchComposeFileExists(owner, repo, file);
    if (hit.ok) return { ok: true };
    if (hit.message) return { ok: false, message: hit.message };
  }

  return {
    ok: false,
    message:
      "Le dépôt GitHub doit contenir docker-compose.yml ou docker-compose.yaml à la racine (environnement Docker pour les tests).",
  };
}
