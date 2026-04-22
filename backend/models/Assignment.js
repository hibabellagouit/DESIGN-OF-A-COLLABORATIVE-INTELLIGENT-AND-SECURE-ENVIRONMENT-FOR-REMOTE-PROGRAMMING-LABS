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
  niveau: Number
});

export default mongoose.model("Assignment", assignmentSchema);