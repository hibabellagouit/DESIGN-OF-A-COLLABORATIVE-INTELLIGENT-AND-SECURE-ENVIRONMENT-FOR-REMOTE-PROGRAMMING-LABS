import { PROJECT_GRADE_MAX } from "./projectGradingRubric.js";

export function parseSubmissionNoteToPercent(rawNote) {
  const source = String(rawNote || "").trim().replace(",", ".");
  if (!source) return null;
  const over = source.match(/(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (over) {
    const got = Number(over[1]);
    const max = Number(over[2]);
    if (Number.isFinite(got) && Number.isFinite(max) && max > 0) {
      return Math.max(0, Math.min(100, (got / max) * 100));
    }
  }
  const percent = source.match(/(-?\d+(?:\.\d+)?)\s*%/);
  if (percent) {
    const p = Number(percent[1]);
    if (Number.isFinite(p)) return Math.max(0, Math.min(100, p));
  }
  const num = Number(source);
  if (Number.isFinite(num)) {
    if (num <= 20) return Math.max(0, Math.min(100, (num / 20) * 100));
    return Math.max(0, Math.min(100, num));
  }
  return null;
}

export const RANKING_BAREME = {
  progression: 35,
  notes: 45,
  regularite: 20,
};

export function buildStudentsRanking(students, submissions, assignments = []) {
  const BAR = RANKING_BAREME;
  const TOTAL_WEIGHT = BAR.progression + BAR.notes + BAR.regularite;

  const byStudent = new Map();
  for (const s of students) {
    byStudent.set(String(s._id), []);
  }
  for (const sub of submissions) {
    const sid = String(sub.student);
    if (!byStudent.has(sid)) byStudent.set(sid, []);
    byStudent.get(sid).push(sub);
  }

  const memberGradePercents = new Map();
  for (const a of assignments) {
    const finals = a.memberFinalGrades;
    if (finals && typeof finals === "object") {
      for (const [sid, entry] of Object.entries(finals)) {
        const gt = Number(entry?.finalTotal);
        if (!Number.isFinite(gt)) continue;
        if (!memberGradePercents.has(sid)) memberGradePercents.set(sid, []);
        memberGradePercents.get(sid).push(Math.max(0, Math.min(100, (gt / PROJECT_GRADE_MAX) * 100)));
      }
    }
  }

  const ranking = students.map((s) => {
    const sid = String(s._id);
    const rows = byStudent.get(sid) || [];
    const done = rows.filter((r) => String(r.status) === "évalué");
    const notePercents = done
      .map((r) => {
        const gt = Number(r.gradeTotal);
        if (Number.isFinite(gt)) {
          return Math.max(0, Math.min(100, (gt / PROJECT_GRADE_MAX) * 100));
        }
        return parseSubmissionNoteToPercent(r.note);
      })
      .filter((v) => Number.isFinite(v));
    const extra = memberGradePercents.get(sid) || [];
    for (const p of extra) {
      if (!notePercents.includes(p)) notePercents.push(p);
    }
    const avgNotePercent = notePercents.length
      ? notePercents.reduce((a, b) => a + b, 0) / notePercents.length
      : 0;
    const totalSubs = rows.length;
    const regularitePercent = totalSubs > 0 ? (done.length / totalSubs) * 100 : 0;
    const currentLevel = Number(s.currentLevel) || 1;
    /** Niveaux déjà validés (niveau 1 au départ = 0 % de progression). */
    const levelsValidated = Math.max(0, Math.min(4, currentLevel - 1));
    const progressionPercent = (levelsValidated / 5) * 100;
    const weightedScoreRaw =
      progressionPercent * BAR.progression +
      avgNotePercent * BAR.notes +
      regularitePercent * BAR.regularite;
    const weightedScore = weightedScoreRaw / TOTAL_WEIGHT;

    return {
      studentId: sid,
      name: s.name || "",
      email: s.email || "",
      currentLevel,
      score: Math.round(weightedScore * 100) / 100,
      metrics: {
        progressionPercent: Math.round(progressionPercent * 100) / 100,
        avgNotePercent: Math.round(avgNotePercent * 100) / 100,
        regularitePercent: Math.round(regularitePercent * 100) / 100,
        submissionsTotal: totalSubs,
        submissionsEvaluees: done.length,
      },
    };
  });

  ranking.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.metrics.avgNotePercent !== a.metrics.avgNotePercent) {
      return b.metrics.avgNotePercent - a.metrics.avgNotePercent;
    }
    return a.name.localeCompare(b.name, "fr");
  });

  return {
    bareme: {
      progression: BAR.progression,
      notes: BAR.notes,
      regularite: BAR.regularite,
      total: TOTAL_WEIGHT,
    },
    ranking,
  };
}
