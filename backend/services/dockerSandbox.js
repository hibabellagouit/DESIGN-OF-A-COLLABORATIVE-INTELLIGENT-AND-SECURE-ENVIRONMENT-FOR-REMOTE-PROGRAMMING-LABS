import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

function safeRm(dirPath) {
  try {
    if (dirPath && fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch {
    // ignore
  }
}

function ensureDockerAvailable() {
  return new Promise((resolve, reject) => {
    const p = spawn("docker", ["version"], { stdio: "ignore" });
    p.on("error", () => reject(new Error("Docker non disponible sur le serveur")));
    p.on("exit", (code) => {
      if (code === 0) resolve(true);
      else reject(new Error("Docker non disponible sur le serveur"));
    });
  });
}

function pickRuntime(fileOriginalName = "") {
  const lower = String(fileOriginalName).toLowerCase();
  if (lower.endsWith(".py")) {
    return {
      image: process.env.SANDBOX_PY_IMAGE || "python:3.12-alpine",
      cmd: ["python", "/workspace/main.py"],
      filename: "main.py",
    };
  }
  if (lower.endsWith(".js")) {
    return {
      image: process.env.SANDBOX_NODE_IMAGE || "node:20-alpine",
      cmd: ["node", "/workspace/main.js"],
      filename: "main.js",
    };
  }
  throw new Error("Type de fichier non supporté pour exécution (MVP: .py ou .js)");
}

/** Message pédagogique si l’erreur correspond à des fichiers souvent mal remplis. */
function buildSandboxHint(stderr, originalName = "") {
  const s = String(stderr || "");
  const lower = String(originalName).toLowerCase();
  if (lower.endsWith(".py")) {
    if (/name ['"]python['"] is not defined/i.test(s)) {
      return (
        "Le fichier .py ne doit pas contenir la commande shell « python » : le serveur lance déjà " +
        "« python /workspace/main.py ». Écrivez uniquement du code Python, par ex. print(\"Bonjour\") ou def main(): …"
      );
    }
  }
  if (lower.endsWith(".js")) {
    if (/name ['"]node['"] is not defined/i.test(s)) {
      return (
        "Le fichier .js ne doit pas contenir la commande « node » : le serveur exécute déjà " +
        "« node /workspace/main.js ». Mettez uniquement du code JavaScript."
      );
    }
  }
  return "";
}

/** Infos affichables côté UI (alignées sur `runInSandbox`). */
export function getPublicSandboxHints() {
  const pyImage = process.env.SANDBOX_PY_IMAGE || "python:3.12-alpine";
  const nodeImage = process.env.SANDBOX_NODE_IMAGE || "node:20-alpine";
  const timeoutMs = Number(process.env.SANDBOX_TIMEOUT_MS || 6000);
  const memory = String(process.env.SANDBOX_MEMORY || "512m");
  return {
    timeoutMs,
    memory,
    languages: [
      {
        extensions: [".py"],
        dockerImage: pyImage,
        fileInWorkspace: "main.py",
        command: ["python", "/workspace/main.py"],
        description:
          "Votre code uniquement dans le fichier (pas la ligne « python »). Copié en main.py puis exécuté par le serveur : python /workspace/main.py",
      },
      {
        extensions: [".js"],
        dockerImage: nodeImage,
        fileInWorkspace: "main.js",
        command: ["node", "/workspace/main.js"],
        description:
          "Votre code uniquement dans le fichier (pas la ligne « node »). Copié en main.js puis exécuté par le serveur : node /workspace/main.js",
      },
    ],
  };
}

export async function runInSandbox({ inputFilePath, inputFileOriginalName }) {
  await ensureDockerAvailable();

  const timeoutMs = Number(process.env.SANDBOX_TIMEOUT_MS || 6000);
  const memory = String(process.env.SANDBOX_MEMORY || "512m");
  const cpus = String(process.env.SANDBOX_CPUS || "1");
  const pids = String(process.env.SANDBOX_PIDS || "128");

  const runtime = pickRuntime(inputFileOriginalName);

  const workDir = path.join(os.tmpdir(), `sandbox-${crypto.randomUUID()}`);
  fs.mkdirSync(workDir, { recursive: true });

  const targetFile = path.join(workDir, runtime.filename);
  fs.copyFileSync(inputFilePath, targetFile);

  const args = [
    "run",
    "--rm",
    "--network",
    "none",
    "--cpus",
    cpus,
    "--memory",
    memory,
    "--pids-limit",
    pids,
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--workdir",
    "/workspace",
    "--mount",
    `type=bind,src=${workDir},dst=/workspace,readonly`,
    runtime.image,
    ...runtime.cmd,
  ];

  return new Promise((resolve) => {
    const child = spawn("docker", args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let killed = false;

    const killTimer = setTimeout(() => {
      killed = true;
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
    }, Math.max(1000, timeoutMs));

    child.stdout?.on("data", (d) => {
      stdout += d.toString();
      if (stdout.length > 20000) stdout = stdout.slice(-20000);
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > 20000) stderr = stderr.slice(-20000);
    });

    child.on("close", (code) => {
      clearTimeout(killTimer);
      const hint = buildSandboxHint(stderr, inputFileOriginalName);
      safeRm(workDir);
      resolve({
        ok: !killed && code === 0,
        exitCode: killed ? null : code,
        timedOut: killed,
        stdout,
        stderr,
        hint,
        image: runtime.image,
      });
    });

    child.on("error", (err) => {
      clearTimeout(killTimer);
      const hint = buildSandboxHint(stderr, inputFileOriginalName);
      safeRm(workDir);
      resolve({
        ok: false,
        exitCode: null,
        timedOut: false,
        stdout,
        stderr: `${stderr}\n${err?.message || "Docker error"}`.trim(),
        hint,
        image: runtime.image,
      });
    });
  });
}

