import Submission from "../models/Submission.js";
import { parseGithubRepoForApi, matchCommitToStudent } from "../utils/githubUrl.js";
import { resolveGithubToken } from "../utils/githubToken.js";
import {
  fetchContributorsForRepo,
  fetchAllCommitsForRepo,
} from "./githubCommitsService.js";

function buildMembersFromContributors(students, contributors) {
  const byLogin = new Map(
    contributors.map((c) => [String(c.login || "").trim().toLowerCase(), c.contributions || 0])
  );
  const teamLogins = new Set();
  const members = students
    .map((stu) => {
      const sid = String(stu._id);
      const login = String(stu.githubUsername || "").trim().toLowerCase();
      if (login) teamLogins.add(login);
      const n = login ? byLogin.get(login) || 0 : 0;
      return {
        studentId: sid,
        name: stu.name || "",
        email: stu.email || "",
        githubUsername: stu.githubUsername || "",
        commits: n,
        sharePercent: 0,
        lastCommitAt: null,
        matchedBy: n > 0 && login ? "githubUsername" : null,
      };
    })
    .sort((a, b) => b.commits - a.commits);

  const totalCommits = members.reduce((s, m) => s + m.commits, 0) || 1;
  for (const m of members) {
    m.sharePercent = Math.round((1000 * m.commits) / totalCommits) / 10;
  }

  const unmatchedAuthors = contributors
    .filter((c) => {
      const login = String(c.login || "").trim().toLowerCase();
      return login && !teamLogins.has(login) && (c.contributions || 0) > 0;
    })
    .map((c) => ({
      identifier: c.login,
      commits: c.contributions || 0,
    }))
    .sort((a, b) => b.commits - a.commits);

  return { members, totalCommits: members.reduce((s, m) => s + m.commits, 0), unmatchedAuthors };
}

function buildMembersFromCommits(students, commits, truncated) {
  const counts = new Map();
  const lastDates = new Map();
  const matchKind = new Map();
  for (const stu of students) {
    const sid = String(stu._id);
    counts.set(sid, 0);
    lastDates.set(sid, null);
    matchKind.set(sid, null);
  }

  const unknownKeyToCount = new Map();
  for (const c of commits) {
    const hit = matchCommitToStudent(c, students);
    const when = c.commit?.committer?.date || c.commit?.author?.date || null;
    if (hit?.student) {
      const sid = String(hit.student._id);
      if (counts.has(sid)) {
        counts.set(sid, (counts.get(sid) || 0) + 1);
        matchKind.set(sid, hit.match);
        if (when) {
          const prev = lastDates.get(sid);
          const t = new Date(when).getTime();
          if (!prev || t > new Date(prev).getTime()) {
            lastDates.set(sid, when);
          }
        }
      }
    } else {
      const email = String(c.commit?.author?.email || "").trim().toLowerCase();
      const login = String(c.author?.login || "").trim().toLowerCase();
      const key = email || login || "inconnu";
      unknownKeyToCount.set(key, (unknownKeyToCount.get(key) || 0) + 1);
    }
  }

  const totalCommits = commits.length || 1;
  const members = students
    .map((stu) => {
      const sid = String(stu._id);
      const n = counts.get(sid) || 0;
      return {
        studentId: sid,
        name: stu.name || "",
        email: stu.email || "",
        githubUsername: stu.githubUsername || "",
        commits: n,
        sharePercent: Math.round((1000 * n) / totalCommits) / 10,
        lastCommitAt: lastDates.get(sid),
        matchedBy: matchKind.get(sid) || null,
      };
    })
    .sort((a, b) => b.commits - a.commits);

  const unmatchedAuthors = [...unknownKeyToCount.entries()]
    .map(([identifier, commitCount]) => ({ identifier, commits: commitCount }))
    .sort((a, b) => b.commits - a.commits);

  return { members, totalCommits: commits.length, unmatchedAuthors, truncated };
}

/**
 * Agrège la participation GitHub d’un dépôt par membre d’équipe.
 */
export async function computeGithubParticipation({ githubUrl, teamStudents }) {
  const repoInfo = parseGithubRepoForApi(githubUrl);
  if (!repoInfo.ok) {
    throw new Error(repoInfo.message);
  }
  const { owner, repo } = repoInfo;
  const students = Array.isArray(teamStudents) ? teamStudents : [];
  if (students.length === 0) {
    throw new Error("Aucun membre sur l’équipe / affectation.");
  }

  let source = "contributors";
  let truncated = false;
  let members;
  let totalCommits;
  let unmatchedAuthors;

  if (process.env.GITHUB_PARTICIPATION_USE_COMMITS === "1") {
    source = "commits";
    const fetchResult = await fetchAllCommitsForRepo(owner, repo);
    truncated = fetchResult.truncated;
    const built = buildMembersFromCommits(students, fetchResult.commits, truncated);
    members = built.members;
    totalCommits = built.totalCommits;
    unmatchedAuthors = built.unmatchedAuthors;
  } else {
    const contributors = await fetchContributorsForRepo(owner, repo);
    const built = buildMembersFromContributors(students, contributors);
    members = built.members;
    totalCommits = built.totalCommits;
    unmatchedAuthors = built.unmatchedAuthors;
  }

  return {
    owner,
    repo,
    githubUrl,
    totalCommits,
    truncated,
    source,
    tokenConfigured: Boolean(resolveGithubToken()),
    members,
    unmatchedAuthors,
    syncedAt: new Date().toISOString(),
  };
}

/** Dernière soumission GitHub de l’affectation (dépôt d’équipe). */
export async function findGithubUrlForAssignment(assignmentId) {
  const sub = await Submission.findOne({
    assignment: assignmentId,
    kind: "github",
    githubUrl: { $exists: true, $ne: "" },
  })
    .sort({ createdAt: -1 })
    .select("githubUrl")
    .lean();
  return sub?.githubUrl?.trim() || "";
}

export function resolveGithubUrlForSubmission(sub, assignmentGithubUrl = "") {
  if ((sub.kind || "file") === "github" && sub.githubUrl) {
    return String(sub.githubUrl).trim();
  }
  return String(assignmentGithubUrl || "").trim();
}

/**
 * Synchronise et enregistre la participation sur une soumission.
 */
export async function syncGithubParticipationForSubmission(submissionId) {
  const sub = await Submission.findById(submissionId).populate({
    path: "assignment",
    populate: { path: "students", select: "name email githubUsername" },
  });
  if (!sub?.assignment) return null;

  const assignmentGithub = await findGithubUrlForAssignment(sub.assignment._id);
  const githubUrl = resolveGithubUrlForSubmission(sub, assignmentGithub);
  if (!githubUrl) return null;

  const teamStudents = Array.isArray(sub.assignment.students) ? sub.assignment.students : [];
  const data = await computeGithubParticipation({ githubUrl, teamStudents });

  sub.githubParticipation = data;
  sub.githubParticipationSyncedAt = new Date();
  await sub.save();

  return data;
}

/** Met à jour la participation sur toutes les soumissions d’une affectation. */
export async function syncGithubParticipationForAssignment(assignmentId) {
  const subs = await Submission.find({ assignment: assignmentId }).select("_id");
  const results = [];
  for (const s of subs) {
    try {
      const data = await syncGithubParticipationForSubmission(s._id);
      if (data) results.push(String(s._id));
    } catch (e) {
      console.error("syncGithubParticipation", s._id, e.message);
    }
  }
  return results;
}
