import mongoose from "mongoose";

const projectFileSchema = new mongoose.Schema(
  {
    relativePath: { type: String, default: "" },
    storedName: { type: String, default: "" },
    fileMimeType: { type: String, default: "" },
    fileSize: { type: Number, default: 0 },
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    status: {
      type: String,
      enum: ["en attente", "en cours d'évaluation", "évalué", "submitted", "reviewed"],
      default: "en attente",
    },
    note: { type: String, default: "" },
    /** Notes par critère du barème (id critère → points) */
    rubricScores: { type: mongoose.Schema.Types.Mixed, default: {} },
    /** Total calculé sur /20 */
    gradeTotal: { type: Number, default: null },
    /** Commentaire libre de l’enseignant (hors barème) */
    gradeComment: { type: String, default: "" },

    /** Note préliminaire Ollama (non définitive) */
    aiRubricScores: { type: mongoose.Schema.Types.Mixed, default: {} },
    aiGradeTotal: { type: Number, default: null },
    aiGradeComment: { type: String, default: "" },
    aiGradeSummary: { type: String, default: "" },
    aiEvaluatedAt: { type: Date, default: null },
    aiModel: { type: String, default: "" },
    aiGradeTrace: { type: mongoose.Schema.Types.Mixed, default: null },

    /** "file" = dépôt local ; "github" = lien */
    kind: { type: String, enum: ["file", "github"], default: "file" },
    githubUrl: { type: String, default: "" },

    /** Dossier `uploads/submissions/bundles/<bundleId>/` — soumissions projet multi-fichiers */
    bundleId: { type: String, default: "" },
    projectFiles: { type: [projectFileSchema], default: [] },

    /** Participation équipe (commits GitHub) — synchronisée automatiquement */
    githubParticipation: { type: mongoose.Schema.Types.Mixed, default: null },
    githubParticipationSyncedAt: { type: Date, default: null },

    /** Résultat du test Docker Compose (lancé à la soumission ou manuellement) */
    sandboxResult: { type: mongoose.Schema.Types.Mixed, default: null },
    sandboxRanAt: { type: Date, default: null },
    sandboxOk: { type: Boolean, default: null },
    sandboxLastError: { type: String, default: "" },

    /** Anciennes soumissions : un seul fichier à la racine de `submissions/` */
    fileOriginalName: { type: String, default: "" },
    fileStoredName: { type: String, default: "" },
    fileMimeType: { type: String, default: "" },
    fileSize: { type: Number, default: 0 },
  },
  { timestamps: true }
);

submissionSchema.index({ assignment: 1, student: 1, createdAt: -1 });
submissionSchema.index({ student: 1, createdAt: -1 });
submissionSchema.index({ assignment: 1, createdAt: -1 });
submissionSchema.index({ assignment: 1, kind: 1, createdAt: -1 });

export default mongoose.model("Submission", submissionSchema);
