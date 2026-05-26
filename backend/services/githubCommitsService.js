/**
 * API REST GitHub v3 — contributeurs (léger) ou liste de commits (repli).
 */

import { formatGithubApiError } from "../utils/githubApiError.js";
import { resolveGithubToken } from "../utils/githubToken.js";

const USER_AGENT = "tp-projets-edu/1.0";
const FETCH_TIMEOUT_MS = 20_000;
const PER_PAGE = 100;

function maxCommitPages() {
  const fromEnv = Number(process.env.GITHUB_COMMITS_MAX_PAGES);
  if (Number.isFinite(fromEnv) && fromEnv >= 1 && fromEnv <= 50) {
    return Math.floor(fromEnv);
  }
  return resolveGithubToken() ? 10 : 3;
}

function githubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": USER_AGENT,
  };
  const token = resolveGithubToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function githubApiGet(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: githubHeaders(), signal: controller.signal });
    const text = await res.text();
    if (!res.ok) {
      const { message, status } = formatGithubApiError(text, res.status);
      const err = new Error(message);
      err.status = status || res.status;
      throw err;
    }
    try {
      return text ? JSON.parse(text) : [];
    } catch {
      const { message, status } = formatGithubApiError(text, res.status);
      const err = new Error(message);
      err.status = status || 502;
      throw err;
    }
  } catch (e) {
    if (e.name === "AbortError") {
      const err = new Error(
        "Délai dépassé en contactant GitHub. Réessayez ou configurez GITHUB_TOKEN."
      );
      err.status = 504;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Contributeurs du dépôt (1 requête) — adapté au suivi d’équipe.
 * @returns {Promise<Array<{ login: string, contributions: number }>>}
 */
export async function fetchContributorsForRepo(owner, repo) {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contributors?per_page=100&anon=1`;
  const data = await githubApiGet(url);
  if (!Array.isArray(data)) {
    return [];
  }
  return data
    .filter((c) => c && (c.login || c.id != null))
    .map((c) => ({
      login: String(c.login || `anonymous-${c.id}`).trim(),
      contributions: Number(c.contributions) || 0,
    }));
}

async function fetchCommitsPage(owner, repo, page) {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=${PER_PAGE}&page=${page}`;
  const data = await githubApiGet(url);
  return Array.isArray(data) ? data : [];
}

/**
 * @param {string} owner
 * @param {string} repo
 * @returns {{ commits: Array, truncated: boolean, totalFetched: number }}
 */
export async function fetchAllCommitsForRepo(owner, repo) {
  const maxPages = maxCommitPages();
  const all = [];
  const seenSha = new Set();
  let page = 1;
  let truncated = false;
  while (page <= maxPages) {
    const batch = await fetchCommitsPage(owner, repo, page);
    if (!batch.length) break;
    for (const c of batch) {
      const sha = c?.sha || "";
      if (sha && !seenSha.has(sha)) {
        seenSha.add(sha);
        all.push(c);
      }
    }
    if (batch.length < PER_PAGE) break;
    if (page === maxPages) {
      truncated = true;
      break;
    }
    page += 1;
  }
  return { commits: all, truncated, totalFetched: all.length };
}
