import fs from "fs";
import path from "path";
import Project from "../models/Project.js";
import Assignment from "../models/Assignment.js";
import Submission from "../models/Submission.js";
import { getPublicSandboxHints } from "../services/dockerSandbox.js";
import { CDC_DIR } from "../middleware/cdcUpload.js";
import { submissionStatusForApi } from "../utils/submissionStatus.js";

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}

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
      safeUnlink(req.file?.path);
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
    safeUnlink(req.file?.path);
    res.status(500).json({ error: error.message });
  }
};

export const getProjects = async (req, res) => {
  try {
    const projects = await Project.find().sort({ niveau: 1, title: 1 });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Projet introuvable" });
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Projet + toutes les affectations (groupes / équipes) pour ce projet */
export const getProjectDetailWithGroups = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Projet introuvable" });

    const groups = await Assignment.find({ project: project._id })
      .populate("students")
      .sort({ status: 1, _id: 1 });

    const groupIds = groups.map((g) => g._id);
    const submissions =
      groupIds.length === 0
        ? []
        : await Submission.find({ assignment: { $in: groupIds } })
            .sort({ createdAt: -1 })
            .populate("student", "name email currentLevel")
            .lean();

    const byAssignment = new Map();
    for (const s of submissions) {
      s.status = submissionStatusForApi(s.status);
      const aid = String(s.assignment);
      if (!byAssignment.has(aid)) byAssignment.set(aid, []);
      byAssignment.get(aid).push(s);
    }

    const groupsPayload = groups.map((g) => {
      const o = g.toObject();
      o.submissions = byAssignment.get(String(g._id)) || [];
      return o;
    });

    res.json({
      project,
      groups: groupsPayload,
      sandboxHints: getPublicSandboxHints(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      safeUnlink(req.file?.path);
      return res.status(404).json({ message: "Projet introuvable" });
    }

    const fields = parseBody(req);
    const title = (fields.title || project.title || "").trim();
    if (!title) {
      safeUnlink(req.file?.path);
      return res.status(400).json({ message: "Titre requis" });
    }

    project.title = title;
    project.description = fields.description ?? project.description;
    project.niveau = Number.isFinite(fields.niveau) ? fields.niveau : project.niveau;
    project.maxStudents = Number.isFinite(fields.maxStudents)
      ? fields.maxStudents
      : project.maxStudents;
    project.cahierDeCharge = fields.cahierDeCharge ?? project.cahierDeCharge;
    project.referenceKind = ["repo", "stack", "sandbox", "tests", "autre"].includes(
      fields.referenceKind
    )
      ? fields.referenceKind
      : project.referenceKind || "autre";
    project.referenceValidation = fields.referenceValidation ?? project.referenceValidation;

    // Replace CDC file if new file uploaded
    if (req.file) {
      if (project.cahierFileStoredName) {
        safeUnlink(path.join(CDC_DIR, project.cahierFileStoredName));
      }
      project.cahierFileOriginalName = req.file.originalname;
      project.cahierFileStoredName = req.file.filename;
      project.cahierFileMimeType = req.file.mimetype;
    }

    // Optional: remove CDC file metadata + file
    if (String(req.body?.removeCdc || "").toLowerCase() === "1") {
      if (project.cahierFileStoredName) {
        safeUnlink(path.join(CDC_DIR, project.cahierFileStoredName));
      }
      project.cahierFileOriginalName = "";
      project.cahierFileStoredName = "";
      project.cahierFileMimeType = "";
    }

    await project.save();
    res.json({ message: "Project updated", project });
  } catch (error) {
    safeUnlink(req.file?.path);
    res.status(500).json({ error: error.message });
  }
};

export const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Projet introuvable" });

    if (project.cahierFileStoredName) {
      safeUnlink(path.join(CDC_DIR, project.cahierFileStoredName));
    }
    await Project.deleteOne({ _id: project._id });
    res.json({ message: "Project deleted" });
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
