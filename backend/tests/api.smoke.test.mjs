import { test, before } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import buildApp from "../app.js";

const app = buildApp();

before(() => {
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = "test_secret_for_smoke_tests";
  }
});

test("GET /api/health retourne 200", async () => {
  const res = await request(app).get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});

test("GET /api/assignments sans jeton retourne 401", async () => {
  const res = await request(app).get("/api/assignments");
  assert.equal(res.status, 401);
});

test("GET /api/notifications/mine sans jeton retourne 401", async () => {
  const res = await request(app).get("/api/notifications/mine");
  assert.equal(res.status, 401);
});

test("GET /api/public/settings retourne 200", async () => {
  const res = await request(app).get("/api/public/settings");
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.allowStudentSelfRegistration, "boolean");
});
