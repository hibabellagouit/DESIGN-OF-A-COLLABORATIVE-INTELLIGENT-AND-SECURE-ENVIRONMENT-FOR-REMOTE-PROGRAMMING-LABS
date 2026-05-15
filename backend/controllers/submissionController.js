import fs from "fs";
import path from "path";
import archiver from "archiver";
import Assignment from "../models/Assignment.js";
import Submission from "../models/Submission.js";
import Student from "../models/Student.js";
import Project from "../models/Project.js";
import { notifyAllTeachers, notifyStudents } from "../services/notificationService.js";
import {
  SUBMISSIONS_DIR,
  cleanupSubmissionUpload,
  SUBMISSION_MAX_TOTAL_BYTES,
} from "../middleware/submissionUpload.js";
import { parseGithubSubmissionUrl } from "../utils/githubUrl.js";
import { safeUploadRelativePath } from "../utils/uploadPath.js";
import {
  SUBMISSION_STATUSES,
  submissionStatusForApi,
  canChangeSubmissionStatus,
} from "../utils/submissionStatus.js";

function mapSubmissionDoc(doc) {
  const o = doc && typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  o.status = submissionStatusForApi(o.status);
  return o;
}

export const createSubmission = async (req, res) => {
  const uploaded = Array.isArray(req.files) ? req.files : [];
  const hasUpload = uploaded.length > 0;
  const body = req.body || {};
  const rawGithub =
    typeof body.githubUrl === "string"
      ? body.githubUrl
      : typeof body.github_url === "string"
        ? body.github_url
        : "";
  const { assignmentId } = body;
  const githubUrlRaw = rawGithub;
  const hasGithub = githubUrlRaw.trim().length > 0;

  const studentId = req.user?.id;
  if (!studentId) {
    cleanupSubmissionUpload(req);
    return res.status(401).json({ message: "Missing user" });
  }
  if (!assignmentId) {
    cleanupSubmissionUpload(req);
    return res.status(400).json({ message: "assignmentId requis" });
  }
  if (hasUpload && hasGithub) {
    cleanupSubmissionUpload(req);
    return res
      .status(400)
      .json({ message: "Envoyez soit des fichiers projet, soit un lien GitHub, pas les deux." });
  }
  if (!hasUpload && !hasGithub) {
    cleanupSubmissionUpload(req);
    return res.status(400).json({
      message:
        "Ajoutez un ou plusieurs fichiers (projet ou dossier), une archive, ou indiquez un lien GitHub.",
    });
  }

  let savedToDb = false;
  try {
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      cleanupSubmissionUpload(req);
      return res.status(404).json({ message: "Affectation introuvable" });
    }
    if (String(assignment.status) !== "en cours") {
      cleanupSubmissionUpload(req);
      return res.status(400).json({ message: "Affectation non active" });
    }
    const inAssignment = (assignment.students || []).some(
      (sid) => String(sid) === String(studentId)
    );
    if (!inAssignment) {
      cleanupSubmissionUpload(req);
      return res.status(403).json({ message: "Cette affectation ne vous appartient pas" });
    }

    let submissionPayload;
    if (hasGithub) {
      const parsed = parseGithubSubmissionUrl(githubUrlRaw);
      if (!parsed.ok) {
        return res.status(400).json({ message: parsed.message });
      }
      submissionPayload = {
        assignment: assignment._id,
        project: assignment.project,
        student: studentId,
        status: "en attente",
        kind: "github",
        githubUrl: parsed.url,
        bundleId: "",
        projectFiles: [],
        fileOriginalName: "Lien GitHub",
        fileStoredName: "",
        fileMimeType: "text/x-github-url",
        fileSize: 0,
      };
    } else {
      const bundleId = req._submissionBundleId;
      if (!bundleId) {
        cleanupSubmissionUpload(req);
        return res.status(500).json({ message: "Bundle de dépôt manquant" });
      }
      const projectFiles = uploaded.map((f) => ({
        relativePath: safeUploadRelativePath(f.originalname),
        storedName: f.filename,
        fileMimeType: f.mimetype || "",
        fileSize: f.size || 0,
      }));
      const total = projectFiles.reduce((s, p) => s + (Number(p.fileSize) || 0), 0);
      if (total > SUBMISSION_MAX_TOTAL_BYTES) {
        cleanupSubmissionUpload(req);
        return res.status(400).json({
          message: `Volume total des fichiers trop élevé (max. ${Math.round(SUBMISSION_MAX_TOTAL_BYTES / (1024 * 1024))} Mo).`,
        });
      }
      submissionPayload = {
        assignment: assignment._id,
        project: assignment.project,
        student: studentId,
        status: "en attente",
        kind: "file",
        githubUrl: "",
        bundleId,
        projectFiles,
        fileOriginalName:
          uploaded.length === 1
            ? projectFiles[0].relativePath
            : `Projet (${uploaded.length} fichiers)`,
        fileStoredName: "",
        fileMimeType:
          uploaded.length === 1
            ? uploaded[0].mimetype || "application/octet-stream"
            : "application/zip",
        fileSize: total,
      };
    }

    const submission = new Submission(submissionPayload);
    await submission.save();
    savedToDb = true;

    const [stu, proj] = await Promise.all([
      Student.findById(studentId).select("name email").lean(),
      Project.findById(assignment.project).select("title").lean(),
    ]);
    const who = stu?.name || stu?.email || "Étudiant";
    const ptitle = proj?.title || "Projet";
    const notifyBody = hasGithub
      ? `${who} a partagé un dépôt GitHub pour « ${ptitle} ».`
      : `${who} a déposé un projet (${uploaded.length} fichier${uploaded.length > 1 ? "s" : ""}) pour « ${ptitle} ».`;
    try {
      await notifyAllTeachers({
        type: "submission_received",
        title: "Nouvelle soumission",
        body: notifyBody,
        meta: {
          submissionId: String(submission._id),
          assignmentId: String(assignment._id),
          projectId: String(assignment.project),
          studentId: String(studentId),
        },
      });
    } catch (e) {
      console.error("notifyAllTeachers", e);
    }

    res.status(201).json({
      message: "Soumission enregistrée",
      submission: mapSubmissionDoc(submission),
    });
  } catch (error) {
    if (!savedToDb && hasUpload) cleanupSubmissionUpload(req);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
};

