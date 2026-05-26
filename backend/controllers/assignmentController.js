import Assignment from "../models/Assignment.js";
import Project from "../models/Project.js";
import Student from "../models/Student.js";
import { notifyAllTeachers, notifyStudents } from "../services/notificationService.js";
import {
  computeAllowedSelectLevel,
  assertPriorLevelsValidated,
  assertCanSelectProjectLevel,
} from "../utils/studentLevelProgress.js";
import { loadTeamForStudent, teamMemberIds } from "../utils/teamContext.js";
import { teamSummaryPayload } from "../utils/teamPopulate.js";
import { studentHasGithubUsername } from "../utils/studentGithub.js";
import Submission from "../models/Submission.js";
import {
  validateRubricScoresForGrade,
  formatGradeNote,
  getProjectGradingRubric,
  PROJECT_GRADE_MAX,
} from "../utils/projectGradingRubric.js";
import { submissionStatusForApi } from "../utils/submissionStatus.js";
import {
  computeGithubParticipation,
  findGithubUrlForAssignment,
} from "../services/githubParticipationService.js";
import {
  computeCommitHalfScores,
  computeMemberFinalGrades,
  formatMemberFinalNote,
} from "../utils/teamCompositeGrading.js";

async function syncStudentAllowedLevel(studentId) {
  const allowed = await computeAllowedSelectLevel(studentId);
  await Student.findByIdAndUpdate(studentId, { $set: { currentLevel: allowed } });
  return allowed;
}

/** Compte les équipes (pas les étudiants) sur un projet en cours. */
async function countActiveTeamsOnProject(projectId) {
  return Assignment.countDocuments({ project: projectId, status: "en cours" });
}

async function assertEveryStudentHasGithub(studentIds) {
  const studs = await Student.find({ _id: { $in: studentIds } })
    .select("name email githubUsername")
    .lean();
  const missing = studs.filter((s) => !studentHasGithubUsername(s));
  if (missing.length === 0) return null;
  const label = missing.length === 1 ? " doit avoir" : " doivent tous avoir";
  const names = missing.map((m) => m.name || m.email || "Un étudiant").join(", ");
  return `${names}${label} un compte GitHub renseigné.`;
}

