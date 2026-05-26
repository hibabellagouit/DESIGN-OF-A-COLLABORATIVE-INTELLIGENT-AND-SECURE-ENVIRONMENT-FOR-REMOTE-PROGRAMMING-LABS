import jwt from "jsonwebtoken";

function readBearerToken(req) {
  const raw = req.headers.authorization || req.headers.Authorization || "";
  if (typeof raw !== "string") return "";
  const [scheme, token] = raw.split(" ");
  if ((scheme || "").toLowerCase() !== "bearer") return "";
  return token || "";
}

export function requireAuth(req, res, next) {
  try {
    const token = readBearerToken(req) || (req.query?.token ? String(req.query.token) : "");
    if (!token) {
      return res.status(401).json({ message: "Missing token" });
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: "Server misconfigured (JWT_SECRET)" });
    }
    const payload = jwt.verify(token, secret);
    if (!payload?.role) {
      return res.status(401).json({
        message: "Session obsolète (jeton sans rôle). Déconnectez-vous et reconnectez-vous.",
      });
    }
    req.user = payload; // { id, role }
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) {
      return res.status(401).json({
        message: "Session invalide. Déconnectez-vous et reconnectez-vous.",
      });
    }
    if (roles.length > 0 && !roles.includes(role)) {
      const expected = roles.join(" ou ");
      return res.status(403).json({
        message: `Accès refusé : votre compte est « ${role} », cette action requiert « ${expected} ».`,
      });
    }
    next();
  };
}

/**
 * Pour PATCH /api/students/:id/github : enseignant (tout id) ou étudiant uniquement
 * « me » ou son propre _id Mongo (pas les autres comptes).
 */
export function requireTeacherOrStudentSelfGithubParam(req, res, next) {
  const role = req.user?.role;
  const paramId = req.params?.id;
  if (role === "teacher") return next();
  if (role !== "student") {
    return res.status(403).json({
      message:
        "Accès refusé : seuls l’enseignant ou l’étudiant concerné peuvent modifier cet identifiant GitHub.",
    });
  }
  const self = String(req.user?.id || "");
  if (paramId === "me" || String(paramId) === self) {
    return next();
  }
  return res.status(403).json({
    message: "Accès refusé : vous ne pouvez modifier que votre propre identifiant GitHub.",
  });
}
