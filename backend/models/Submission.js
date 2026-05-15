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

    /** "file" = dépôt local ; "github" = lien */
    kind: { type: String, enum: ["file", "github"], default: "file" },
    githubUrl: { type: String, default: "" },

    /** Dossier `uploads/submissions/bundles/<bundleId>/` — soumissions projet multi-fichiers */
    bundleId: { type: String, default: "" },
    projectFiles: { type: [projectFileSchema], default: [] },

    /** Anciennes soumissions : un seul fichier à la racine de `submissions/` */
    fileOriginalName: { type: String, default: "" },
    fileStoredName: { type: String, default: "" },
    fileMimeType: { type: String, default: "" },
    fileSize: { type: Number, default: 0 },
  },
  { timestamps: true }
);

submissionSchema.index({ assignment: 1, student: 1, createdAt: -1 });

export default mongoose.model("Submission", submissionSchema);
