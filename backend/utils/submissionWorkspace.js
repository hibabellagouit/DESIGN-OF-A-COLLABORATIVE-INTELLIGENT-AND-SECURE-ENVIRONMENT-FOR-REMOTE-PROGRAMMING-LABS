import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import AdmZip from "adm-zip";
import { SUBMISSIONS_DIR } from "../middleware/submissionUpload.js";
import { findComposeFileInWorkspace } from "./dockerComposePaths.js";

function safeRm(dirPath) {
  try {
    if (dirPath && fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch {
    // ignore
  }
}

/**
 * Copie les fichiers d’une soumission dans un répertoire temporaire (extraction ZIP si besoin).
 * @returns {{ workDir: string, composeFilePath: string, cleanup: () => void }}
 */
export function prepareSubmissionWorkspace(sub) {
  const entries = Array.isArray(sub.projectFiles) ? sub.projectFiles : [];
  const bundleId = sub.bundleId;
  if (!bundleId || entries.length === 0) {
    throw new Error("Soumission sans fichiers projet.");
  }

  const bundleDir = path.join(SUBMISSIONS_DIR, "bundles", bundleId);
  const workDir = path.join(os.tmpdir(), `compose-ws-${crypto.randomUUID()}`);
  fs.mkdirSync(workDir, { recursive: true });

  const cleanup = () => safeRm(workDir);

  try {
    if (entries.length === 1) {
      const one = entries[0];
      const rel = String(one.relativePath || one.storedName || "");
      if (/\.zip$/i.test(rel)) {
        const zipPath = path.join(bundleDir, one.storedName);
        if (!fs.existsSync(zipPath)) {
          throw new Error("Archive ZIP introuvable sur le serveur.");
        }
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(workDir, true);
        const composeFilePath = findComposeFileInWorkspace(workDir);
        if (!composeFilePath) {
          throw new Error(
            "docker-compose.yml (ou .yaml) introuvable à la racine de l’archive ZIP."
          );
        }
        return { workDir, composeFilePath, cleanup };
      }
    }

    for (const entry of entries) {
      const src = path.join(bundleDir, entry.storedName);
      if (!entry.storedName || !fs.existsSync(src)) continue;
      const rel = entry.relativePath || entry.storedName;
      const dest = path.join(workDir, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }

    const composeFilePath = findComposeFileInWorkspace(workDir);
    if (!composeFilePath) {
      throw new Error(
        "docker-compose.yml (ou .yaml) introuvable à la racine des fichiers remis."
      );
    }

    return { workDir, composeFilePath, cleanup };
  } catch (e) {
    cleanup();
    throw e;
  }
}
