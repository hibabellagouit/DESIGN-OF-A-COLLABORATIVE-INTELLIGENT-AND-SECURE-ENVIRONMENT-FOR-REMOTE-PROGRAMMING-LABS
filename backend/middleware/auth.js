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
    req.user = payload; // { id, role }
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || (roles.length > 0 && !roles.includes(role))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}
