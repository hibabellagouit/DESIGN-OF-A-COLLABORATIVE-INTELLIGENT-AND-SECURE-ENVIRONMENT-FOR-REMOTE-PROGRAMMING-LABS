import React, { useCallback, useEffect, useState } from "react";
import { TOAST_EVENT } from "../toastBus";

const AUTO_MS = 6500;
const MAX = 6;

export default function ToastStack() {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((detail) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const item = {
      id,
      title: detail.title || "",
      message: detail.message || "",
      variant: detail.variant === "error" || detail.variant === "info" ? detail.variant : "success",
    };
    setToasts((prev) => {
      const next = [item, ...prev].slice(0, MAX);
      return next;
    });
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, AUTO_MS);
  }, []);

  useEffect(() => {
    const onToast = (e) => {
      if (e?.detail) push(e.detail);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, [push]);

  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" role="region" aria-label="Messages">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast--${t.variant}`}
          role="alert"
        >
          <div className="toast__inner">
            {t.title ? <p className="toast__title">{t.title}</p> : null}
            {t.message ? <p className="toast__msg">{t.message}</p> : null}
            <button type="button" className="toast__close" onClick={() => dismiss(t.id)} aria-label="Fermer">
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