export const getAssignmentsForStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const assignments = await Assignment.find({ students: studentId })
      .populate("project")
      .populate("students")
      .populate({
        path: "team",
        select: "name leader",
        populate: { path: "leader", select: "name email" },
      });

    res.json(assignments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Désactivé : seules les équipes choisissent leur projet. L’enseignant valide pour débloquer le niveau suivant. */
export const assignProject = async (_req, res) => {
  return res.status(403).json({
    message:
      "L’enseignant ne peut pas affecter un projet à une équipe. Les équipes choisissent leur sujet sur chaque niveau ; validez le travail pour débloquer le niveau suivant.",
  });
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
    const teamLabel = assignment.groupName ? ` (équipe ${assignment.groupName})` : "";
    const nextLevel = Math.min(5, niveau + 1);
    const body =
      niveau >= 5
        ? `Le projet « ${ptitle} »${teamLabel} (niveau ${niveau}) est validé. Parcours terminé.`
        : `Le projet « ${ptitle} »${teamLabel} (niveau ${niveau}) est validé. Votre équipe peut choisir un projet de niveau ${nextLevel}.`;

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
      message: `Niveau ${niveau} validé pour l’équipe. Le niveau ${nextLevel} est débloqué.`,
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

    const team = await loadTeamForStudent(studentId);
    if (!team) {
      return res.status(400).json({
        message:
          "Vous devez appartenir à une équipe. Demandez à votre enseignant de vous inscrire dans une équipe.",
      });
    }

    const memberIds = teamMemberIds(team);
    const ghErr = await assertEveryStudentHasGithub(memberIds);
    if (ghErr) {
      return res.status(400).json({ message: ghErr });
    }

    const allowed = await computeAllowedSelectLevel(studentId);
    if (Number(student.currentLevel) !== allowed) {
      await Student.findByIdAndUpdate(studentId, { $set: { currentLevel: allowed } });
    }

    const projects = await Project.find().sort({ niveau: 1, title: 1 });

    const teamAssignments = await Assignment.find({ team: team._id }).select(
      "project status niveau"
    );
    const teamProjectIds = new Set(teamAssignments.map((a) => String(a.project)));

    const activeOnProject = await Assignment.find({ status: "en cours" }).select("project");
    const teamsPerProject = new Map();
    for (const a of activeOnProject) {
      const pid = String(a.project);
      teamsPerProject.set(pid, (teamsPerProject.get(pid) || 0) + 1);
    }

    const mapped = projects.map((p) => {
      const niveau = Number(p.niveau) || 1;
      const pid = String(p._id);
      const teamsTaken = teamsPerProject.get(pid) || 0;
      const maxTeams = Number(p.maxStudents) || 1;
      return {
        ...p.toObject(),
        isLocked: niveau > allowed,
        isAssigned: teamProjectIds.has(pid),
        teamsTaken,
        teamsAvailable: Math.max(0, maxTeams - teamsTaken),
        maxTeams,
      };
    });

    res.json({
      currentLevel: allowed,
      highestValidatedLevel: Math.max(0, allowed - 1),
      team: teamSummaryPayload(team),
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

    const team = await loadTeamForStudent(studentId);
    if (!team) {
      return res.status(400).json({
        message:
          "Vous devez appartenir à une équipe. Demandez à votre enseignant de vous inscrire dans une équipe.",
      });
    }

    const memberIds = teamMemberIds(team);
    if (!memberIds.includes(String(studentId))) {
      return res.status(403).json({ message: "Vous ne faites pas partie de cette équipe." });
    }

    const ghErrSelect = await assertEveryStudentHasGithub(memberIds);
    if (ghErrSelect) {
      return res.status(400).json({ message: ghErrSelect });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const projectLevel = Number(project.niveau) || 1;

    const priorErr = await assertPriorLevelsValidated(memberIds, projectLevel);
    if (priorErr) {
      return res.status(400).json({ message: priorErr });
    }

    for (const mid of memberIds) {
      const gate = await assertCanSelectProjectLevel(mid, projectLevel);
      if (!gate.ok) {
        return res.status(400).json({ message: gate.message });
      }
    }

    const teamActive = await Assignment.findOne({
      team: team._id,
      status: "en cours",
    });
    if (teamActive) {
      return res.status(400).json({
        message:
          "Votre équipe a déjà un projet en cours. Terminez-le (validation enseignant) avant d’en choisir un autre.",
      });
    }

    const sameTeamProject = await Assignment.findOne({
      project: projectId,
      team: team._id,
    });
    if (sameTeamProject) {
      return res.status(400).json({ message: "Votre équipe a déjà travaillé sur ce projet." });
    }

    const teamsOnProject = await countActiveTeamsOnProject(projectId);
    const maxTeams = Number(project.maxStudents) || 1;
    if (teamsOnProject >= maxTeams) {
      return res.status(400).json({
        message: "Nombre maximum d’équipes atteint pour ce projet.",
      });
    }

    const assignment = new Assignment({
      project: projectId,
      students: memberIds,
      niveau: projectLevel,
      team: team._id,
      groupName: team.name,
    });
    await assignment.save();

    try {
      await notifyAllTeachers({
        type: "student_selected_project",
        title: "Choix de projet (équipe)",
        body: `L’équipe « ${team.name} » a choisi le projet « ${project.title || "Projet"} » (niveau ${projectLevel}).`,
        meta: {
          projectId: String(projectId),
          teamId: String(team._id),
          assignmentId: String(assignment._id),
        },
      });
      await notifyStudents(memberIds, {
        type: "team_project_selected",
        title: "Projet choisi",
        body: `Votre équipe « ${team.name} » travaille sur « ${project.title || "Projet"} » (niveau ${projectLevel}).`,
        meta: { projectId: String(projectId), assignmentId: String(assignment._id) },
      });
    } catch (e) {
      console.error("notify", e);
    }

    res.status(201).json({ message: "Projet choisi par l’équipe", assignment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Note d’équipe (50 %) + répartition commits (50 %) → note finale par membre. */
export const gradeAssignmentTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { rubricScores, gradeComment, markEvaluated } = req.body || {};
    const assignment = await Assignment.findById(id).populate(
      "students",
      "name email githubUsername"
    );
    if (!assignment) return res.status(404).json({ message: "Affectation introuvable" });

    const validation = validateRubricScoresForGrade(rubricScores, { requireAll: true });
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    const studentIds = (assignment.students || []).map((s) => String(s._id));
    if (studentIds.length === 0) {
      return res.status(400).json({ message: "Aucun membre dans cette équipe." });
    }

    assignment.teamRubricScores = validation.scores;
    assignment.teamGradeTotal = validation.total;
    assignment.teamGradeComment = String(gradeComment || "").trim().slice(0, 2000);
    assignment.teamGradedAt = new Date();

    let participation = assignment.githubParticipation;
    const githubUrl = await findGithubUrlForAssignment(assignment._id);
    if (githubUrl) {
      try {
        participation = await computeGithubParticipation({
          githubUrl,
          teamStudents: assignment.students,
        });
        assignment.githubParticipation = participation;
        assignment.githubParticipationSyncedAt = new Date();
      } catch (e) {
        console.error("gradeAssignmentTeam github", e.message);
      }
    }

    const commitHalf = computeCommitHalfScores(participation, studentIds);
    assignment.memberCommitScores = commitHalf;
    const finals = computeMemberFinalGrades(validation.total, commitHalf);
    assignment.memberFinalGrades = finals;
    assignment.markModified("teamRubricScores");
    assignment.markModified("memberCommitScores");
    assignment.markModified("memberFinalGrades");
    if (assignment.githubParticipation) assignment.markModified("githubParticipation");

    await assignment.save();

    const shouldEvaluate = markEvaluated !== false;
    const subs = await Submission.find({ assignment: assignment._id });
    for (const sub of subs) {
      const sid = String(sub.student);
      const fin = finals[sid];
      if (!fin) continue;
      sub.gradeTotal = fin.finalTotal;
      sub.gradeComment = assignment.teamGradeComment;
      sub.note = formatMemberFinalNote(fin.finalTotal, fin.teamHalfScore, fin.commitHalfScore);
      sub.rubricScores = validation.scores;
      if (shouldEvaluate) {
        const current = submissionStatusForApi(sub.status);
        if (current === "en attente" || current === "en cours d'évaluation") {
          sub.status = "évalué";
        }
      }
      await sub.save();
    }

    const project = await Project.findById(assignment.project).select("title").lean();
    const ptitle = project?.title || "Projet";
    if (shouldEvaluate) {
      try {
        await notifyStudents(studentIds, {
          type: "submission_status",
          title: "Travail évalué",
          body: `Note pour « ${ptitle} » : équipe ${validation.total}/${PROJECT_GRADE_MAX} + participation GitHub.`,
          meta: {
            assignmentId: String(assignment._id),
            projectId: String(assignment.project),
            status: "évalué",
          },
        });
      } catch (e) {
        console.error("notify gradeAssignmentTeam", e);
      }
    }

    res.json({
      message: `Note d’équipe enregistrée (${validation.total}/${PROJECT_GRADE_MAX}). Notes individuelles calculées (50 % équipe + 50 % commits).`,
      assignment: assignment.toObject(),
      rubric: getProjectGradingRubric(),
      memberFinalGrades: finals,
    });
  } catch (error) {
    console.error("gradeAssignmentTeam", error);
    res.status(500).json({ message: error.message || "Erreur serveur", error: error.message });
  }
};
