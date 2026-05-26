/** Barème officiel de notation des projets (total /20). */
export const PROJECT_GRADE_MAX = 20;

export const PROJECT_GRADING_CRITERIA = [
  {
    id: "cahier_charges",
    label: "Respect du cahier des charges",
    description: "Objectifs, livrables et contraintes demandés",
    maxPoints: 6,
  },
  {
    id: "fonctionnalite",
    label: "Fonctionnalités et complétude",
    description: "Application fonctionnelle, cas d’usage couverts",
    maxPoints: 5,
  },
  {
    id: "qualite_code",
    label: "Qualité du code",
    description: "Lisibilité, structure, bonnes pratiques",
    maxPoints: 4,
  },
  {
    id: "docker_tests",
    label: "Docker & tests",
    description: "docker-compose, exécution, tests automatisés",
    maxPoints: 3,
  },
  {
    id: "documentation",
    label: "Documentation",
    description: "README, consignes d’installation, commentaires utiles",
    maxPoints: 2,
  },
];

const CRITERION_BY_ID = new Map(PROJECT_GRADING_CRITERIA.map((c) => [c.id, c]));

export function getProjectGradingRubric() {
  return {
    maxTotal: PROJECT_GRADE_MAX,
    criteria: PROJECT_GRADING_CRITERIA,
  };
}

export function normalizeRubricScoresInput(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const id = String(key || "").trim();
    if (!CRITERION_BY_ID.has(id)) continue;
    const n = Number(value);
    if (!Number.isFinite(n)) continue;
    const max = CRITERION_BY_ID.get(id).maxPoints;
    out[id] = Math.max(0, Math.min(max, Math.round(n * 100) / 100));
  }
  return out;
}

export function computeGradeTotal(rubricScores) {
  const scores = normalizeRubricScoresInput(rubricScores);
  let total = 0;
  for (const c of PROJECT_GRADING_CRITERIA) {
    total += Number(scores[c.id]) || 0;
  }
  return Math.round(total * 100) / 100;
}

export function formatGradeNote(total, comment) {
  const t = Math.round(Number(total) * 100) / 100;
  const base = `${t}/${PROJECT_GRADE_MAX}`;
  const c = String(comment || "").trim();
  return c ? `${base} — ${c.slice(0, 500)}` : base;
}

export function validateRubricScoresForGrade(rubricScores, { requireAll = true } = {}) {
  const scores = normalizeRubricScoresInput(rubricScores);
  const missing = PROJECT_GRADING_CRITERIA.filter((c) => !Number.isFinite(scores[c.id])).map(
    (c) => c.label
  );
  if (requireAll && missing.length > 0) {
    return {
      ok: false,
      message: `Barème incomplet : renseignez ${missing.join(", ")}.`,
      scores,
    };
  }
  const total = computeGradeTotal(scores);
  if (total > PROJECT_GRADE_MAX) {
    return { ok: false, message: `Total invalide (${total} > ${PROJECT_GRADE_MAX}).`, scores };
  }
  return { ok: true, scores, total };
}
