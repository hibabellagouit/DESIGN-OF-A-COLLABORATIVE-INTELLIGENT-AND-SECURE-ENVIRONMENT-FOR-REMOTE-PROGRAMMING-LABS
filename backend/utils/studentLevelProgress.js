import Assignment from "../models/Assignment.js";

const MAX_LEVEL = 5;

/**
 * Niveau max. de projet sélectionnable : 1 + dernier palier d’une chaîne de validations
 * consécutives 1, 2, 3… (sans trou).
 * Ex. validé 1 seulement → 2 ; validé 1 et 2 → 3 ; rien validé → 1.
 */
export async function computeAllowedSelectLevel(studentId) {
  const sid = studentId?.toString?.() ?? studentId;
  const rows = await Assignment.find({ students: sid, status: "validé" }).select("niveau").lean();
  const set = new Set(rows.map((r) => Number(r.niveau) || 1));
  let k = 0;
  for (let m = 1; m <= MAX_LEVEL; m++) {
    if (set.has(m)) k = m;
    else break;
  }
  return Math.min(MAX_LEVEL, k + 1);
}

/** L’étudiant a une affectation validée à ce niveau. */
export async function hasValidatedLevel(studentId, niveau) {
  const n = Number(niveau) || 1;
  const sid = studentId?.toString?.() ?? studentId;
  const found = await Assignment.findOne({
    students: sid,
    status: "validé",
    niveau: n,
  }).select("_id");
  return Boolean(found);
}

/**
 * Tous les niveaux 1 … (niveauCible - 1) doivent être validés avant de valider / choisir niveauCible.
 */
export async function hasCompletedPriorLevels(studentId, niveauCible) {
  const target = Number(niveauCible) || 1;
  if (target <= 1) return true;
  for (let m = 1; m < target; m++) {
    if (!(await hasValidatedLevel(studentId, m))) return false;
  }
  return true;
}

/** Message d’erreur si les prérequis ne sont pas remplis. */
export async function assertPriorLevelsValidated(studentIds, niveauCible) {
  const target = Number(niveauCible) || 1;
  if (target <= 1) return null;

  for (const sid of studentIds) {
    for (let m = 1; m < target; m++) {
      if (!(await hasValidatedLevel(sid, m))) {
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
