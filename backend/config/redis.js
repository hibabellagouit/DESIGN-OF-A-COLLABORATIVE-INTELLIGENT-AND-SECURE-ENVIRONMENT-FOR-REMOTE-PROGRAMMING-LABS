/** Options de connexion Redis (BullMQ / ioredis). */
export function getRedisConnection() {
  const url = String(process.env.REDIS_URL || "").trim();
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "127.0.0.1",
      port: Number(parsed.port) || 6379,
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      maxRetriesPerRequest: null,
      connectTimeout: 5000,
    };
  } catch {
    return {
      host: "127.0.0.1",
      port: 6379,
      maxRetriesPerRequest: null,
      connectTimeout: 5000,
    };
  }
}

export function isRedisConfigured() {
  return Boolean(String(process.env.REDIS_URL || "").trim());
}

/** @type {"redis" | "memory" | null} */
let resolvedBackend = null;

/** Ping Redis une fois au démarrage (évite BullMQ bloqué si Redis est arrêté). */
export async function pingRedis() {
  if (!isRedisConfigured()) {
    return { ok: false, message: "REDIS_URL non défini" };
  }
  try {
    const { default: Redis } = await import("ioredis");
    const client = new Redis({
      ...getRedisConnection(),
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      lazyConnect: true,
    });
    await client.connect();
    const pong = await client.ping();
    await client.quit();
    return { ok: pong === "PONG", message: pong === "PONG" ? null : "Réponse inattendue" };
  } catch (e) {
    return { ok: false, message: e.message || "Connexion Redis impossible" };
  }
}

/**
 * Choisit redis ou mémoire selon REDIS_URL et disponibilité réelle.
 * @returns {"redis" | "memory"}
 */
export async function resolveQueueBackend() {
  if (resolvedBackend) return resolvedBackend;
  if (!isRedisConfigured()) {
    resolvedBackend = "memory";
    return resolvedBackend;
  }
  const ping = await pingRedis();
  if (ping.ok) {
    resolvedBackend = "redis";
    console.log("[queue] Redis disponible — file BullMQ");
  } else {
    resolvedBackend = "memory";
    console.warn(
      `[queue] REDIS_URL défini mais Redis injoignable (${ping.message || "ECONNREFUSED"}) — file en mémoire (tests Docker / Ollama dans le process API).`
    );
  }
  return resolvedBackend;
}

export function getResolvedQueueBackend() {
  if (resolvedBackend) return resolvedBackend;
  return isRedisConfigured() ? "redis" : "memory";
}

export function forceMemoryQueueBackend() {
  resolvedBackend = "memory";
}
