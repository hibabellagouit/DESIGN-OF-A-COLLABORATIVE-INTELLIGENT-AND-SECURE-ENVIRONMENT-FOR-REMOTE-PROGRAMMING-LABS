import mongoose from "mongoose";
import { spawn } from "child_process";
import { checkOllamaAvailable, getOllamaConfig } from "../services/ollamaService.js";
import { getPublicComposeHints } from "../services/dockerComposeRunner.js";
import { pingRedis } from "../services/queue/bullmqJobs.js";
import { getQueueMode } from "../services/jobService.js";

function dockerPing() {
  return new Promise((resolve) => {
    const p = spawn("docker", ["version", "--format", "{{.Server.Version}}"], {
      windowsHide: true,
    });
    let out = "";
    const t = setTimeout(() => {
      try {
        p.kill();
      } catch {
        // ignore
      }
      resolve({ ok: false, message: "timeout" });
    }, 5000);
    p.stdout?.on("data", (d) => {
      out += d.toString();
    });
    p.on("close", (code) => {
      clearTimeout(t);
      resolve(code === 0 ? { ok: true, version: out.trim() } : { ok: false });
    });
    p.on("error", () => {
      clearTimeout(t);
      resolve({ ok: false, message: "docker non installé" });
    });
  });
}

export async function getHealth(_req, res) {
  const mongoReady = mongoose.connection.readyState === 1;
  const [docker, ollama, redis] = await Promise.all([
    dockerPing(),
    checkOllamaAvailable(),
    pingRedis(),
  ]);

  res.status(200).json({
    ok: true,
    ready: mongoReady,
    timestamp: new Date().toISOString(),
    services: {
      mongodb: {
        ok: mongoReady,
        state: mongoose.connection.readyState,
      },
      docker: {
        ok: docker.ok,
        version: docker.version || null,
        message: docker.message || null,
      },
      ollama: {
        ok: ollama.ok,
        baseUrl: getOllamaConfig().baseUrl,
        model: getOllamaConfig().model,
        message: ollama.ok ? null : ollama.message,
        models: ollama.models || [],
      },
      redis: {
        ok: redis.ok,
        mode: getQueueMode(),
        message: redis.message,
      },
    },
    sandbox: getPublicComposeHints(),
  });
}
