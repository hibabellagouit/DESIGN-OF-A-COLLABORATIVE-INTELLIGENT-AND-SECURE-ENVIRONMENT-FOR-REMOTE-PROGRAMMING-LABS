import express from "express";
import cors from "cors";
import studentRoutes from "./routes/studentRoutes.js";
import teacherRoutes from "./routes/teacherRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import assignmentRoutes from "./routes/assignmentRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import submissionRoutes from "./routes/submissionRoutes.js";
import sandboxRoutes from "./routes/sandboxRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import { getHealth } from "./controllers/healthController.js";

/**
 * Application Express (sans écoute ni connexion Mongo).
 * Utilisée par server.js et par les tests d’intégration.
 */
export default function buildApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", getHealth);

  app.use("/api/public", publicRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/students", studentRoutes);
  app.use("/api/teachers", teacherRoutes);
  app.use("/api/projects", projectRoutes);
  app.use("/api/assignments", assignmentRoutes);
  app.use("/api/teams", teamRoutes);
  app.use("/api/submissions", submissionRoutes);
  app.use("/api/sandbox", sandboxRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/jobs", jobRoutes);

  return app;
}
