import { lazy } from "react";

function isChunkLoadError(error) {
  const msg = String(error?.message || error || "");
  return (
    error?.name === "ChunkLoadError" ||
    /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
      msg
    )
  );
}

/**
 * lazy() avec rechargement automatique si le chunk webpack est obsolète (cache dev / déploiement).
 */
export function lazyWithRetry(importFn, chunkName = "chunk") {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (error) {
      if (!isChunkLoadError(error)) throw error;
      const key = `chunk-retry:${chunkName}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        return importFn();
      }
      sessionStorage.removeItem(key);
      window.location.reload();
      return new Promise(() => {});
    }
  });
}
