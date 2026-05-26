import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const CDC_DIR = path.join(__dirname, "../uploads/cdc");
export const COMPOSE_DIR = path.join(__dirname, "../uploads/compose");

const cdcAllowed = /\.(pdf|docx?|txt|md|odt)$/i;
/** docker-compose doit être livré sous .yml ou .yaml uniquement */
const composeAllowed = /\.(ya?ml)$/i;

const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    if (file.fieldname === "composeFile") {
      fs.mkdirSync(COMPOSE_DIR, { recursive: true });
      cb(null, COMPOSE_DIR);
    } else {
      fs.mkdirSync(CDC_DIR, { recursive: true });
      cb(null, CDC_DIR);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "") || "";
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (file.fieldname === "composeFile") {
    if (!composeAllowed.test(file.originalname || "")) {
      return cb(
        new Error("docker-compose obligatoire : fichier .yml ou .yaml (ex. docker-compose.yml)")
      );
    }
    return cb(null, true);
  }
  if (file.fieldname === "cahierFile") {
    if (!cdcAllowed.test(file.originalname || "")) {
      return cb(new Error("Type non autorisé : PDF, Word (.doc/.docx), TXT, Markdown, ODT"));
    }
    return cb(null, true);
  }
  cb(new Error("Champ fichier inconnu (cahierFile ou composeFile)"));
}

/** Cahier optionnel · docker-compose obligatoire (contrôleur) */
export const uploadProjectArtifacts = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 2,
  },
  fileFilter,
}).fields([
  { name: "cahierFile", maxCount: 1 },
  { name: "composeFile", maxCount: 1 },
]);