export const listSubmissionsForStudent = async (req, res) => {
  try {
    const studentId = req.user?.id;
    const { studentId: paramId } = req.params;
    if (!studentId || String(studentId) !== String(paramId)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const submissions = await Submission.find({ student: studentId })
      .sort({ createdAt: -1 })
      .populate("project");
    res.json(submissions.map((s) => mapSubmissionDoc(s)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const listSubmissionsForAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const submissions = await Submission.find({ assignment: assignmentId })
      .sort({ createdAt: -1 })
      .populate("student", "name email")
      .populate("project", "title niveau");
    res.json(submissions.map((s) => mapSubmissionDoc(s)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateSubmissionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status: nextStatus, note } = req.body || {};
    const next = String(nextStatus || "").trim();
    if (!SUBMISSION_STATUSES.includes(next)) {
      return res.status(400).json({
        message: `Statut invalide (attendu : ${SUBMISSION_STATUSES.join(", ")})`,
      });
    }

    const sub = await Submission.findById(id);
    if (!sub) return res.status(404).json({ message: "Soumission introuvable" });

    if (!canChangeSubmissionStatus(sub.status, next)) {
      return res.status(400).json({
        message: "Transition de statut non autorisée (en attente → en cours d’évaluation ou évalué ; en cours d’évaluation → évalué).",
      });
    }

    sub.status = next;
    if (note !== undefined) {
      sub.note = String(note || "").trim().slice(0, 4000);
    }
    await sub.save();

    const ptitle = (await Project.findById(sub.project).select("title").lean())?.title || "Projet";
    try {
      await notifyStudents([sub.student], {
        type: "submission_status",
        title:
          next === "évalué"
            ? "Soumission évaluée"
            : next === "en cours d'évaluation"
              ? "Soumission en cours d’évaluation"
              : "Soumission",
        body:
          next === "évalué"
            ? `Votre soumission pour « ${ptitle} » est marquée comme évaluée.`
            : next === "en cours d'évaluation"
              ? `Votre soumission pour « ${ptitle} » est en cours d’évaluation par l’enseignant.`
              : `Mise à jour de votre soumission pour « ${ptitle} ».`,
        meta: {
          submissionId: String(sub._id),
          assignmentId: String(sub.assignment),
          projectId: String(sub.project),
          status: next,
        },
      });
    } catch (e) {
      console.error("notifyStudents submission_status", e);
    }

    res.json({ message: "Statut mis à jour", submission: mapSubmissionDoc(sub) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const downloadSubmissionFile = async (req, res) => {
  try {
    const sub = await Submission.findById(req.params.id);
    if (!sub) return res.status(404).json({ message: "Soumission introuvable" });

    const role = req.user?.role;
    const userId = req.user?.id;
    if (role === "student" && String(sub.student) !== String(userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const kind = sub.kind || "file";
    if (kind === "github" && sub.githubUrl) {
      return res.redirect(302, sub.githubUrl);
    }

    const bundleId = sub.bundleId;
    const entries = Array.isArray(sub.projectFiles) ? sub.projectFiles : [];
    const hasBundle = Boolean(bundleId) && entries.length > 0;

    if (hasBundle) {
      const bundleDir = path.join(SUBMISSIONS_DIR, "bundles", bundleId);
      const valid = entries.filter((p) => {
        const abs = path.join(bundleDir, p.storedName);
        return p.storedName && fs.existsSync(abs);
      });
      if (!valid.length) {
        return res.status(404).json({ message: "Fichiers du projet introuvables sur le serveur" });
      }

      const download = req.query.download === "1";

      if (valid.length === 1) {
        const one = valid[0];
        const abs = path.join(bundleDir, one.storedName);
        const encodedName = encodeURIComponent(one.relativePath || one.storedName || "fichier");
        res.setHeader("Content-Type", one.fileMimeType || "application/octet-stream");
        res.setHeader(
          "Content-Disposition",
          download
            ? `attachment; filename*=UTF-8''${encodedName}`
            : `inline; filename*=UTF-8''${encodedName}`
        );
        fs.createReadStream(abs).pipe(res);
        return;
      }

      const zipName = `projet-${String(sub._id).slice(-8)}.zip`;
      const encodedZip = encodeURIComponent(zipName);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        download
          ? `attachment; filename*=UTF-8''${encodedZip}`
          : `inline; filename*=UTF-8''${encodedZip}`
      );

      const archive = archiver("zip", { zlib: { level: 6 } });
      archive.on("error", (err) => {
        if (!res.headersSent) res.status(500).json({ message: err.message });
      });
      archive.pipe(res);
      for (const p of valid) {
        const abs = path.join(bundleDir, p.storedName);
        archive.file(abs, { name: p.relativePath || p.storedName });
      }
      await archive.finalize();
      return;
    }

    const filePath = path.join(SUBMISSIONS_DIR, sub.fileStoredName);
    if (!sub.fileStoredName || !fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Fichier introuvable sur le serveur" });
    }

    const download = req.query.download === "1";
    const encodedName = encodeURIComponent(sub.fileOriginalName || "soumission");
    res.setHeader("Content-Type", sub.fileMimeType || "application/octet-stream");
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
