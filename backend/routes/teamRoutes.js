import express from "express";
import { listTeams, createTeam, deleteTeam } from "../controllers/teamController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, requireRole("teacher"), listTeams);
router.post("/", requireAuth, requireRole("teacher"), createTeam);
router.delete("/:id", requireAuth, requireRole("teacher"), deleteTeam);

export default router;
