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
import {
  computeGithubParticipation,
  findGithubUrlForAssignment,
  resolveGithubUrlForSubmission,
  syncGithubParticipationForAssignment,
} from "../services/githubParticipationService.js";
import { scheduleSubmissionSandbox } from "../services/submissionSandboxService.js";
import { safeUploadRelativePath } from "../utils/uploadPath.js";
import {
  SUBMISSION_STATUSES,
  submissionStatusForApi,
  canChangeSubmissionStatus,
} from "../utils/submissionStatus.js";
import { studentHasGithubUsername, STUDENT_GITHUB_REQUIRED_MESSAGE } from "../utils/studentGithub.js";
import {
  DOCKER_COMPOSE_SUBMIT_REQUIRED_MESSAGE,
  uploadBasenamesIncludeDockerCompose,
} from "../utils/dockerComposeSubmit.js";
import { zipFileContainsDockerCompose } from "../utils/dockerComposeZip.js";
import { githubRepoHasRootDockerCompose } from "../services/githubComposeCheck.js";
import { resolveGithubToken } from "../utils/githubToken.js";
import { buildDockerComposeChecklist } from "../utils/dockerComposeChecklist.js";
import {
  getProjectGradingRubric,
  validateRubricScoresForGrade,
  formatGradeNote,
  PROJECT_GRADE_MAX,
} from "../utils/projectGradingRubric.js";
import { checkOllamaAvailable, getOllamaConfig } from "../services/ollamaService.js";
import { handleOllamaJob } from "../services/queue/jobHandlers.js";

function roundGrade(n) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  return Math.round(Number(n) * 100) / 100;
}

function mapSubmissionDoc(doc) {
  const o = doc && typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  o.status = submissionStatusForApi(o.status);
  o.gradeTotal = roundGrade(o.gradeTotal);
  o.aiGradeTotal = roundGrade(o.aiGradeTotal);
  o.rubricScores =
    o.rubricScores && typeof o.rubricScores === "object" && !Array.isArray(o.rubricScores)
      ? o.rubricScores
      : {};
  o.aiRubricScores =
    o.aiRubricScores && typeof o.aiRubricScores === "object" && !Array.isArray(o.aiRubricScores)
      ? o.aiRubricScores
      : {};
  if (o.githubParticipation && typeof o.githubParticipation !== "object") {
    o.githubParticipation = null;
  }
  if (o.sandboxResult && typeof o.sandboxResult !== "object") {
    o.sandboxResult = null;
  }
  return o;
}

const LIST_SUBMISSION_SELECT =
  "assignment project student status note gradeTotal gradeComment kind githubUrl bundleId fileOriginalName fileSize fileMimeType createdAt updatedAt rubricScores aiGradeTotal aiGradeComment aiEvaluatedAt aiModel sandboxOk sandboxRanAt sandboxLastError projectFiles";

function mapSubmissionListDoc(doc) {
  const o = mapSubmissionDoc(doc);
  if (o.sandboxResult && typeof o.sandboxResult === "object") {
    const {
      ok,
      exitCode,
      timedOut,
      suggestedDockerTests,
      composeFile,
      phases,
      mode,
      stdout,
      logDetail,
      stderr,
      projectName,
      accessLinks,
      containersLeftRunning,
      workDir,
    } = o.sandboxResult;
    o.sandboxResult = {
      ok,
      exitCode,
      timedOut,
      suggestedDockerTests,
      composeFile,
      phases,
      mode,
      stdout,
      logDetail,
      stderr,
      projectName,
      accessLinks,
      containersLeftRunning,
      workDir,
    };
  }
  if (o.githubParticipation && typeof o.githubParticipation === "object") {
    const { owner, repo, totalCommits, members, syncedAt } = o.githubParticipation;
    o.githubParticipation = { owner, repo, totalCommits, members, syncedAt };
  }
  return o;
}

