import mongoose from "mongoose";

/** Document unique : politiques globales de la plateforme. */
const securityPolicySchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    allowStudentSelfRegistration: { type: Boolean, default: true },
    /** Rétention indicative des entrées d’audit (jours) — nettoyage manuel ou futur job. */
    auditLogRetentionDays: { type: Number, default: 365, min: 30, max: 3650 },
    /** Politique affichée : mot de passe min. (appliquée côté UI / extension future). */
    minPasswordLength: { type: Number, default: 6, min: 6, max: 128 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("SecurityPolicy", securityPolicySchema);
