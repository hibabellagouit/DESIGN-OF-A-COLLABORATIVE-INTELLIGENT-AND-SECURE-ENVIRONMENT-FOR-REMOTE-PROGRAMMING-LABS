import { API_BASE } from "../apiBase";
import { authHeaders } from "../authStorage";

/**
 * Attend la fin d’un job (sandbox ou Ollama).
 * @param {string} jobId
 * @param {{ intervalMs?: number, maxAttempts?: number }} opts
 */
export async function pollJobUntilDone(jobId, opts = {}) {
  const intervalMs = opts.intervalMs ?? 2000;
  const maxAttempts = opts.maxAttempts ?? 120;

  for (let i = 0; i < maxAttempts; i += 1) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const res = await fetch(`${API_BASE}/api/jobs/${jobId}`, { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || `Erreur ${res.status}`);
    }
    if (data.status === "done") return data;
    if (data.status === "failed") {
      throw new Error(data.error || "Tâche en échec");
    }
  }
  throw new Error("Délai dépassé — la tâche continue peut-être en arrière-plan.");
}
