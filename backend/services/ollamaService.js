const DEFAULT_BASE = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.2";
const DEFAULT_TIMEOUT_MS = 120_000;

function ollamaConfig() {
  return {
    baseUrl: String(process.env.OLLAMA_BASE_URL || DEFAULT_BASE).replace(/\/$/, ""),
    model: String(process.env.OLLAMA_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
    timeoutMs: Math.max(10_000, Number(process.env.OLLAMA_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS),
  };
}

export function getOllamaConfig() {
  return ollamaConfig();
}

export async function checkOllamaAvailable() {
  const { baseUrl, timeoutMs } = ollamaConfig();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.min(timeoutMs, 5000));
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: ctrl.signal });
    if (!res.ok) {
      return { ok: false, message: `Ollama injoignable (${res.status})` };
    }
    const data = await res.json().catch(() => ({}));
    const models = Array.isArray(data.models) ? data.models.map((m) => m.name || m.model) : [];
    return { ok: true, baseUrl, models };
  } catch (e) {
    const msg =
      e.name === "AbortError"
        ? "Délai dépassé en contactant Ollama"
        : e.message || "Ollama injoignable";
    return { ok: false, message: msg };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Appel chat Ollama avec réponse JSON attendue (format: json).
 */
export async function ollamaChatJson({ system, user }) {
  const { baseUrl, model, timeoutMs } = ollamaConfig();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = data.error || data.message || `Ollama HTTP ${res.status}`;
      throw new Error(String(err));
    }
    const content = data.message?.content ?? data.response ?? "";
    return { content: String(content), model };
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error(`Ollama : délai dépassé (${Math.round(timeoutMs / 1000)}s)`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
