import request from "supertest";
import Project from "../../models/Project.js";
import Assignment from "../../models/Assignment.js";
import Submission from "../../models/Submission.js";
import { PROJECT_GRADING_CRITERIA } from "../../utils/projectGradingRubric.js";

const TS = Date.now();

export function uniqueEmail(prefix) {
  return `${prefix}-${TS}-${Math.random().toString(36).slice(2, 8)}@test.local`;
}

/** Barème complet /20 pour les tests grade-team. */
export function fullRubricScores() {
  const scores = {};
  for (const c of PROJECT_GRADING_CRITERIA) {
    scores[c.id] = c.maxPoints;
  }
  return scores;
}

export async function registerTeacher(app, overrides = {}) {
  const email = overrides.email || uniqueEmail("teacher");
  const res = await request(app)
    .post("/api/teachers/register")
    .send({
      name: overrides.name || "Prof Test",
      email,
      password: overrides.password || "TeacherPass1!",
    });
  return { res, email, token: res.body?.token, teacher: res.body?.teacher };
}

export async function registerStudent(app, overrides = {}) {
  const email = overrides.email || uniqueEmail("student");
  const res = await request(app)
    .post("/api/students/register")
    .send({
      name: overrides.name || "Étudiant Test",
      email,
      password: overrides.password || "StudentPass1!",
      githubUsername: overrides.githubUsername || "octocat",
    });
  return { res, email, token: res.body?.token, student: res.body?.student };
}

export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

export async function seedProjectAndAssignment(studentIds, overrides = {}) {
  const project = await Project.create({
    title: overrides.projectTitle || "Projet intégration",
    description: "Test",
    niveau: overrides.niveau ?? 1,
    maxStudents: 3,
    composeFileOriginalName: "docker-compose.yml",
    composeFileStoredName: "test-compose.yml",
    composeFileMimeType: "text/yaml",
    submissionDeadline: overrides.submissionDeadline ?? null,
  });

  const assignment = await Assignment.create({
    project: project._id,
    students: studentIds,
    status: "en cours",
    niveau: project.niveau,
    groupName: overrides.groupName || "Équipe Test",
  });

  return { project, assignment };
}

export async function seedGithubSubmission({ assignment, project, studentId }) {
  return Submission.create({
    assignment: assignment._id,
    project: project._id,
    student: studentId,
    status: "en attente",
    kind: "github",
    githubUrl: "https://github.com/octocat/Hello-World",
    fileOriginalName: "Lien GitHub",
    fileMimeType: "text/x-github-url",
  });
}
