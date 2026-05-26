import React, { useCallback, useEffect, useRef, useState } from "react";
import { TOAST_EVENT } from "../toastBus";

const AUTO_MS = 6500;
const MAX = 6;

export default function ToastStack() {
  const [toasts, setToasts] = useState([]);
  const timeoutsRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    const tid = timeoutsRef.current.get(id);
    if (tid != null) {
      window.clearTimeout(tid);
      timeoutsRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (detail) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const item = {
        id,
        title: detail.title || "",
        message: detail.message || "",
        variant:
          detail.variant === "error" || detail.variant === "info" ? detail.variant : "success",
      };
      setToasts((prev) => [item, ...prev].slice(0, MAX));
      const tid = window.setTimeout(() => dismiss(id), AUTO_MS);
      timeoutsRef.current.set(id, tid);
    },
    [dismiss]
  );

  useEffect(() => {
    const onToast = (e) => {
      if (e?.detail) push(e.detail);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      timeoutsRef.current.forEach((tid) => window.clearTimeout(tid));
      timeoutsRef.current.clear();
    };
  }, [push]);

  return (
    <div
      className={`toast-stack${toasts.length === 0 ? " toast-stack--empty" : ""}`}
      role="region"
      aria-label="Messages"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.variant}`} role="alert">
          <div className="toast__inner">
            {t.title ? <div className="toast__title">{t.title}</div> : null}
            {t.message ? <div className="toast__msg">{t.message}</div> : null}
            <button
              type="button"
              className="toast__close"
              onClick={() => dismiss(t.id)}
              aria-label="Fermer"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
