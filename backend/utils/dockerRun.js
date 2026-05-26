import { spawn } from "child_process";

/** Exécute une commande docker (utilisé pour la découverte des ports sandbox). */
export function runDockerCommand(args, { cwd, env = {}, timeoutMs = 15000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn("docker", args, {
      cwd,
      env: { ...process.env, ...env },
      windowsHide: true,
    });
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
    }, Math.max(3000, timeoutMs));

    child.stdout?.on("data", (d) => {
      stdout += d.toString();
      if (stdout.length > 48000) stdout = stdout.slice(-48000);
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > 16000) stderr = stderr.slice(-16000);
    });

    child.on("close", (code) => {
      clearTimeout(killTimer);
      resolve({
        ok: !killed && code === 0,
        stdout,
        stderr,
        timedOut: killed,
      });
    });

    child.on("error", (err) => {
      clearTimeout(killTimer);
      resolve({ ok: false, stdout, stderr: err?.message || "Docker error", timedOut: false });
    });
  });
}
