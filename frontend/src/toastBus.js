/** Événement global pour afficher un toast sans dépendre du contexte React. */
export const TOAST_EVENT = "app:toast";

/**
 * @param {{ title?: string; message: string; variant?: "success" | "error" | "info" }} payload
 */
export function emitToast(payload) {
  if (typeof window === "undefined") return;
  const { title = "", message, variant = "success" } = payload || {};
  if (!message && !title) return;
  window.dispatchEvent(
    new CustomEvent(TOAST_EVENT, {
      detail: { title, message: message || "", variant },
    })
  );
}
