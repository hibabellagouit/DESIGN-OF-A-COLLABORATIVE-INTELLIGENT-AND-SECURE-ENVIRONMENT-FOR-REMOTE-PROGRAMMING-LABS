import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { spawn } from "child_process";
import AdmZip from "adm-zip";
import { parseGithubRepoForApi } from "../utils/githubUrl.js";
import { findComposeFileInWorkspace } from "../utils/dockerComposePaths.js";
import { resolveGithubToken } from "../utils/githubToken.js";

function githubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "le-projet-labs",
  };
  const token = resolveGithubToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function runGit(args, { cwd, timeoutMs = 300000 }) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd, windowsHide: true });
    let stderr = "";
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
      reject(new Error("git : délai dépassé"));
    }, timeoutMs);
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(err.code === "ENOENT" ? "Git n’est pas installé sur le serveur." : err.message));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(true);
      else reject(new Error(stderr.trim() || `git exit ${code}`));
    });
  });
}

function extractTarballZip(buffer, destDir) {
  const tmpZip = path.join(os.tmpdir(), `gh-tar-${crypto.randomUUID()}.zip`);
  fs.writeFileSync(tmpZip, buffer);
  try {
    const zip = new AdmZip(tmpZip);
    const entries = zip.getEntries();
    const rootPrefix = entries.find((e) => e.entryName.includes("/"))?.entryName.split("/")[0];
    zip.extractAllTo(destDir, true);
    if (rootPrefix) {
      const nested = path.join(destDir, rootPrefix);
      if (fs.existsSync(nested) && fs.statSync(nested).isDirectory()) {
        for (const name of fs.readdirSync(nested)) {
          const src = path.join(nested, name);
          const dst = path.join(destDir, name);
          if (fs.existsSync(dst)) {
            fs.rmSync(dst, { recursive: true, force: true });
          }
          fs.renameSync(src, dst);
        }
        fs.rmSync(nested, { recursive: true, force: true });
      }
    }
  } finally {
    try {
      fs.unlinkSync(tmpZip);
    } catch {
      /* ignore */
    }
  }
}

async function cloneViaTarball(owner, repo, destDir) {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zipball/HEAD`;
  const res = await fetch(url, { headers: githubHeaders(), redirect: "follow" });
  if (!res.ok) {
    const hint =
      res.status === 404
        ? " Dépôt introuvable ou privé — configurez GITHUB_TOKEN."
        : res.status === 403
          ? " Accès refusé par GitHub."
          : "";
    throw new Error(`Téléchargement GitHub impossible (${res.status}).${hint}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(destDir, { recursive: true });
  extractTarballZip(buf, destDir);
}

/**
 * Clone un dépôt GitHub dans destDir (git si disponible, sinon archive ZIP GitHub).
 */
export async function cloneGithubRepoToDir(githubUrl, destDir) {
  const repoInfo = parseGithubRepoForApi(githubUrl);
  if (!repoInfo.ok) throw new Error(repoInfo.message);
  const { owner, repo } = repoInfo;

  fs.mkdirSync(destDir, { recursive: true });
  const token = resolveGithubToken();
  const authUrl = token
    ? `https://x-access-token:${token}@github.com/${owner}/${repo}.git`
    : `https://github.com/${owner}/${repo}.git`;

  try {
    await runGit(["clone", "--depth", "1", authUrl, destDir]);
    return { method: "git" };
  } catch (gitErr) {
    if (fs.existsSync(destDir)) {
      try {
        fs.rmSync(destDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      fs.mkdirSync(destDir, { recursive: true });
    }
    try {
      await cloneViaTarball(owner, repo, destDir);
      return { method: "tarball" };
    } catch (tarErr) {
      throw new Error(
        `${gitErr.message || "git indisponible"} ; repli archive : ${tarErr.message || "échec"}`
      );
    }
  }
}

/**
 * Prépare un workspace à partir d’une URL GitHub (pour Docker Compose).
 */
export async function prepareGithubSubmissionWorkspace(githubUrl) {
  const workDir = path.join(os.tmpdir(), `compose-gh-${crypto.randomUUID()}`);
  fs.mkdirSync(workDir, { recursive: true });
  const cleanup = () => {
    try {
      if (workDir && fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true });
      }
    } catch {
      /* ignore */
    }
  };
  try {
    await cloneGithubRepoToDir(githubUrl, workDir);
    const composeFilePath = findComposeFileInWorkspace(workDir);
    if (!composeFilePath) {
      throw new Error(
        "docker-compose.yml (ou .yaml) introuvable à la racine du dépôt GitHub."
      );
    }
    return { workDir, composeFilePath, cleanup };
  } catch (e) {
    cleanup();
    throw e;
  }
}
