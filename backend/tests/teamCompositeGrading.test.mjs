import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeCommitHalfScores,
  computeMemberFinalGrades,
  teamGradeToHalf,
} from "../utils/teamCompositeGrading.js";

describe("teamCompositeGrading", () => {
  it("teamGradeToHalf maps /20 to /10", () => {
    assert.equal(teamGradeToHalf(16), 8);
    assert.equal(teamGradeToHalf(0), 0);
  });

  it("splits commit half by share", () => {
    const participation = {
      totalCommits: 10,
      members: [
        { studentId: "a", commits: 7 },
        { studentId: "b", commits: 3 },
      ],
    };
    const half = computeCommitHalfScores(participation, ["a", "b"]);
    assert.equal(half.a.commits, 7);
    assert.equal(half.b.commits, 3);
    assert.equal(half.a.commitHalfScore + half.b.commitHalfScore, 10);
  });

  it("combines team and commit halves", () => {
    const commitHalf = {
      a: { commitHalfScore: 6, commits: 6, sharePercent: 60 },
      b: { commitHalfScore: 4, commits: 4, sharePercent: 40 },
    };
    const finals = computeMemberFinalGrades(16, commitHalf);
    assert.equal(finals.a.teamHalfScore, 8);
    assert.equal(finals.a.finalTotal, 14);
    assert.equal(finals.b.finalTotal, 12);
  });
});
