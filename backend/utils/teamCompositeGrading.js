import { PROJECT_GRADE_MAX } from "./projectGradingRubric.js";

/** Moitié de la note /20 attribuée par l’enseignant à l’équipe. */
export const TEAM_HALF_MAX = PROJECT_GRADE_MAX / 2;

/** Moitié calculée automatiquement à partir des commits GitHub. */
export const COMMIT_HALF_MAX = PROJECT_GRADE_MAX / 2;

export function teamGradeToHalf(teamGradeTotal) {
  const t = Number(teamGradeTotal);
  if (!Number.isFinite(t)) return 0;
  return Math.round(Math.max(0, Math.min(TEAM_HALF_MAX, (t / PROJECT_GRADE_MAX) * TEAM_HALF_MAX)) * 100) / 100;
}

/**
 * Répartit 10 pts max selon la part de commits de chaque membre.
 * @param {{ members?: Array<{ studentId: string, commits: number }>, totalCommits?: number }} participation
 * @param {string[]} studentIds
 */
export function computeCommitHalfScores(participation, studentIds) {
  const ids = (studentIds || []).map(String);
  const members = Array.isArray(participation?.members) ? participation.members : [];
  const byId = new Map(members.map((m) => [String(m.studentId), Number(m.commits) || 0]));
  const totalTeamCommits = ids.reduce((s, id) => s + (byId.get(id) || 0), 0);
  const totalRepo = Number(participation?.totalCommits) || totalTeamCommits;

  const out = {};
  if (ids.length === 0) return out;

  if (totalTeamCommits <= 0) {
    const equal = Math.round((COMMIT_HALF_MAX / ids.length) * 100) / 100;
    let distributed = 0;
    ids.forEach((id, i) => {
      const v = i === ids.length - 1 ? Math.round((COMMIT_HALF_MAX - distributed) * 100) / 100 : equal;
      out[id] = {
        commits: 0,
        sharePercent: Math.round((1000 / ids.length)) / 10,
        commitHalfScore: v,
      };
      distributed += v;
    });
    return out;
  }

  let distributed = 0;
  ids.forEach((id, i) => {
    const commits = byId.get(id) || 0;
    const share = commits / totalTeamCommits;
    let half =
      i === ids.length - 1
        ? Math.round((COMMIT_HALF_MAX - distributed) * 100) / 100
        : Math.round(share * COMMIT_HALF_MAX * 100) / 100;
    half = Math.max(0, Math.min(COMMIT_HALF_MAX, half));
    distributed += half;
    out[id] = {
      commits,
      sharePercent: Math.round(share * 1000) / 10,
      commitHalfScore: half,
    };
  });

  return out;
}

export function computeMemberFinalGrades(teamGradeTotal, commitHalfByStudent) {
  const teamHalf = teamGradeToHalf(teamGradeTotal);
  const finals = {};
  for (const [sid, commitPart] of Object.entries(commitHalfByStudent || {})) {
    const commitHalf = Number(commitPart?.commitHalfScore) || 0;
    const finalTotal = Math.round(Math.min(PROJECT_GRADE_MAX, teamHalf + commitHalf) * 100) / 100;
    finals[sid] = {
      teamHalfScore: teamHalf,
      commitHalfScore: commitHalf,
      finalTotal,
      commits: commitPart.commits ?? 0,
      sharePercent: commitPart.sharePercent ?? 0,
    };
  }
  return finals;
}

export function formatMemberFinalNote(finalTotal, teamHalf, commitHalf) {
  return `${finalTotal}/${PROJECT_GRADE_MAX} (équipe ${teamHalf}/10 + commits ${commitHalf}/10)`;
}
