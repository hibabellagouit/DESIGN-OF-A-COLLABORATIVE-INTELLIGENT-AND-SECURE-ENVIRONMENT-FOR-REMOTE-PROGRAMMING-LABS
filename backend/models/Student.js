import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  currentLevel: Number
});

export default mongoose.model("Student", studentSchema);