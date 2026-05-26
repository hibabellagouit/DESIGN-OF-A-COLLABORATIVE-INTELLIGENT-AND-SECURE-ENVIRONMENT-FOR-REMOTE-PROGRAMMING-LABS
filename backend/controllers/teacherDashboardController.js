import Assignment from "../models/Assignment.js";
import Project from "../models/Project.js";
import Submission from "../models/Submission.js";
import Student from "../models/Student.js";
import { PROJECT_GRADE_MAX } from "../utils/projectGradingRubric.js";

export async function getTeacherPending(req, res) {
  try {
    const assignments = await Assignment.find({ status: "en cours" })
      .populate("project", "title niveau submissionDeadline")
      .populate("students", "name email")
      .lean();

    const assignmentIds = assignments.map((a) => a._id);
    const subs = await Submission.find({ assignment: { $in: assignmentIds } })
      .select("assignment student gradeTotal sandboxOk createdAt")
      .lean();

    const subsByAssignment = new Map();
    for (const s of subs) {
      const aid = String(s.assignment);
      if (!subsByAssignment.has(aid)) subsByAssignment.set(aid, []);
      subsByAssignment.get(aid).push(s);
    }

    const noSubmission = [];
    const noGrade = [];
    const sandboxFailed = [];

    for (const a of assignments) {
      const aid = String(a._id);
      const list = subsByAssignment.get(aid) || [];
      const label = a.groupName || a.project?.title || "Équipe";
      if (list.length === 0) {
        noSubmission.push({
          assignmentId: aid,
          teamLabel: label,
          projectTitle: a.project?.title,
          niveau: a.niveau,
          memberCount: a.students?.length || 0,
        });
        continue;
      }
      if (!a.teamGradedAt) {
        noGrade.push({
          assignmentId: aid,
          teamLabel: label,
          projectTitle: a.project?.title,
          submissionCount: list.length,
        });
      }
      const badSandbox = list.some((s) => s.sandboxOk === false);
      if (badSandbox) {
        sandboxFailed.push({
          assignmentId: aid,
          teamLabel: label,
          projectTitle: a.project?.title,
        });
      }
    }

    const projectsNoDeadline = await Project.countDocuments({
      $or: [{ submissionDeadline: null }, { submissionDeadline: { $exists: false } }],
    });

    res.json({
      counts: {
        teamsWithoutSubmission: noSubmission.length,
        teamsWithoutGrade: noGrade.length,
        teamsSandboxIssue: sandboxFailed.length,
      },
      noSubmission,
      noGrade,
      sandboxFailed,
      projectsNoDeadline,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function exportGradesCsv(req, res) {
  try {
    const students = await Student.find().select("name email currentLevel team").lean();
    const assignments = await Assignment.find()
      .populate("project", "title niveau")
      .lean();
    const submissions = await Submission.find()
      .select("student assignment gradeTotal note createdAt")
      .lean();

    const byStudentAssignment = new Map();
    for (const s of submissions) {
      byStudentAssignment.set(`${s.student}:${s.assignment}`, s);
    }

    const header =
      "etudiant;email;niveau_actuel;projet;niveau_projet;equipe;note_finale_soumission;note_equipe;note_commits;note_finale_equipe";
    const lines = [header];

    for (const a of assignments) {
      const finals = a.memberFinalGrades || {};
      for (const st of a.students || []) {
        const sid = String(st);
        const student = students.find((x) => String(x._id) === sid);
        if (!student) continue;
        const sub = byStudentAssignment.get(`${sid}:${a._id}`);
        const fin = finals[sid] || {};
        const row = [
          csvEscape(student.name),
          csvEscape(student.email),
          student.currentLevel ?? "",
          csvEscape(a.project?.title),
          a.niveau ?? "",
          csvEscape(a.groupName),
          sub?.gradeTotal ?? "",
          a.teamGradeTotal ?? "",
          fin.commitHalfScore ?? "",
          fin.finalTotal ?? "",
        ];
        lines.push(row.join(";"));
      }
    }

    const csv = "\uFEFF" + lines.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="notes-export.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function getAiGradeCorrelation(req, res) {
  try {
    const subs = await Submission.find({
      gradeTotal: { $ne: null },
      aiGradeTotal: { $ne: null },
    })
      .select("gradeTotal aiGradeTotal student project")
      .lean();

    const pairs = subs
      .filter((s) => Number.isFinite(Number(s.gradeTotal)) && Number.isFinite(Number(s.aiGradeTotal)))
      .map((s) => ({
        submissionId: String(s._id),
        professor: Number(s.gradeTotal),
        ai: Number(s.aiGradeTotal),
        delta: Math.round((Number(s.gradeTotal) - Number(s.aiGradeTotal)) * 100) / 100,
      }));

    const n = pairs.length;
    let meanProf = 0;
    let meanAi = 0;
    if (n > 0) {
      meanProf = pairs.reduce((s, p) => s + p.professor, 0) / n;
      meanAi = pairs.reduce((s, p) => s + p.ai, 0) / n;
    }
    let num = 0;
    let dProf = 0;
    let dAi = 0;
    for (const p of pairs) {
      num += (p.professor - meanProf) * (p.ai - meanAi);
      dProf += (p.professor - meanProf) ** 2;
      dAi += (p.ai - meanAi) ** 2;
    }
    const pearson =
      n >= 2 && dProf > 0 && dAi > 0
        ? Math.round((num / Math.sqrt(dProf * dAi)) * 1000) / 1000
        : null;

    res.json({
      sampleSize: n,
      pearson,
      maxGrade: PROJECT_GRADE_MAX,
      pairs: pairs.slice(0, 100),
      hint:
        n < 3
          ? "Pas assez de soumissions avec note prof et note IA pour une corrélation fiable."
          : null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
