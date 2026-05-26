import Assignment from "../models/Assignment.js";

const MAX_LEVEL = 5;

/** Map studentId → Set of validated niveaux (one query). */
export async function loadValidatedLevelsByStudent(studentIds) {
  const ids = [...new Set((studentIds || []).map((id) => String(id)))].filter(Boolean);
  const map = new Map();
  for (const id of ids) map.set(id, new Set());

  if (!ids.length) return map;

  const rows = await Assignment.find({
    students: { $in: ids },
    status: "validé",
  })
    .select("students niveau")
    .lean();

  for (const row of rows) {
    const n = Number(row.niveau) || 1;
    for (const sid of row.students || []) {
      const key = String(sid);
      if (map.has(key)) map.get(key).add(n);
    }
  }
  return map;
}

function allowedLevelFromSet(validatedSet) {
  let k = 0;
  for (let m = 1; m <= MAX_LEVEL; m++) {
    if (validatedSet.has(m)) k = m;
    else break;
  }
  return Math.min(MAX_LEVEL, k + 1);
}

/**
 * Niveau max. de projet sélectionnable : 1 + dernier palier d’une chaîne de validations
 * consécutives 1, 2, 3… (sans trou).
 */
export async function computeAllowedSelectLevel(studentId) {
  const map = await loadValidatedLevelsByStudent([studentId]);
  const set = map.get(String(studentId)) || new Set();
  return allowedLevelFromSet(set);
}

/** L’étudiant a une affectation validée à ce niveau. */
export async function hasValidatedLevel(studentId, niveau) {
  const map = await loadValidatedLevelsByStudent([studentId]);
  return (map.get(String(studentId)) || new Set()).has(Number(niveau) || 1);
}

export async function hasCompletedPriorLevels(studentId, niveauCible) {
  const target = Number(niveauCible) || 1;
  if (target <= 1) return true;
  const map = await loadValidatedLevelsByStudent([studentId]);
  const set = map.get(String(studentId)) || new Set();
  for (let m = 1; m < target; m++) {
    if (!set.has(m)) return false;
  }
  return true;
}

/** Message d’erreur si les prérequis ne sont pas remplis. */
export async function assertPriorLevelsValidated(studentIds, niveauCible) {
  const target = Number(niveauCible) || 1;
  if (target <= 1) return null;

  const map = await loadValidatedLevelsByStudent(studentIds);
  for (const sid of studentIds) {
    const set = map.get(String(sid)) || new Set();
    for (let m = 1; m < target; m++) {
      if (!set.has(m)) {
        return `Impossible au niveau ${target} : le niveau ${m} doit d’abord être validé pour chaque étudiant (progression 1 → 2 → …).`;
      }
    }
  }
  return null;
}

export async function assertCanSelectProjectLevel(studentId, projectLevel) {
  const allowed = await computeAllowedSelectLevel(studentId);
  const level = Number(projectLevel) || 1;
  if (level > allowed) {
    return {
      ok: false,
      message:
        level === 1
          ? "Niveau verrouillé."
          : `Niveau ${level} verrouillé : validez d’abord le niveau ${allowed} (chaîne 1, 2, 3…).`,
      allowed,
    };
  }
  return { ok: true, allowed };
}
