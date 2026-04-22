import "dotenv/config";
import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import studentRoutes from "./routes/studentRoutes.js";
import teacherRoutes from "./routes/teacherRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import assignmentRoutes from "./routes/assignmentRoutes.js";

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// DB
connectDB();

// routes
app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/assignments", assignmentRoutes);

// 🔥 TOUJOURS EN DERNIER
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});