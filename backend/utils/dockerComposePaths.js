import fs from "fs";
import path from "path";
import { safeUploadRelativePath } from "./uploadPath.js";

const COMPOSE_BASENAMES = new Set(["docker-compose.yml", "docker-compose.yaml"]);

export function isDockerComposeBasename(name) {
  const base = path.basename(String(name || "").replace(/\\/g, "/")).toLowerCase();
  return COMPOSE_BASENAMES.has(base);
}

/** Chemin relatif normalisé = docker-compose à la racine du dépôt (pas dans un sous-dossier). */
export function relativePathIsRootDockerCompose(relativePath) {
  const norm = safeUploadRelativePath(relativePath).toLowerCase();
  return COMPOSE_BASENAMES.has(norm);
}

/** Entrée d’archive ZIP : fichier compose directement à la racine du ZIP. */
export function zipEntryIsRootDockerCompose(entryName) {
  const norm = String(entryName || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = norm.split("/").filter(Boolean);
  if (parts.length !== 1) return false;
  return COMPOSE_BASENAMES.has(parts[0].toLowerCase());
}

export function uploadBasenamesIncludeRootDockerCompose(originalNames) {
  const names = Array.isArray(originalNames) ? originalNames : [];
  return names.some((n) => relativePathIsRootDockerCompose(n));
}

export function findComposeFileInWorkspace(workDir) {
  for (const name of ["docker-compose.yml", "docker-compose.yaml"]) {
    const p = path.join(workDir, name);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}
