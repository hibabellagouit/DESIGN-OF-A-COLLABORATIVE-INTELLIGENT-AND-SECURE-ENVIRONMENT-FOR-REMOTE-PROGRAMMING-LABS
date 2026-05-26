import Student from "../models/Student.js";
import SecurityPolicy from "../models/SecurityPolicy.js";
import Submission from "../models/Submission.js";
import Assignment from "../models/Assignment.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { recordAudit } from "../services/auditLog.js";
import {
  normalizeStudentGithubUsername,
  studentHasGithubUsername,
  STUDENT_GITHUB_REQUIRED_MESSAGE,
} from "../utils/studentGithub.js";
import { buildStudentsRanking } from "../utils/studentRanking.js";

function signToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing");
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

function studentPublicFields(student) {
  return {
    _id: student._id,
    name: student.name,
    email: student.email,
    currentLevel: student.currentLevel,
    team: student.team,
    githubUsername: student.githubUsername || "",
    githubRequired: !studentHasGithubUsername(student),
  };
}
export const listStudents = async (req, res) => {
  try {
    const students = await Student.find()
      .select("-password")
      .populate({
        path: "team",
        select: "name leader",
        populate: { path: "leader", select: "name email" },
      });
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const registerStudent = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    let policy = await SecurityPolicy.findOne({ key: "default" });
    if (!policy) policy = await SecurityPolicy.create({ key: "default" });
    if (policy.allowStudentSelfRegistration === false) {
      await recordAudit(req, {
        actorRole: "unknown",
        action: "student_register_denied_by_policy",
        details: { email: String(email).toLowerCase().trim() },
      });
      return res.status(403).json({
        message: "L’inscription libre des étudiants est désactivée par l’administrateur.",
      });
    }

    const existing = await Student.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email already used" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const githubUsername = normalizeStudentGithubUsername(req.body?.githubUsername);
    if (!githubUsername) {
      return res.status(400).json({ message: STUDENT_GITHUB_REQUIRED_MESSAGE });
    }
    const student = new Student({
      name,
      email,
      password: hashed,
      currentLevel: 1,
      githubUsername,
    });

    await student.save();

    const token = signToken({ id: student._id.toString(), role: "student" });
    await recordAudit(req, {
      actorId: student._id.toString(),
      actorRole: "student",
      action: "student_self_registered",
      targetType: "student",
      targetId: student._id.toString(),
      details: { email: student.email },
    });
    res.status(201).json({
      message: "Student created",
      token,
      student: {
        _id: student._id,
        name: student.name,
        email: student.email,
        currentLevel: student.currentLevel,
        team: student.team,
        githubUsername: student.githubUsername || "",
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const loginStudent = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const student = await Student.findOne({ email }).populate({
      path: "team",
      select: "name leader",
      populate: { path: "leader", select: "name email" },
    });

    if (!student) {
      await recordAudit(req, {
        actorRole: "unknown",
        action: "student_login_failed",
        details: { email },
      });
      return res.status(404).json({ message: "Student not found" });
    }

    if (student.isDisabled) {
      await recordAudit(req, {
        actorId: student._id.toString(),
        actorRole: "student",
        action: "student_login_blocked",
        targetType: "student",
        targetId: student._id.toString(),
      });
      return res.status(403).json({ message: "Compte étudiant désactivé" });
    }

    let ok = false;
    const stored = student.password || "";
    // Backward compatibility: old accounts had plain text passwords
    if (stored && stored.startsWith("$2")) {
      ok = await bcrypt.compare(password || "", stored);
    } else {
      ok = (password || "") === stored;
      if (ok) {
        student.password = await bcrypt.hash(password, 10);
        await student.save();
      }
    }
    if (!ok) {
      await recordAudit(req, {
        actorRole: "unknown",
        action: "student_login_failed",
        details: { email: student.email },
      });
      return res.status(401).json({ message: "Wrong password" });
    }

    const token = signToken({ id: student._id.toString(), role: "student" });
    await recordAudit(req, {
      actorId: student._id.toString(),
      actorRole: "student",
      action: "student_login_success",
      targetType: "student",
      targetId: student._id.toString(),
    });
    res.json({
      message: studentHasGithubUsername(student)
        ? "Login successful"
        : "Connexion réussie — complétez votre identifiant GitHub pour accéder à la plateforme.",
      token,
      githubRequired: !studentHasGithubUsername(student),
      student: studentPublicFields(student),
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const patchStudentGithubUsername = async (req, res) => {
  try {
    const raw = req.params?.id;
    if (raw === "me" && req.user?.role !== "student") {
      return res.status(400).json({
        message:
          "Pour le mode enseignant, indiquez l’identifiant MongoDB de l’étudiant dans l’URL (pas « me »).",
      });
    }
    const resolvedId = raw === "me" ? req.user?.id : raw;
    if (!resolvedId) {
      return res.status(400).json({ message: "Identifiant étudiant manquant" });
    }
    const student = await Student.findById(resolvedId);
    if (!student) {
      return res.status(404).json({ message: "Étudiant introuvable" });
    }
    const githubUsername = normalizeStudentGithubUsername(req.body?.githubUsername);
    if (!githubUsername) {
      return res.status(400).json({ message: STUDENT_GITHUB_REQUIRED_MESSAGE });
    }
    student.githubUsername = githubUsername;
    await student.save();
    const out = await Student.findById(student._id)
      .select("-password")
      .populate({
        path: "team",
        select: "name leader",
        populate: { path: "leader", select: "name email" },
      });
    res.json({
      message: "Identifiant GitHub enregistré",
      student: {
        _id: out._id,
        name: out.name,
        email: out.email,
        currentLevel: out.currentLevel,
        team: out.team,
        githubUsername: out.githubUsername || "",
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getMyStudentProfile = async (req, res) => {
  try {
    const student = await Student.findById(req.user?.id)
      .select("-password")
      .populate({
        path: "team",
        select: "name leader",
        populate: { path: "leader", select: "name email" },
      });
    if (!student) {
      return res.status(404).json({ message: "Session invalide" });
    }
    res.json({
      student: studentPublicFields(student),
      githubRequired: !studentHasGithubUsername(student),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getMyGradesBreakdown = async (req, res) => {
  try {
    const studentId = String(req.user?.id || "");
    if (!studentId) return res.status(401).json({ message: "Session invalide" });

    const assignments = await Assignment.find({ students: studentId })
      .populate("project", "title niveau submissionDeadline")
      .sort({ niveau: 1 })
      .lean();

    const grades = assignments.map((a) => {
      const fin = a.memberFinalGrades?.[studentId] || {};
      const commits = a.memberCommitScores?.[studentId] || {};
      return {
        assignmentId: a._id,
        projectTitle: a.project?.title || "",
        niveau: a.niveau,
        groupName: a.groupName || "",
        status: a.status,
        teamGradeTotal: a.teamGradeTotal,
        teamGradeComment: a.teamGradeComment || "",
        teamGradedAt: a.teamGradedAt,
        teamHalfScore: fin.teamHalfScore ?? null,
        commitHalfScore: fin.commitHalfScore ?? commits.commitHalfScore ?? null,
        finalTotal: fin.finalTotal ?? null,
        commits: fin.commits ?? commits.commits ?? 0,
        sharePercent: fin.sharePercent ?? commits.sharePercent ?? null,
        submissionDeadline: a.project?.submissionDeadline || null,
      };
    });

    res.json({
      grades,
      breakdownHint:
        "Note finale = 50 % note d’équipe (enseignant) + 50 % participation GitHub (commits).",
      maxGrade: 20,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getStudentsRanking = async (_req, res) => {
  try {
    const students = await Student.find()
      .select("name email currentLevel githubUsername team")
      .lean();
    const studentIds = students.map((s) => s._id);
    const submissions = await Submission.find({ student: { $in: studentIds } })
      .select("student status note gradeTotal createdAt")
      .lean();
    const assignments = await Assignment.find({ students: { $in: studentIds } })
      .select("students memberFinalGrades")
      .lean();

    res.json(buildStudentsRanking(students, submissions, assignments));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Classement visible par les étudiants (masque les e-mails des autres). */
export const getStudentsRankingForStudent = async (req, res) => {
  try {
    const myId = String(req.user?.id || "");
    const students = await Student.find()
      .select("name email currentLevel githubUsername team")
      .lean();
    const studentIds = students.map((s) => s._id);
    const submissions = await Submission.find({ student: { $in: studentIds } })
      .select("student status note gradeTotal createdAt")
      .lean();
    const assignments = await Assignment.find({ students: { $in: studentIds } })
      .select("students memberFinalGrades")
      .lean();

    const { bareme, ranking } = buildStudentsRanking(students, submissions, assignments);
    const ranked = ranking.map((row, index) => {
      const isMe = row.studentId === myId;
      return {
        rank: index + 1,
        studentId: row.studentId,
        name: isMe ? row.name : row.name || "Étudiant",
        isMe,
        currentLevel: row.currentLevel,
        score: row.score,
        metrics: row.metrics,
        email: isMe ? row.email : undefined,
      };
    });
    const myRow = ranked.find((r) => r.isMe) || null;

    res.json({
      bareme,
      ranking: ranked,
      myRank: myRow?.rank ?? null,
      myEntry: myRow,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
