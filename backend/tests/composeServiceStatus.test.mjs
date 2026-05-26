import test from "node:test";
import assert from "node:assert/strict";
import { buildServicesReport } from "../utils/composeServiceStatus.js";

test("buildServicesReport détecte frontend absent", () => {
  const ps = `{"Name":"sandboxd747a7a7ed-backend-1","Service":"backend","State":"running","Status":"Up"}
{"Name":"sandboxd747a7a7ed-frontend-1","Service":"frontend","State":"exited","Status":"Exited (1) 3 seconds ago"}`;
  const report = buildServicesReport(ps, ["backend", "frontend"]);
  assert.equal(report.runningCount, 1);
  assert.equal(report.notRunning.length, 1);
  assert.equal(report.notRunning[0].service, "frontend");
  assert.equal(report.allRunning, false);
});
