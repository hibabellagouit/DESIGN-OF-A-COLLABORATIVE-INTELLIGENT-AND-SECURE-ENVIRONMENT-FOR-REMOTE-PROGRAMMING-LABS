import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { SUBMISSIONS_DIR } from "../middleware/submissionUpload.js";

const TEXT_EXT = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  ".json", ".md", ".txt", ".yml", ".yaml",
  ".html", ".css", ".py", ".java", ".go", ".rs",
  ".env.example", ".gitignore",
]);

const PRIORITY_NAMES = [
  /^readme/i,
  /docker-compose\.ya?ml$/i,
  /^package\.json$/i,
  /^composer\.json$/i,
  /^requirements\.txt$/i,
  /^pom\.xml$/i,
];

const MAX_FILES = 24;
const MAX_BYTES_PER_FILE = 6000;
const MAX_TOTAL_BYTES = 48_000;

function isTextFile(relPath) {
  const base = path.basename(relPath).toLowerCase();
  if (PRIORITY_NAMES.some((re) => re.test(base))) return true;
  const ext = path.extname(relPath).toLowerCase();
  return TEXT_EXT.has(ext);
}

function scoreFile(relPath) {
  const base = path.basename(relPath);
  for (let i = 0; i < PRIORITY_NAMES.length; i++) {
    if (PRIORITY_NAMES[i].test(base)) return 100 - i;
  }
  const depth = relPath.split(/[/\\]/).length;
  return Math.max(0, 40 - depth);
}

function readSnippet(absPath, relPath) {
  try {
    const stat = fs.statSync(absPath);
    if (!stat.isFile() || stat.size > 512_000) return null;
    const buf = fs.readFileSync(absPath);
    const slice = buf.subarray(0, MAX_BYTES_PER_FILE);
    return {
      path: relPath.replace(/\\/g, "/"),
      size: stat.size,
      content: slice.toString("utf8"),
    };
  } catch {
    return null;
  }
}

function collectFromDir(rootDir, prefix = "") {
  const found = [];
  function walk(dir, relPrefix) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name === "node_modules" || ent.name === ".git" || ent.name === "dist" || ent.name === "build") {
        continue;
      }
      const rel = relPrefix ? `${relPrefix}/${ent.name}` : ent.name;
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(abs, rel);
      else if (isTextFile(rel)) found.push({ rel, abs, score: scoreFile(rel) });
    }
  }
  walk(rootDir, prefix);
  found.sort((a, b) => b.score - a.score);
  return found;
}

function extractZipToTemp(zipPath) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  const snippets = [];
  const fileList = [];
  for (const e of entries.slice(0, 200)) {
    const rel = e.entryName.replace(/\\/g, "/");
    fileList.push(rel);
    if (!isTextFile(rel)) continue;
    const score = scoreFile(rel);
    snippets.push({ rel, score, getContent: () => e.getData().toString("utf8") });
  }
  snippets.sort((a, b) => b.score - a.score);
  return { fileList, snippets };
}

/**
 * Construit le contexte textuel envoyé à Ollama pour une soumission.
 */
export function buildSubmissionAiContext(sub, project) {
  const kind = sub.kind || "file";
  const lines = [];
  lines.push(`Projet : ${project?.title || "—"}`);
  lines.push(`Niveau : ${project?.niveau ?? "—"}`);
  if (project?.description) lines.push(`Description : ${project.description}`);
  if (project?.cahierDeCharge) lines.push(`Cahier des charges (résumé) : ${project.cahierDeCharge}`);
  if (project?.referenceValidation) {
    lines.push(`Référence validation : ${project.referenceValidation}`);
  }

  lines.push("");
  lines.push(`Type de soumission : ${kind === "github" ? "GitHub" : "fichiers"}`);
  if (kind === "github" && sub.githubUrl) {
    lines.push(`URL dépôt : ${sub.githubUrl}`);
    lines.push(
      "(Le contenu du dépôt n’est pas entièrement analysé ici — évaluez prudemment le code à partir des métadonnées.)"
    );
    return {
      promptText: lines.join("\n"),
      fileSnippets: [],
      fileTree: [],
    };
  }

  const entries = Array.isArray(sub.projectFiles) ? sub.projectFiles : [];
  const bundleId = sub.bundleId;
  const fileTree = entries.map((e) => e.relativePath || e.storedName).filter(Boolean);
  lines.push(`Fichiers déposés (${fileTree.length}) :`);
  for (const f of fileTree.slice(0, 80)) lines.push(`- ${f}`);

  const snippets = [];
  let totalBytes = 0;

  if (bundleId && entries.length > 0) {
    const bundleDir = path.join(SUBMISSIONS_DIR, "bundles", bundleId);
    if (entries.length === 1 && /\.zip$/i.test(entries[0].relativePath || "")) {
      const zipPath = path.join(bundleDir, entries[0].storedName);
      if (fs.existsSync(zipPath)) {
        const { fileList, snippets: zipSnips } = extractZipToTemp(zipPath);
        for (const s of zipSnips) {
          if (snippets.length >= MAX_FILES || totalBytes >= MAX_TOTAL_BYTES) break;
          const content = s.getContent().slice(0, MAX_BYTES_PER_FILE);
          totalBytes += content.length;
          snippets.push({ path: s.rel, content });
        }
        if (fileList.length) {
          lines.push("");
          lines.push("Contenu archive (liste) :");
          for (const f of fileList.slice(0, 60)) lines.push(`- ${f}`);
        }
      }
    } else {
      const candidates = [];
      for (const entry of entries) {
        const rel = entry.relativePath || entry.storedName;
        const abs = path.join(bundleDir, entry.storedName);
        if (!rel || !entry.storedName || !fs.existsSync(abs)) continue;
        if (!isTextFile(rel)) continue;
        candidates.push({ rel, abs, score: scoreFile(rel) });
      }
      candidates.sort((a, b) => b.score - a.score);
      for (const c of candidates) {
        if (snippets.length >= MAX_FILES || totalBytes >= MAX_TOTAL_BYTES) break;
        const sn = readSnippet(c.abs, c.rel);
        if (!sn) continue;
        totalBytes += sn.content.length;
        snippets.push(sn);
      }
    }
  }

  if (snippets.length) {
    lines.push("");
    lines.push("Extraits de fichiers :");
    for (const sn of snippets) {
      lines.push("");
      lines.push(`--- ${sn.path} (${sn.size ?? "?"} octets) ---`);
      lines.push(sn.content);
    }
  }

  return {
    promptText: lines.join("\n"),
    fileSnippets: snippets,
    fileTree,
  };
}
