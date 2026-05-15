import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    isDisabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Admin", adminSchema);
