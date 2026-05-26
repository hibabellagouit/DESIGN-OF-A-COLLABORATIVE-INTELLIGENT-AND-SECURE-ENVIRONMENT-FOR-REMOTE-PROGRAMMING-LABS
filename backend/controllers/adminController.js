import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import SecurityPolicy from "../models/SecurityPolicy.js";
import AuditLog from "../models/AuditLog.js";
import { recordAudit } from "../services/auditLog.js";

function signToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET missing");
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

async function getOrCreatePolicy() {
  let p = await SecurityPolicy.findOne({ key: "default" });
  if (!p) p = await SecurityPolicy.create({ key: "default" });
  return p;
}

export const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Champs manquants" });
    }
    const admin = await Admin.findOne({ email: String(email).toLowerCase().trim() });
    if (!admin) {
      await recordAudit(req, {
        actorRole: "unknown",
        action: "admin_login_failed",
        details: { email: String(email).toLowerCase().trim() },
      });
      return res.status(404).json({ message: "Administrateur introuvable" });
    }
    if (admin.isDisabled) {
      await recordAudit(req, {
        actorId: admin._id.toString(),
        actorRole: "admin",
        action: "admin_login_blocked",
        targetType: "admin",
        targetId: admin._id.toString(),
      });
      return res.status(403).json({ message: "Compte administrateur désactivé" });
    }
    let ok = false;
    const stored = admin.password || "";
    if (stored && stored.startsWith("$2")) {
      ok = await bcrypt.compare(password || "", stored);
    } else {
      ok = (password || "") === stored;
      if (ok) {
        admin.password = await bcrypt.hash(password, 10);
        await admin.save();
      }
    }
    if (!ok) {
      await recordAudit(req, {
        actorRole: "unknown",
        action: "admin_login_failed",
        details: { email: admin.email },
      });
      return res.status(401).json({ message: "Mot de passe incorrect" });
    }
    const token = signToken({ id: admin._id.toString(), role: "admin" });
    await recordAudit(req, {
      actorId: admin._id.toString(),
      actorRole: "admin",
      action: "admin_login_success",
      targetType: "admin",
      targetId: admin._id.toString(),
    });
    res.json({
      message: "Connexion réussie",
      token,
      admin: { _id: admin._id, name: admin.name, email: admin.email },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/** Création du tout premier admin (aucun en base) avec une clé serveur. */
export const firstSetupAdmin = async (req, res) => {
  try {
    const count = await Admin.countDocuments();
    if (count > 0) {
      return res.status(403).json({ message: "Un administrateur existe déjà." });
    }
    const setupKey = process.env.ADMIN_FIRST_SETUP_KEY;
    if (!setupKey) {
      return res.status(503).json({
        message:
          "Première configuration désactivée (définissez ADMIN_FIRST_SETUP_KEY ou SEED_ADMIN_* sur le serveur).",
      });
    }
    const { setupKey: bodyKey, name, email, password } = req.body || {};
    if (bodyKey !== setupKey) {
      return res.status(403).json({ message: "Clé de première configuration invalide." });
    }
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Nom, e-mail et mot de passe requis." });
    }
    const em = String(email).toLowerCase().trim();
    const hashed = await bcrypt.hash(password, 10);
    const admin = await Admin.create({ name: String(name).trim(), email: em, password: hashed });
    await recordAudit(req, {
      actorId: admin._id.toString(),
      actorRole: "admin",
      action: "admin_first_setup",
      targetType: "admin",
      targetId: admin._id.toString(),
      details: { email: em },
    });
    res.status(201).json({
      message: "Administrateur initial créé. Vous pouvez vous connecter.",
      admin: { _id: admin._id, name: admin.name, email: admin.email },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Cet e-mail est déjà utilisé." });
    }
    res.status(500).json({ error: error.message });
  }
};

export const listUsers = async (req, res) => {
  try {
    const [teachers, students, admins] = await Promise.all([
      Teacher.find().select("-password").sort({ email: 1 }).lean(),
      Student.find().select("-password").sort({ email: 1 }).lean(),
      Admin.find().select("-password").sort({ email: 1 }).lean(),
    ]);
    const users = [
      ...admins.map((a) => ({
        id: String(a._id),
        role: "admin",
        name: a.name,
        email: a.email,
        isDisabled: !!a.isDisabled,
        createdAt: a.createdAt,
      })),
      ...teachers.map((t) => ({
        id: String(t._id),
        role: "teacher",
        name: t.name,
        email: t.email,
        isDisabled: !!t.isDisabled,
        createdAt: t.createdAt,
      })),
      ...students.map((s) => ({
        id: String(s._id),
        role: "student",
        name: s.name,
        email: s.email,
        isDisabled: !!s.isDisabled,
        currentLevel: s.currentLevel,
        createdAt: s.createdAt,
      })),
    ];
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const patchUserDisabled = async (req, res) => {
  try {
    const { role, id } = req.params;
    const { isDisabled } = req.body || {};
    if (typeof isDisabled !== "boolean") {
      return res.status(400).json({ message: "isDisabled (booléen) requis" });
    }
    const adminId = req.user?.id;
    if (role === "admin" && id === adminId && isDisabled === true) {
      return res.status(400).json({ message: "Vous ne pouvez pas désactiver votre propre compte." });
    }
    let updated = null;
    if (role === "teacher") {
      updated = await Teacher.findByIdAndUpdate(id, { isDisabled }, { new: true }).select("-password");
    } else if (role === "student") {
      updated = await Student.findByIdAndUpdate(id, { isDisabled }, { new: true }).select("-password");
    } else if (role === "admin") {
      updated = await Admin.findByIdAndUpdate(id, { isDisabled }, { new: true }).select("-password");
    } else {
      return res.status(400).json({ message: "Rôle inconnu" });
    }
    if (!updated) return res.status(404).json({ message: "Utilisateur introuvable" });
    await recordAudit(req, {
      actorId: adminId,
      actorRole: "admin",
      action: "user_disabled_toggled",
      targetType: role,
      targetId: String(id),
      details: { isDisabled, email: updated.email },
    });
    res.json({
      message: "Mis à jour",
      user: {
        id: String(updated._id),
        role,
        name: updated.name,
        email: updated.email,
        isDisabled: !!updated.isDisabled,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getSecurityPolicy = async (_req, res) => {
  try {
    const p = await getOrCreatePolicy();
    res.json({
      allowStudentSelfRegistration: p.allowStudentSelfRegistration !== false,
      auditLogRetentionDays: Number(p.auditLogRetentionDays) || 365,
      minPasswordLength: Math.max(6, Math.min(128, Number(p.minPasswordLength) || 6)),
      updatedAt: p.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateSecurityPolicy = async (req, res) => {
  try {
    const adminId = req.user?.id;
    const { allowStudentSelfRegistration, auditLogRetentionDays, minPasswordLength } = req.body || {};
    const p = await getOrCreatePolicy();
    if (typeof allowStudentSelfRegistration === "boolean") {
      p.allowStudentSelfRegistration = allowStudentSelfRegistration;
    }
    if (auditLogRetentionDays != null) {
      const n = Number(auditLogRetentionDays);
      if (Number.isFinite(n) && n >= 30 && n <= 3650) p.auditLogRetentionDays = n;
    }
    if (minPasswordLength != null) {
      const n = Number(minPasswordLength);
      if (Number.isFinite(n) && n >= 6 && n <= 128) p.minPasswordLength = n;
    }
    p.updatedBy = adminId;
    await p.save();
    await recordAudit(req, {
      actorId: adminId,
      actorRole: "admin",
      action: "security_policy_updated",
      targetType: "SecurityPolicy",
      targetId: String(p._id),
      details: {
        allowStudentSelfRegistration: p.allowStudentSelfRegistration,
        auditLogRetentionDays: p.auditLogRetentionDays,
        minPasswordLength: p.minPasswordLength,
      },
    });
    res.json({
      allowStudentSelfRegistration: p.allowStudentSelfRegistration !== false,
      auditLogRetentionDays: p.auditLogRetentionDays,
      minPasswordLength: p.minPasswordLength,
      updatedAt: p.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const listAuditLogs = async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
    const skip = Math.max(0, parseInt(String(req.query.skip || "0"), 10) || 0);
    const [items, total] = await Promise.all([
      AuditLog.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(),
    ]);
    res.json({
      items: items.map((x) => ({
        id: String(x._id),
        createdAt: x.createdAt,
        actorId: x.actorId,
        actorRole: x.actorRole,
        action: x.action,
        targetType: x.targetType,
        targetId: x.targetId,
        details: x.details,
        ip: x.ip,
        userAgent: x.userAgent,
      })),
      total,
      limit,
      skip,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createTeacher = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Nom, e-mail et mot de passe requis." });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: "Mot de passe trop court (min. 6 caractères)." });
    }
    const em = String(email).toLowerCase().trim();
    const existing = await Teacher.findOne({ email: em });
    if (existing) {
      return res.status(409).json({ message: "Cet e-mail est déjà utilisé." });
    }
    const hashed = await bcrypt.hash(password, 10);
    const teacher = await Teacher.create({
      name: String(name).trim(),
      email: em,
      password: hashed,
    });
    await recordAudit(req, {
      actorId: req.user?.id,
      actorRole: "admin",
      action: "teacher_created",
      targetType: "teacher",
      targetId: teacher._id.toString(),
      details: { email: em },
    });
    res.status(201).json({
      message: "Enseignant créé",
      teacher: { _id: teacher._id, name: teacher.name, email: teacher.email },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Cet e-mail est déjà utilisé." });
    }
    console.error("createTeacher", error);
    res.status(500).json({
      message: error.message || "Impossible de créer l’enseignant.",
      error: error.message,
    });
  }
};

export const createAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Nom, e-mail et mot de passe requis." });
    }
    const em = String(email).toLowerCase().trim();
    const hashed = await bcrypt.hash(password, 10);
    const admin = await Admin.create({ name: String(name).trim(), email: em, password: hashed });
    await recordAudit(req, {
      actorId: req.user?.id,
      actorRole: "admin",
      action: "admin_created",
      targetType: "admin",
      targetId: admin._id.toString(),
      details: { email: em },
    });
    res.status(201).json({
      message: "Administrateur créé",
      admin: { _id: admin._id, name: admin.name, email: admin.email },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Cet e-mail est déjà utilisé." });
    }
    res.status(500).json({ error: error.message });
  }
};
