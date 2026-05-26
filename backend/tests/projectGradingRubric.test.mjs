import test from "node:test";
import assert from "node:assert/strict";
import {
  computeGradeTotal,
  validateRubricScoresForGrade,
  formatGradeNote,
  PROJECT_GRADE_MAX,
} from "../utils/projectGradingRubric.js";

test("computeGradeTotal sums criteria within caps", () => {
  const total = computeGradeTotal({
    cahier_charges: 6,
    fonctionnalite: 4,
    qualite_code: 3,
    docker_tests: 2,
    documentation: 2,
  });
  assert.equal(total, 17);
});

test("validateRubricScoresForGrade rejects incomplete barème", () => {
  const r = validateRubricScoresForGrade({ cahier_charges: 5 }, { requireAll: true });
  assert.equal(r.ok, false);
});

test("formatGradeNote uses /20", () => {
  assert.equal(formatGradeNote(15.5, ""), `15.5/${PROJECT_GRADE_MAX}`);
});
