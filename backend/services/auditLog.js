import AuditLog from "../models/AuditLog.js";

function clientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.socket?.remoteAddress || "";
}

/**
 * @param {import("express").Request} req
 * @param {{ actorId?: string; actorRole?: string; action: string; targetType?: string; targetId?: string; details?: unknown }} payload
 */
export async function recordAudit(req, payload) {
  try {
    const { actorId = "", actorRole = "system", action, targetType = "", targetId = "", details = null } =
      payload || {};
    await AuditLog.create({
      actorId,
      actorRole,
      action,
      targetType,
      targetId,
      details,
      ip: clientIp(req),
      userAgent: String(req.headers["user-agent"] || "").slice(0, 400),
    });
  } catch (e) {
    console.error("recordAudit", e);
  }
}
