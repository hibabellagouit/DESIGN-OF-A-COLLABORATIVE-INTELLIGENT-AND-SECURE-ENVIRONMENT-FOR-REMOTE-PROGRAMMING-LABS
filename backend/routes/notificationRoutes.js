import express from "express";
import { listMine, markRead, markAllRead } from "../controllers/notificationController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/mine", requireAuth, listMine);
router.patch("/:id/read", requireAuth, markRead);
router.post("/read-all", requireAuth, markAllRead);

export default router;
