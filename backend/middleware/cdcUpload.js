import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CDC_DIR = path.join(__dirname, "../uploads/cdc");

const allowedExt = /\.(pdf|docx?|txt|md|odt)$/i;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(CDC_DIR, { recursive: true });
    cb(null, CDC_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "") || "";
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (!allowedExt.test(file.originalname || "")) {
    return cb(new Error("Type non autorisé : PDF, Word (.doc/.docx), TXT, Markdown, ODT"));
  }
  cb(null, true);
}

export const uploadCdc = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter,
});

export { CDC_DIR };
