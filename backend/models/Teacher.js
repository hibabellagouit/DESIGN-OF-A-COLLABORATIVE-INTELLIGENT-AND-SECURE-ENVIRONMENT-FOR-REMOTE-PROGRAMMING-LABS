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

teacherSchema.index({ email: 1 }, { unique: true, sparse: true });

export default mongoose.model("Teacher", teacherSchema);