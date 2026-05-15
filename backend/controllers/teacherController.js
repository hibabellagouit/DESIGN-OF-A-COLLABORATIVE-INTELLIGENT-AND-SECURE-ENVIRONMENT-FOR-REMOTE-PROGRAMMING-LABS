import Teacher from "../models/Teacher.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { recordAudit } from "../services/auditLog.js";

function signToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing");
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

// REGISTER
export const registerTeacher = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const existing = await Teacher.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email already used" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const teacher = new Teacher({ name, email, password: hashed });

    await teacher.save();

    const token = signToken({ id: teacher._id.toString(), role: "teacher" });
    await recordAudit(req, {
      actorId: teacher._id.toString(),
      actorRole: "teacher",
      action: "teacher_self_registered",
      targetType: "teacher",
      targetId: teacher._id.toString(),
      details: { email: teacher.email },
    });
    res.status(201).json({
      message: "Teacher created",
      token,
      teacher: { _id: teacher._id, name: teacher.name, email: teacher.email },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// LOGIN
export const loginTeacher = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const teacher = await Teacher.findOne({ email });

    if (!teacher) {
      await recordAudit(req, {
        actorRole: "unknown",
        action: "teacher_login_failed",
        details: { email },
      });
      return res.status(404).json({ message: "Teacher not found" });
    }

    if (teacher.isDisabled) {
      await recordAudit(req, {
        actorId: teacher._id.toString(),
        actorRole: "teacher",
        action: "teacher_login_blocked",
        targetType: "teacher",
        targetId: teacher._id.toString(),
      });
      return res.status(403).json({ message: "Compte enseignant désactivé" });
    }

    let ok = false;
    const stored = teacher.password || "";
    // Backward compatibility: old accounts had plain text passwords
    if (stored && stored.startsWith("$2")) {
      ok = await bcrypt.compare(password || "", stored);
    } else {
      ok = (password || "") === stored;
      if (ok) {
        teacher.password = await bcrypt.hash(password, 10);
        await teacher.save();
      }
    }
    if (!ok) {
      await recordAudit(req, {
        actorRole: "unknown",
        action: "teacher_login_failed",
        details: { email: teacher.email },
      });
      return res.status(401).json({ message: "Wrong password" });
    }

    const token = signToken({ id: teacher._id.toString(), role: "teacher" });
    await recordAudit(req, {
      actorId: teacher._id.toString(),
      actorRole: "teacher",
      action: "teacher_login_success",
      targetType: "teacher",
      targetId: teacher._id.toString(),
    });
    res.json({
      message: "Login successful",
      token,
      teacher: { _id: teacher._id, name: teacher.name, email: teacher.email },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};