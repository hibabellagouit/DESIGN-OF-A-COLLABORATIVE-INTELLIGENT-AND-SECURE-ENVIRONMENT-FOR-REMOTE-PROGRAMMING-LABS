import fs from "fs";
import path from "path";
import Project from "../models/Project.js";
import { CDC_DIR } from "../middleware/cdcUpload.js";

function parseBody(req) {
  const raw = req.body;
  const b =
    raw !== undefined && raw !== null && typeof raw === "object" && !Buffer.isBuffer(raw)
      ? raw
      : {};
  return {
    title: b.title,
    description: b.description,
    niveau: Number(b.niveau),
    maxStudents: Number(b.maxStudents),
    cahierDeCharge: b.cahierDeCharge || "",
    referenceKind: b.referenceKind || "autre",
    referenceValidation: b.referenceValidation || "",
  };
}

export const createProject = async (req, res) => {
  try {
    const fields = parseBody(req);

    if (!fields.title?.trim()) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ message: "Titre requis" });
    }

    const project = new Project({
      ...fields,
      referenceKind: ["repo", "stack", "sandbox", "tests", "autre"].includes(
        fields.referenceKind
      )
        ? fields.referenceKind
        : "autre",
    });

    if (req.file) {
      project.cahierFileOriginalName = req.file.originalname;
      project.cahierFileStoredName = req.file.filename;
      project.cahierFileMimeType = req.file.mimetype;
    }

    await project.save();
    res.status(201).json({ message: "Project created", project });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
};

export const getProjects = async (req, res) => {
  try {
    const projects = await Project.find();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Stream du fichier CDC : inline (aperçu) ou attachment (téléchargement) */
export const streamCahierFile = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Projet introuvable" });
    }
    if (!project.cahierFileStoredName) {
      return res.status(404).json({ message: "Aucun fichier cahier des charges" });
    }

    const filePath = path.join(CDC_DIR, project.cahierFileStoredName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Fichier introuvable sur le serveur" });
    }

    const download = req.query.download === "1";
    const encodedName = encodeURIComponent(
      project.cahierFileOriginalName || "cahier-des-charges"
    );

    res.setHeader(
      "Content-Type",
      project.cahierFileMimeType || "application/octet-stream"
    );
    res.setHeader(
      "Content-Disposition",
      download
        ? `attachment; filename*=UTF-8''${encodedName}`
        : `inline; filename*=UTF-8''${encodedName}`
    );

    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
