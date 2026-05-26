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
} from "../helpers/fixtures.mjs";

let app;

describe("Sandbox intégration (service mocké)", () => {
  before(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "integration_test_secret";
    process.env.SANDBOX_AUTO_ON_SUBMIT = "false";
    process.env.INTEGRATION_TEST_MOCK_SANDBOX = "true";
    await startTestMongo();
    const { default: buildApp } = await import("../../app.js");
    app = buildApp();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  after(async () => {
    delete process.env.INTEGRATION_TEST_MOCK_SANDBOX;
    await stopTestMongo();
  });

  test("POST /api/jobs/sandbox termine avec succès (mock)", async () => {
    const { token: teacherToken } = await registerTeacher(app);
    const { student } = await registerStudent(app);
    const { assignment, project } = await seedProjectAndAssignment([student._id]);
    const sub = await seedGithubSubmission({
      assignment,
      project,
      studentId: student._id,
    });

    const enqueue = await request(app)
      .post("/api/jobs/sandbox")
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
      assert.equal(poll.status, 200);
      lastBody = poll.body;
      status = poll.body.status;
    }

    assert.equal(status, "done");
    assert.equal(lastBody.result?.ok, true);
  });

  test("étudiant ne peut pas lancer un job sandbox → 403", async () => {
    const { token: studentToken, student } = await registerStudent(app);
    const { assignment, project } = await seedProjectAndAssignment([student._id]);
    const sub = await seedGithubSubmission({
      assignment,
      project,
      studentId: student._id,
    });

    const res = await request(app)
      .post("/api/jobs/sandbox")
      .set(authHeader(studentToken))
      .send({ submissionId: String(sub._id) });

    assert.equal(res.status, 403);
  });
});
