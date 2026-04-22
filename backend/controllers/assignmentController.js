import Assignment from "../models/Assignment.js";
import Project from "../models/Project.js";
import Student from "../models/Student.js";

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

// 🔹 assignProject (déjà existant)
export const assignProject = async (req, res) => {
  try {
    const { projectId, students } = req.body || {};
    const project = await Project.findById(projectId);

    if (students.length > project.maxStudents) {
      return res.status(400).json({ message: "Too many students" });
    }

    for (let studentId of students) {
      const existing = await Assignment.findOne({
        students: studentId,
        status: "en cours"
      });
      if (existing) {
        return res.status(400).json({
          message: "Student already assigned to another project"
        });
      }
    }

    const assignment = new Assignment({
      project: projectId,
      students,
      niveau: project.niveau
    });

    await assignment.save();
    res.json({ message: "Project assigned", assignment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🔹 Nouvelle fonction validateAssignment
export const validateAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.body || {};

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    // changer le statut
    assignment.status = "validé";
    await assignment.save();

    // Débloquer le niveau suivant pour les étudiants affectés.
    const nextLevel = Math.min(5, (Number(assignment.niveau) || 1) + 1);
    await Student.updateMany(
      { _id: { $in: assignment.students }, currentLevel: { $lt: nextLevel } },
      { $set: { currentLevel: nextLevel } }
    );

    res.json({ message: "Assignment validated", assignment });
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

    const currentLevel = Number(student.currentLevel) || 1;
    const projects = await Project.find().sort({ niveau: 1, title: 1 });

    const assigned = await Assignment.find({ students: studentId }).select("project status");
    const assignedProjectIds = new Set(assigned.map((a) => String(a.project)));

    const mapped = projects.map((p) => {
      const niveau = Number(p.niveau) || 1;
      return {
        ...p.toObject(),
        isLocked: niveau > currentLevel,
        isAssigned: assignedProjectIds.has(String(p._id)),
      };
    });

    res.json({ currentLevel, projects: mapped });
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

    const currentLevel = Number(student.currentLevel) || 1;
    const projectLevel = Number(project.niveau) || 1;
    if (projectLevel > currentLevel) {
      return res.status(400).json({ message: "Niveau verrouillé pour cet étudiant" });
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

    res.status(201).json({ message: "Projet sélectionné", assignment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};