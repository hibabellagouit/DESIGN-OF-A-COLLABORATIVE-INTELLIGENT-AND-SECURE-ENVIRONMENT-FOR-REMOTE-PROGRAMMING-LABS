import { maxConcurrentSandboxes } from "./sandboxComposeHarden.js";

let active = 0;
const waiters = [];

export function getSandboxActiveCount() {
  return active;
}

/**
 * Limite le nombre de tests compose simultanés sur le serveur.
 * @returns {Promise<() => void>} release
 */
export async function acquireSandboxSlot() {
  const max = maxConcurrentSandboxes();
  if (active < max) {
    active += 1;
    return () => {
      active = Math.max(0, active - 1);
      const next = waiters.shift();
      if (next) next();
    };
  }
  await new Promise((resolve) => waiters.push(resolve));
  active += 1;
  return () => {
    active = Math.max(0, active - 1);
    const next = waiters.shift();
    if (next) next();
  };
}
