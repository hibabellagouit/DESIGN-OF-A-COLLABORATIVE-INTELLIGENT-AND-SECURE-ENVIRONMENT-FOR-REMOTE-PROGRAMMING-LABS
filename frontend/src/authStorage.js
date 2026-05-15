export function readUser() {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
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

