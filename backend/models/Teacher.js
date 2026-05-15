import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    password: String,
    isDisabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Teacher", teacherSchema);