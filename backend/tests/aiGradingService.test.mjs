import test from "node:test";
import assert from "node:assert/strict";
import { parseAiGradingJson } from "../services/aiGradingService.js";

test("parseAiGradingJson accepts valid rubric", () => {
  const r = parseAiGradingJson(
    JSON.stringify({
      rubricScores: {
        cahier_charges: 5,
        fonctionnalite: 4,
        qualite_code: 3,
        docker_tests: 2,
        documentation: 1.5,
      },
      comment: "Bon travail.",
      summary: "Projet solide.",
    })
  );
  assert.equal(r.gradeTotal, 15.5);
  assert.equal(r.rubricScores.cahier_charges, 5);
});

test("parseAiGradingJson rejects incomplete rubric", () => {
  assert.throws(() =>
    parseAiGradingJson(JSON.stringify({ rubricScores: { cahier_charges: 3 } }))
  );
});
