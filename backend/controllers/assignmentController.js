import Assignment from "../models/Assignment.js";
import Project from "../models/Project.js";
import Student from "../models/Student.js";
import { notifyAllTeachers, notifyStudents } from "../services/notificationService.js";
import {
  computeAllowedSelectLevel,
  assertPriorLevelsValidated,
  assertCanSelectProjectLevel,
} from "../utils/studentLevelProgress.js";

async function syncStudentAllowedLevel(studentId) {
  const allowed = await computeAllowedSelectLevel(studentId);
  await Student.findByIdAndUpdate(studentId, { $set: { currentLevel: allowed } });
  return allowed;
}

export const getAssignmentsForStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const assignments = await Assignment.find({ students: studentId })
      .populate("project")
      .populate("students");

    res.json(assignments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const assignProject = async (req, res) => {
  try {
    const { projectId, students, groupName: rawGroupName } = req.body || {};
    const groupName = String(rawGroupName || "")
      .trim()
      .slice(0, 120);
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Projet introuvable" });
    }

    if (students.length > project.maxStudents) {
      return res.status(400).json({
        message: "Trop d’étudiants pour ce projet (limite du sujet dépassée).",
      });
    }

    const projectLevel = Number(project.niveau) || 1;

    for (const studentId of students) {
      const priorErr = await assertPriorLevelsValidated([studentId], projectLevel);
      if (priorErr) {
        return res.status(400).json({ message: priorErr });
      }
      const gate = await assertCanSelectProjectLevel(studentId, projectLevel);
      if (!gate.ok) {
        return res.status(400).json({ message: gate.message });
      }

      const existing = await Assignment.findOne({
        students: studentId,
        status: "en cours",
      });
      if (existing) {
        return res.status(400).json({
          message:
            "Un ou plusieurs étudiants sont déjà affectés à un autre projet en cours.",
        });
      }
    }

    const assignment = new Assignment({
      project: projectId,
      students,
      niveau: projectLevel,
      groupName,
    });

    await assignment.save();

    const title = project.title || "Projet";
    try {
      await notifyStudents(students, {
        type: "assignment_created",
        title: "Nouvelle affectation",
        body: groupName
          ? `Vous avez été affecté au projet « ${title} » (niveau ${projectLevel}, ${groupName}).`
          : `Vous avez été affecté au projet « ${title} » (niveau ${projectLevel}).`,
        meta: { projectId: String(projectId), assignmentId: String(assignment._id) },
      });
    } catch (e) {
      console.error("notifyStudents", e);
    }

    res.json({ message: "Project assigned", assignment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const validateAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.body || {};

    const assignment = await Assignment.findById(assignmentId).populate("project");
    if (!assignment) {
      return res.status(404).json({ message: "Affectation introuvable" });
    }

    if (String(assignment.status) === "validé") {
      return res.status(400).json({ message: "Cette affectation est déjà validée." });
    }

    const niveau = Number(assignment.niveau) || 1;
    const studentIds = assignment.students || [];

    const priorErr = await assertPriorLevelsValidated(studentIds, niveau);
    if (priorErr) {
      return res.status(400).json({ message: priorErr });
    }

    assignment.status = "validé";
    await assignment.save();

    const unlockedByStudent = {};
    for (const sid of studentIds) {
      unlockedByStudent[String(sid)] = await syncStudentAllowedLevel(sid);
    }

    const ptitle = assignment.project?.title || "Projet";
    const nextLevel = Math.min(5, niveau + 1);
    const body =
      niveau >= 5
        ? `Votre travail sur « ${ptitle} » (niveau ${niveau}) est validé. Parcours terminé.`
        : `Votre travail sur « ${ptitle} » (niveau ${niveau}) est validé. Vous pouvez choisir un projet de niveau ${nextLevel}.`;

    try {
      await notifyStudents(studentIds, {
        type: "assignment_validated",
        title: `Niveau ${niveau} validé`,
        body,
        meta: {
          projectId: assignment.project?._id ? String(assignment.project._id) : "",
          assignmentId: String(assignment._id),
          niveau,
          nextUnlockedLevel: niveau < 5 ? nextLevel : null,
        },
      });
    } catch (e) {
      console.error("notifyStudents", e);
    }

    res.json({
      message: `Niveau ${niveau} validé. Le niveau ${nextLevel} est débloqué pour les étudiants concernés.`,
      assignment,
      unlockedByStudent,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getSelectableProjectsForStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const allowed = await computeAllowedSelectLevel(studentId);
    if (Number(student.currentLevel) !== allowed) {
      await Student.findByIdAndUpdate(studentId, { $set: { currentLevel: allowed } });
    }

    const projects = await Project.find().sort({ niveau: 1, title: 1 });

    const assigned = await Assignment.find({ students: studentId }).select("project status niveau");
    const assignedProjectIds = new Set(assigned.map((a) => String(a.project)));

    const mapped = projects.map((p) => {
      const niveau = Number(p.niveau) || 1;
      return {
        ...p.toObject(),
        isLocked: niveau > allowed,
        isAssigned: assignedProjectIds.has(String(p._id)),
      };
    });

    res.json({
      currentLevel: allowed,
      /** Niveau le plus élevé déjà validé (0 si aucun) */
      highestValidatedLevel: Math.max(0, allowed - 1),
      projects: mapped,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const selectProjectForStudent = async (req, res) => {
  try {
    const { studentId, projectId } = req.body || {};
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const projectLevel = Number(project.niveau) || 1;

    const priorErr = await assertPriorLevelsValidated([studentId], projectLevel);
    if (priorErr) {
      return res.status(400).json({ message: priorErr });
    }

    const gate = await assertCanSelectProjectLevel(studentId, projectLevel);
    if (!gate.ok) {
      return res.status(400).json({ message: gate.message });
    }

    const alreadyActive = await Assignment.findOne({
      students: studentId,
      status: "en cours",
    });
    if (alreadyActive) {
      return res
        .status(400)
        .json({ message: "Validez d'abord le projet en cours avant d'en choisir un autre" });
    }

    const sameProjectAlreadyAssigned = await Assignment.findOne({
      project: projectId,
      students: studentId,
    });
    if (sameProjectAlreadyAssigned) {
      return res.status(400).json({ message: "Projet déjà sélectionné par cet étudiant" });
    }

    const activeAssignments = await Assignment.find({
      project: projectId,
      status: "en cours",
    }).select("students");
    const activeSeats = activeAssignments.reduce(
      (sum, a) => sum + (a.students?.length || 0),
      0
    );
    if (activeSeats >= (Number(project.maxStudents) || 1)) {
      return res.status(400).json({ message: "Capacité maximale atteinte pour ce projet" });
    }

    const assignment = new Assignment({
      project: projectId,
      students: [studentId],
      niveau: projectLevel,
    });
    await assignment.save();

    const stu = await Student.findById(studentId).select("name email").lean();
    const label = stu?.name || stu?.email || "Un étudiant";
    try {
      await notifyAllTeachers({
        type: "student_selected_project",
        title: "Choix de projet",
        body: `${label} a sélectionné le projet « ${project.title || "Projet"} » (niveau ${projectLevel}).`,
        meta: { projectId: String(projectId), studentId: String(studentId), assignmentId: String(assignment._id) },
      });
    } catch (e) {
      console.error("notifyAllTeachers", e);
    }

    res.status(201).json({ message: "Projet sélectionné", assignment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
