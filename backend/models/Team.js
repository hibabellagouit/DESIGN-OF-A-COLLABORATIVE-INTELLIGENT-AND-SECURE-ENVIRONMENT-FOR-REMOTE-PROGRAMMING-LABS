import mongoose from "mongoose";

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
    /** Responsable de l’équipe (doit être membre de students). */
    leader: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
  },
  { timestamps: true }
);

export default mongoose.model("Team", teamSchema);
