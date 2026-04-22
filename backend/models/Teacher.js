import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String
});

export default mongoose.model("Teacher", teacherSchema);