import { describe, before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import {
  startTestMongo,
  stopTestMongo,
  clearCollections,
} from "../helpers/mongoTestContext.mjs";
import {
  registerTeacher,
  registerStudent,
  authHeader,
  seedProjectAndAssignment,
  seedGithubSubmission,
  fullRubricScores,
} from "../helpers/fixtures.mjs";

let app;

describe("API intégration (MongoDB mémoire)", () => {
  before(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "integration_test_secret";
    process.env.SANDBOX_AUTO_ON_SUBMIT = "false";
    process.env.INTEGRATION_TEST_MOCK_GITHUB = "true";
    await startTestMongo();
    const { default: buildApp } = await import("../../app.js");
    app = buildApp();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  after(async () => {
    delete process.env.INTEGRATION_TEST_MOCK_GITHUB;
    await stopTestMongo();
  });

  describe("Auth enseignant / étudiant", () => {
    test("inscription et connexion enseignant", async () => {
      const { res: reg, token } = await registerTeacher(app);
      assert.equal(reg.status, 201);
      assert.ok(token);

      const login = await request(app)
        .post("/api/teachers/login")
        .send({ email: reg.body.teacher.email, password: "TeacherPass1!" });
      assert.equal(login.status, 200);
      assert.ok(login.body.token);
    });

    test("inscription et connexion étudiant (GitHub requis)", async () => {
      const { res: reg, token } = await registerStudent(app);
      assert.equal(reg.status, 201);
      assert.ok(token);
      assert.equal(reg.body.student.githubUsername, "octocat");

      const login = await request(app)
        .post("/api/students/login")
        .send({ email: reg.body.student.email, password: "StudentPass1!" });
      assert.equal(login.status, 200);
      assert.ok(login.body.token);
    });

    test("login étudiant — mauvais mot de passe → 401", async () => {
      const { res: reg } = await registerStudent(app);
      assert.equal(reg.status, 201);
      const login = await request(app)
        .post("/api/students/login")
        .send({ email: reg.body.student.email, password: "wrong" });
      assert.equal(login.status, 401);
    });

    test("route protégée sans jeton → 401", async () => {
      const res = await request(app).get("/api/students/me");
      assert.equal(res.status, 401);
    });
  });

  describe("Soumission GitHub", () => {
    test("étudiant soumet un lien GitHub", async () => {
      const { token, student } = await registerStudent(app);
      const { assignment } = await seedProjectAndAssignment([student._id]);

      const res = await request(app)
        .post("/api/submissions")
        .set(authHeader(token))
        .set("Content-Type", "application/json")
        .send({
          assignmentId: String(assignment._id),
          githubUrl: "https://github.com/octocat/Hello-World",
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.submission?.kind, "github");
      assert.ok(res.body.submission?.githubUrl.includes("github.com"));
    });

    test("soumission refusée après date limite", async () => {
      const { token, student } = await registerStudent(app);
      const past = new Date(Date.now() - 60_000);
      const { assignment } = await seedProjectAndAssignment([student._id], {
        submissionDeadline: past,
      });

      const res = await request(app)
        .post("/api/submissions")
        .set(authHeader(token))
        .set("Content-Type", "application/json")
        .send({
          assignmentId: String(assignment._id),
          githubUrl: "https://github.com/octocat/Hello-World",
        });

      assert.equal(res.status, 400);
      assert.match(res.body.message || "", /limite/i);
    });
  });

  describe("Notation équipe (grade-team)", () => {
    test("enseignant note l’équipe et calcule les notes finales", async () => {
      const { token: teacherToken } = await registerTeacher(app);
      const { token: s1Token, student: s1 } = await registerStudent(app, {
        githubUsername: "alice-dev",
      });
      const { student: s2 } = await registerStudent(app, { githubUsername: "bob-dev" });
      const { assignment, project } = await seedProjectAndAssignment([s1._id, s2._id]);

      await seedGithubSubmission({
        assignment,
        project,
        studentId: s1._id,
      });

      const grade = await request(app)
        .patch(`/api/assignments/${assignment._id}/grade-team`)
        .set(authHeader(teacherToken))
        .send({
          rubricScores: fullRubricScores(),
          gradeComment: "Bon travail d’équipe",
          markEvaluated: true,
        });

      assert.equal(grade.status, 200);
      assert.equal(grade.body.assignment.teamGradeTotal, 20);
      const finals = grade.body.memberFinalGrades || {};
      assert.ok(finals[String(s1._id)]);
      assert.ok(finals[String(s2._id)]);
      assert.equal(finals[String(s1._id)].teamHalfScore, 10);
      assert.equal(finals[String(s1._id)].finalTotal, 15);

      const me = await request(app)
        .get("/api/students/me/grades")
        .set(authHeader(s1Token));
      assert.equal(me.status, 200);
      const row = (me.body.grades || []).find(
        (g) => String(g.assignmentId) === String(assignment._id)
      );
      assert.ok(row);
      assert.equal(row.teamGradeTotal, 20);
      assert.equal(row.teamHalfScore, 10);
      assert.equal(row.commitHalfScore, 5);
      assert.equal(row.finalTotal, 15);
    });

    test("grade-team sans jeton → 401", async () => {
      const { student: s1 } = await registerStudent(app);
      const { assignment } = await seedProjectAndAssignment([s1._id]);
      const res = await request(app)
        .patch(`/api/assignments/${assignment._id}/grade-team`)
        .send({ rubricScores: fullRubricScores() });
      assert.equal(res.status, 401);
    });
  });

  describe("Job Ollama (file d’attente)", () => {
    test("POST /api/jobs/ollama termine avec note mockée", async () => {
      const { token: teacherToken } = await registerTeacher(app);
      const { student } = await registerStudent(app);
      const { assignment, project } = await seedProjectAndAssignment([student._id]);
      const sub = await seedGithubSubmission({
        assignment,
        project,
        studentId: student._id,
      });

      const enqueue = await request(app)
        .post("/api/jobs/ollama")
        .set(authHeader(teacherToken))
        .send({ submissionId: String(sub._id) });

      assert.equal(enqueue.status, 202);
      assert.ok(enqueue.body.jobId);

      let status = "pending";
      let lastBody = {};
      for (let i = 0; i < 30 && status !== "done" && status !== "failed"; i += 1) {
        await new Promise((r) => setTimeout(r, 50));
        const poll = await request(app)
          .get(`/api/jobs/${enqueue.body.jobId}`)
          .set(authHeader(teacherToken));
        lastBody = poll.body;
        status = poll.body.status;
      }

      assert.equal(status, "done");
      assert.ok(lastBody.result?.preliminary?.gradeTotal > 0);
    });
  });
});
