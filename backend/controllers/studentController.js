import Student from "../models/Student.js";
import SecurityPolicy from "../models/SecurityPolicy.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { recordAudit } from "../services/auditLog.js";

function signToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing");
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export const listStudents = async (req, res) => {
  try {
    const students = await Student.find().select("-password");
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const registerStudent = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    let policy = await SecurityPolicy.findOne({ key: "default" });
    if (!policy) policy = await SecurityPolicy.create({ key: "default" });
    if (policy.allowStudentSelfRegistration === false) {
      await recordAudit(req, {
        actorRole: "unknown",
        action: "student_register_denied_by_policy",
        details: { email: String(email).toLowerCase().trim() },
      });
      return res.status(403).json({
        message: "L’inscription libre des étudiants est désactivée par l’administrateur.",
      });
    }

    const existing = await Student.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email already used" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const student = new Student({
      name,
      email,
      password: hashed,
      currentLevel: 1
    });

    await student.save();

    const token = signToken({ id: student._id.toString(), role: "student" });
    await recordAudit(req, {
      actorId: student._id.toString(),
      actorRole: "student",
      action: "student_self_registered",
      targetType: "student",
      targetId: student._id.toString(),
      details: { email: student.email },
    });
    res.status(201).json({
      message: "Student created",
      token,
      student: {
        _id: student._id,
        name: student.name,
        email: student.email,
        currentLevel: student.currentLevel,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
export const loginStudent = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const student = await Student.findOne({ email });

    if (!student) {
      await recordAudit(req, {
        actorRole: "unknown",
        action: "student_login_failed",
        details: { email },
      });
      return res.status(404).json({ message: "Student not found" });
    }

    if (student.isDisabled) {
      await recordAudit(req, {
        actorId: student._id.toString(),
        actorRole: "student",
        action: "student_login_blocked",
        targetType: "student",
        targetId: student._id.toString(),
      });
      return res.status(403).json({ message: "Compte étudiant désactivé" });
    }

    let ok = false;
    const stored = student.password || "";
    // Backward compatibility: old accounts had plain text passwords
    if (stored && stored.startsWith("$2")) {
      ok = await bcrypt.compare(password || "", stored);
    } else {
      ok = (password || "") === stored;
      if (ok) {
        student.password = await bcrypt.hash(password, 10);
        await student.save();
      }
    }
    if (!ok) {
      await recordAudit(req, {
        actorRole: "unknown",
        action: "student_login_failed",
        details: { email: student.email },
      });
      return res.status(401).json({ message: "Wrong password" });
    }

    const token = signToken({ id: student._id.toString(), role: "student" });
    await recordAudit(req, {
      actorId: student._id.toString(),
      actorRole: "student",
      action: "student_login_success",
      targetType: "student",
      targetId: student._id.toString(),
    });
    res.json({
      message: "Login successful",
      token,
      student: {
        _id: student._id,
        name: student.name,
        email: student.email,
        currentLevel: student.currentLevel,
      },
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};