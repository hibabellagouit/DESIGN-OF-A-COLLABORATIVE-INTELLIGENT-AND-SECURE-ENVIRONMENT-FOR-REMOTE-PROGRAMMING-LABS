import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project"
  },
  students: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student"
    }
  ],
  status: {
    type: String,
    default: "en cours"
  },
  niveau: Number,
  /** Équipe qui a choisi ce projet (choix libre, pas d’affectation par l’enseignant) */
  team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
  /** Copie du nom d’équipe pour l’affichage */
  groupName: { type: String, default: "" },
  /** Note d’équipe /20 (50 % — saisie enseignant) */
  teamRubricScores: { type: mongoose.Schema.Types.Mixed, default: {} },
  teamGradeTotal: { type: Number, default: null },
  teamGradeComment: { type: String, default: "" },
  teamGradedAt: { type: Date, default: null },
  /** Participation GitHub agrégée (commits) */
  githubParticipation: { type: mongoose.Schema.Types.Mixed, default: null },
  githubParticipationSyncedAt: { type: Date, default: null },
  /** Moitié « commits » par membre (50 %, calcul auto) */
  memberCommitScores: { type: mongoose.Schema.Types.Mixed, default: {} },
  /** Note finale /20 par membre (équipe + commits) */
  memberFinalGrades: { type: mongoose.Schema.Types.Mixed, default: {} },
});

assignmentSchema.index({ students: 1 });
assignmentSchema.index({ project: 1, status: 1 });
assignmentSchema.index({ team: 1 });
assignmentSchema.index({ status: 1, niveau: 1 });

export default mongoose.model("Assignment", assignmentSchema);