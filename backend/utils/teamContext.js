import Student from "../models/Student.js";
import Team from "../models/Team.js";

export async function loadTeamForStudent(studentId) {
  const student = await Student.findById(studentId).select("team").lean();
  if (!student?.team) return null;
  const team = await Team.findById(student.team)
    .populate("students", "name email currentLevel")
    .populate("leader", "name email")
    .lean();
  return team;
}

export function teamMemberIds(team) {
  return (team?.students || []).map((s) => (s._id ? String(s._id) : String(s)));
}