export const getGradingRubric = async (_req, res) => {
  try {
    res.json(getProjectGradingRubric());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAiGradingStatus = async (_req, res) => {
  try {
    const ollama = await checkOllamaAvailable();
    const cfg = getOllamaConfig();
    res.json({
      ollama,
      config: cfg,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const aiGradeSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const sub = await Submission.findById(id);
    if (!sub) return res.status(404).json({ message: "Soumission introuvable" });

    const ollama = await checkOllamaAvailable();
    if (!ollama.ok) {
      return res.status(503).json({
        message:
          ollama.message ||
          "Ollama n’est pas disponible. Lancez Ollama localement (ollama serve) et vérifiez OLLAMA_BASE_URL.",
      });
    }

    const out = await handleOllamaJob(id);
    res.json({
      message: out.message,
      preliminary: out.preliminary,
      submission: mapSubmissionDoc(out.submission),
    });
  } catch (error) {
    const status = /Ollama|JSON|Barème/i.test(error.message) ? 502 : 500;
    res.status(status).json({
      message: error.message || "Évaluation IA impossible",
      error: error.message,
    });
  }
};

export const gradeSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { rubricScores, gradeComment, markEvaluated } = req.body || {};
    const sub = await Submission.findById(id);
    if (!sub) return res.status(404).json({ message: "Soumission introuvable" });

    const validation = validateRubricScoresForGrade(rubricScores, { requireAll: true });
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    sub.rubricScores = validation.scores;
    sub.gradeTotal = validation.total;
    sub.gradeComment = String(gradeComment || "").trim().slice(0, 2000);
    sub.note = formatGradeNote(validation.total, sub.gradeComment);

    const shouldEvaluate = markEvaluated !== false;
    if (shouldEvaluate) {
      const current = submissionStatusForApi(sub.status);
      if (current === "en attente" || current === "en cours d'évaluation") {
        sub.status = "évalué";
      }
    }

    await sub.save();

    const ptitle = (await Project.findById(sub.project).select("title").lean())?.title || "Projet";
    if (submissionStatusForApi(sub.status) === "évalué") {
      try {
        await notifyStudents([sub.student], {
          type: "submission_status",
          title: "Soumission évaluée",
          body: `Votre soumission pour « ${ptitle} » a été notée : ${sub.note}.`,
          meta: {
            submissionId: String(sub._id),
            assignmentId: String(sub.assignment),
            projectId: String(sub.project),
            status: "évalué",
            gradeTotal: sub.gradeTotal,
          },
        });
      } catch (e) {
        console.error("notifyStudents grade", e);
      }
    }

    res.json({
      message: `Note enregistrée (${sub.gradeTotal}/${PROJECT_GRADE_MAX})`,
      submission: mapSubmissionDoc(sub),
      rubric: getProjectGradingRubric(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

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

    const project = await Project.findById(assignment.project).select("submissionDeadline").lean();
    if (project?.submissionDeadline && new Date() > new Date(project.submissionDeadline)) {
      cleanupSubmissionUpload(req);
      return res.status(400).json({ message: "Date limite de soumission dépassée." });
    }

    const submitter = await Student.findById(studentId).select("githubUsername").lean();
    if (!submitter || !studentHasGithubUsername(submitter)) {
      cleanupSubmissionUpload(req);
      return res.status(400).json({ message: STUDENT_GITHUB_REQUIRED_MESSAGE });
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

    if (hasGithub) {
      const composeCheck = await githubRepoHasRootDockerCompose(githubUrlRaw);
      if (!composeCheck.ok) {
        cleanupSubmissionUpload(req);
        return res.status(400).json({ message: composeCheck.message });
      }
    } else {
      let okCompose = uploadBasenamesIncludeDockerCompose(
        uploaded.map((f) => f.originalname)
      );
      if (
        !okCompose &&
        uploaded.length === 1 &&
        String(uploaded[0].originalname || "").toLowerCase().endsWith(".zip")
      ) {
        okCompose = zipFileContainsDockerCompose(uploaded[0].path);
      }
      if (!okCompose) {
        cleanupSubmissionUpload(req);
        return res.status(400).json({ message: DOCKER_COMPOSE_SUBMIT_REQUIRED_MESSAGE });
      }
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

    scheduleSubmissionSandbox(String(submission._id));
    setImmediate(() => {
      syncGithubParticipationForAssignment(assignment._id).catch((e) => {
        console.error("syncGithubParticipationForAssignment", e.message);
      });
    });

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
      return res.status(403).json({ message: "Accès refusé à l’historique d’un autre étudiant." });
    }
    const submissions = await Submission.find({ student: studentId })
      .select(LIST_SUBMISSION_SELECT)
      .sort({ createdAt: -1 })
      .populate("project", "title niveau")
      .lean();
    res.json(submissions.map((s) => mapSubmissionListDoc(s)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const listSubmissionsForAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const submissions = await Submission.find({ assignment: assignmentId })
      .select(LIST_SUBMISSION_SELECT)
      .sort({ createdAt: -1 })
      .populate("student", "name email githubUsername")
      .populate("project", "title niveau")
      .lean();
    res.json(submissions.map((s) => mapSubmissionListDoc(s)));
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
      return res.status(403).json({ message: "Accès refusé à ce fichier." });
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

/**
 * Participation GitHub (commits) — cache + dépôt d’équipe pour soumissions fichier.
 */
export const getGithubParticipation = async (req, res) => {
  try {
    const { id } = req.params;
    const refresh = req.query.refresh === "1";
    const sub = await Submission.findById(id).populate({
      path: "assignment",
      populate: { path: "students", select: "name email githubUsername" },
    });
    if (!sub) {
      return res.status(404).json({ message: "Soumission introuvable" });
    }

    const role = req.user?.role;
    const userId = req.user?.id;
    if (role === "student") {
      const assignment = sub.assignment;
      const inTeam = assignment?.students?.some((s) => String(s._id) === String(userId));
      if (!inTeam && String(sub.student) !== String(userId)) {
        return res.status(403).json({ message: "Accès refusé à cette participation." });
      }
    }

    const assignment = sub.assignment;
    if (!assignment) {
      return res.status(400).json({ message: "Affectation introuvable pour cette soumission." });
    }
    const teamStudents = Array.isArray(assignment.students) ? assignment.students : [];
    if (teamStudents.length === 0) {
      return res.status(400).json({ message: "Aucun membre sur l’équipe / affectation." });
    }

    const assignmentGithub = await findGithubUrlForAssignment(assignment._id);
    const githubUrl = resolveGithubUrlForSubmission(sub, assignmentGithub);
    if (!githubUrl) {
      return res.status(400).json({
        message:
          "Aucun dépôt GitHub lié à cette affectation. Un membre doit soumettre un lien GitHub pour activer le suivi des commits.",
      });
    }

    const cacheAgeMs = sub.githubParticipationSyncedAt
      ? Date.now() - new Date(sub.githubParticipationSyncedAt).getTime()
      : Infinity;
    const useCache =
      !refresh &&
      sub.githubParticipation &&
      typeof sub.githubParticipation === "object" &&
      cacheAgeMs < 60 * 60 * 1000;

    let data = useCache ? sub.githubParticipation : null;
    if (!data) {
      try {
        data = await computeGithubParticipation({ githubUrl, teamStudents });
        sub.githubParticipation = data;
        sub.githubParticipationSyncedAt = new Date();
        await sub.save();
      } catch (e) {
        const status = e.status;
        let hint = "";
        if (status === 404) {
          hint =
            " Dépôt introuvable ou privé : définissez GITHUB_TOKEN (PAT) dans backend/.env.";
        } else if (status === 403 || status === 429) {
          hint =
            " Limite d’API GitHub — ajoutez GITHUB_TOKEN, attendez quelques minutes, puis Actualiser.";
        } else if (status === 503 || status === 504) {
          hint = " GitHub a mis trop de temps à répondre — réessayez avec GITHUB_TOKEN configuré.";
        } else if (!resolveGithubToken()) {
          hint =
            " Sans GITHUB_TOKEN, les dépôts privés et les fortes limites d’API peuvent bloquer le suivi.";
        }
        const detail = String(e.message || "erreur GitHub").slice(0, 400);
        return res.status(502).json({
          message: `Impossible de récupérer les commits : ${detail}.${hint}`,
        });
      }
    }

    const members =
      role === "student" && userId
        ? (data.members || []).map((m) => ({
            ...m,
            isMe: String(m.studentId) === String(userId),
            email: String(m.studentId) === String(userId) ? m.email : undefined,
          }))
        : data.members;

    res.json({
      ...data,
      members,
      submissionId: String(sub._id),
      assignmentId: String(assignment._id),
      sourceGithubUrl: githubUrl,
      fromCache: useCache,
      submissionKind: sub.kind || "file",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Prévisualisation checklist docker-compose (fichiers locaux ou dépôt GitHub). */
export const previewComposeChecklist = async (req, res) => {
  try {
    const { mode, paths, githubUrl } = req.body || {};

    if (mode === "github") {
      const raw = String(githubUrl || "").trim();
      const parsed = parseGithubSubmissionUrl(raw);
      let githubComposeOk = null;
      let githubMessage = null;
      if (parsed.ok) {
        const check = await githubRepoHasRootDockerCompose(raw);
        githubComposeOk = check.ok;
        if (!check.ok) githubMessage = check.message;
      }
      const checklist = buildDockerComposeChecklist({
        isGithub: true,
        githubUrlValid: parsed.ok ? true : raw.length > 0 ? false : null,
        githubComposeOk,
      });
      return res.json({
        ...checklist,
        githubMessage,
      });
    }

    const relativePaths = Array.isArray(paths)
      ? paths.map((p) => safeUploadRelativePath(String(p || ""))).filter(Boolean)
      : [];
    const checklist = buildDockerComposeChecklist({ relativePaths });
    res.json(checklist);
  } catch (error) {
    res.status(500).json({ message: error.message || "Vérification impossible." });
  }
};
