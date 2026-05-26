import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    /** Login GitHub (sans @) — pour rattacher les commits si l’e-mail git ≠ e-mail scolaire */
    githubUsername: { type: String, default: "", trim: true, maxlength: 39 },
    password: String,
    currentLevel: Number,
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    isDisabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

studentSchema.index({ email: 1 }, { unique: true, sparse: true });
studentSchema.index({ team: 1 });

export default mongoose.model("Student", studentSchema);