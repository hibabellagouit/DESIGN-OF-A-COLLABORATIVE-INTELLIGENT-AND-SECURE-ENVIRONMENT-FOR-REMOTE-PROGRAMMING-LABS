import mongoose from "mongoose";

/**
 * referenceKind + referenceValidation (proposition métier) :
 * - repo       : URL dépôt squelette / template (GitLab, GitHub…)
 * - stack      : contraintes techniques (ex. "Node 20 + Express + Jest")
 * - sandbox    : lien ou identifiant vers l’environnement TP / compilateur (phase ultérieure)
 * - tests      : référence jeux de tests / barème auto (fichiers, commande npm test…)
 * - autre      : texte libre (consignes, lien moodle, etc.)
 */
const projectSchema = new mongoose.Schema({
  title: String,
  description: String,
  niveau: Number,
  maxStudents: Number,
  /** Résumé court affiché dans les listes (complément au fichier joint) */
  cahierDeCharge: String,
  referenceKind: {
    type: String,
    enum: ["repo", "stack", "sandbox", "tests", "autre"],
    default: "autre",
  },
  referenceValidation: String,
  cahierFileOriginalName: String,
  cahierFileStoredName: String,
  cahierFileMimeType: String,
});

export default mongoose.model("Project", projectSchema);
