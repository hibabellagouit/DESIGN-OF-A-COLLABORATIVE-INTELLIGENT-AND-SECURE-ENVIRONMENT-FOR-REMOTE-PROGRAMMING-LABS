import Admin from "../models/Admin.js";
import bcrypt from "bcryptjs";

/**
 * Crée un admin au démarrage si SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD sont définis
 * et qu’aucun compte avec cet e-mail n’existe.
 */
export async function ensureSeedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim()?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) return;
  const exists = await Admin.findOne({ email });
  if (exists) return;
  const hashed = await bcrypt.hash(password, 10);
  const name = process.env.SEED_ADMIN_NAME?.trim() || "Administrateur";
  await Admin.create({ name, email, password: hashed });
  console.log(`[seed] Compte administrateur créé pour ${email}`);
}
