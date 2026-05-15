import express from "express";
import mongoose from "mongoose";
import SecurityPolicy from "../models/SecurityPolicy.js";

const router = express.Router();

/** Réglages publics (sans authentification) pour l’UI de connexion. */
router.get("/settings", async (_req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.json({ allowStudentSelfRegistration: true });
  }
  try {
    const doc = await SecurityPolicy.findOne({ key: "default" }).lean();
    res.json({
      allowStudentSelfRegistration: doc?.allowStudentSelfRegistration !== false,
    });
  } catch {
    res.json({ allowStudentSelfRegistration: true });
  }
});

export default router;
