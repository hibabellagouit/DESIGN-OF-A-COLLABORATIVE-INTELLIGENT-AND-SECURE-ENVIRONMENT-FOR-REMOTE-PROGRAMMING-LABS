import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    password: String,
    currentLevel: Number,
    isDisabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Student", studentSchema);