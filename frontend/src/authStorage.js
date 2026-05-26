export function readUser() {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Rôle encodé dans le JWT (indépendant du champ role en localStorage). */
export function readTokenRole() {
  const token = readToken();
  if (!token) return "";
  try {
    const part = token.split(".")[1];
    if (!part) return "";
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.role === "string" ? json.role : "";
  } catch {
    return "";
  }
}

export function readToken() {
  return readUser()?.token || "";
}

export function authHeaders(extra = {}) {
  const token = readToken();
  const base = { ...extra };
  if (token) base.Authorization = `Bearer ${token}`;
  return base;
}

/** Message d’erreur API lisible (évite d’afficher « Forbidden » seul). */
export function apiErrorMessage(data, res, fallback = "Erreur") {
  const msg = data?.message || data?.error;
  if (msg && msg !== "Forbidden") return msg;
  if (res?.status === 401) return "Session expirée — reconnectez-vous.";
  if (res?.status === 403) {
    return "Accès refusé — vérifiez que vous êtes connecté avec le bon profil (enseignant / étudiant).";
  }
  return fallback;
}

