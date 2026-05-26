import fs from "fs";
import path from "path";
import Project from "../models/Project.js";
import Assignment from "../models/Assignment.js";
import Submission from "../models/Submission.js";
import { getPublicComposeHints } from "../services/dockerComposeRunner.js";
import { CDC_DIR, COMPOSE_DIR } from "../middleware/projectUpload.js";
import { submissionStatusForApi } from "../utils/submissionStatus.js";

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}

function cleanupUploadedProjectFiles(req) {
  const bag = req.files;
  if (!bag || typeof bag !== "object") return;
  for (const arr of Object.values(bag)) {
    if (!Array.isArray(arr)) continue;
    for (const f of arr) safeUnlink(f?.path);
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
    submissionDeadline:
      b.submissionDeadline && String(b.submissionDeadline).trim()
        ? new Date(b.submissionDeadline)
        : null,
  };
}

export const createProject = async (req, res) => {
  try {
    const fields = parseBody(req);
    const cahier = req.files?.cahierFile?.[0];
    const compose = req.files?.composeFile?.[0];

    if (!fields.title?.trim()) {
      cleanupUploadedProjectFiles(req);
      return res.status(400).json({ message: "Titre requis" });
    }
    if (!compose) {
      cleanupUploadedProjectFiles(req);
      return res.status(400).json({
        message:
          "Fichier docker-compose obligatoire : joignez docker-compose.yml ou docker-compose.yaml (environnement Docker pour les tests).",
      });
    }

    const project = new Project({
      ...fields,
      referenceKind: ["repo", "stack", "sandbox", "tests", "autre"].includes(
        fields.referenceKind
      )
        ? fields.referenceKind
        : "autre",
    });

    if (cahier) {
      project.cahierFileOriginalName = cahier.originalname;
      project.cahierFileStoredName = cahier.filename;
      project.cahierFileMimeType = cahier.mimetype;
    }
    project.composeFileOriginalName = compose.originalname;
    project.composeFileStoredName = compose.filename;
    project.composeFileMimeType = compose.mimetype || "text/yaml";

    await project.save();
    res.status(201).json({ message: "Project created", project });
  } catch (error) {
    cleanupUploadedProjectFiles(req);
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
      .populate({
        path: "team",
        select: "name leader",
        populate: { path: "leader", select: "name email" },
      })
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
      sandboxHints: getPublicComposeHints(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    const cahier = req.files?.cahierFile?.[0];
    const compose = req.files?.composeFile?.[0];
    if (!project) {
      cleanupUploadedProjectFiles(req);
      return res.status(404).json({ message: "Projet introuvable" });
    }

    const fields = parseBody(req);
    const title = (fields.title || project.title || "").trim();
    if (!title) {
      cleanupUploadedProjectFiles(req);
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
    if (req.body?.submissionDeadline === "" || fields.submissionDeadline === null) {
      project.submissionDeadline = null;
    } else if (fields.submissionDeadline) {
      project.submissionDeadline = fields.submissionDeadline;
    }

    if (cahier) {
      if (project.cahierFileStoredName) {
        safeUnlink(path.join(CDC_DIR, project.cahierFileStoredName));
      }
      project.cahierFileOriginalName = cahier.originalname;
      project.cahierFileStoredName = cahier.filename;
      project.cahierFileMimeType = cahier.mimetype;
    }

    if (compose) {
      if (project.composeFileStoredName) {
        safeUnlink(path.join(COMPOSE_DIR, project.composeFileStoredName));
      }
      project.composeFileOriginalName = compose.originalname;
      project.composeFileStoredName = compose.filename;
      project.composeFileMimeType = compose.mimetype || "text/yaml";
    }

    if (String(req.body?.removeCdc || "").toLowerCase() === "1") {
      if (project.cahierFileStoredName) {
        safeUnlink(path.join(CDC_DIR, project.cahierFileStoredName));
      }
      project.cahierFileOriginalName = "";
      project.cahierFileStoredName = "";
      project.cahierFileMimeType = "";
    }

    if (!project.composeFileStoredName) {
      cleanupUploadedProjectFiles(req);
      return res.status(400).json({
        message:
          "Chaque projet doit disposer d’un docker-compose : ajoutez un fichier .yml ou .yaml (référence Docker).",
      });
    }

    await project.save();
    res.json({ message: "Project updated", project });
  } catch (error) {
    cleanupUploadedProjectFiles(req);
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
    if (project.composeFileStoredName) {
      safeUnlink(path.join(COMPOSE_DIR, project.composeFileStoredName));
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

/** Téléchargement / consultation du docker-compose de référence */
export const streamComposeFile = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Projet introuvable" });
    }
    if (!project.composeFileStoredName) {
      return res.status(404).json({ message: "Aucun fichier docker-compose pour ce projet" });
    }

    const filePath = path.join(COMPOSE_DIR, project.composeFileStoredName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Fichier introuvable sur le serveur" });
    }

    const download = req.query.download === "1";
    const encodedName = encodeURIComponent(
      project.composeFileOriginalName || "docker-compose.yml"
    );

    res.setHeader(
      "Content-Type",
      project.composeFileMimeType || "text/yaml; charset=utf-8"
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
