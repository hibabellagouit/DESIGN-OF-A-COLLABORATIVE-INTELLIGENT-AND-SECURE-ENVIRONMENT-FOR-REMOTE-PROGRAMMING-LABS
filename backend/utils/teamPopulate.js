/** Champs peuplés pour les réponses API équipe. */
export const TEAM_STUDENT_SELECT = "name email currentLevel";
export const TEAM_LEADER_SELECT = "name email";

export function populateTeam(query) {
  return query.populate("students", TEAM_STUDENT_SELECT).populate("leader", TEAM_LEADER_SELECT);
}

export function teamLeaderPayload(team) {
  if (!team?.leader) return null;
  const l = team.leader;
  const id = l._id ? String(l._id) : String(l);
  if (!id || id === "undefined") return null;
  return {
    _id: id,
    name: l.name || "",
    email: l.email || "",
  };
}

export function teamSummaryPayload(team) {
  if (!team) return null;
  return {
    _id: team._id,
    name: team.name,
    leader: teamLeaderPayload(team),
  };
}
