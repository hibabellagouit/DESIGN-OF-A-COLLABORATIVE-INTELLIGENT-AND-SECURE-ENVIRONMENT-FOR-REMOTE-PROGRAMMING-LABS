import path from "path";

/**
 * Normalise un chemin relatif envoyé par le client (ex. dossier webkit) : pas de .. ni de segments vides.
 */
export function safeUploadRelativePath(raw) {
  const s = String(raw || "fichier")
    .replace(/\\/g, "/")
    .trim();
  const parts = s
    .split("/")
    .map((p) => p.trim())
    .filter((p) => p && p !== "." && p !== "..");
  if (!parts.length) return "fichier";
  return parts.join("/");
}

export function extensionFromUploadName(name) {
  const base = path.basename(String(name || ""));
  const ext = path.extname(base);
  return ext || "";
}
