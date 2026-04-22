import React, { useEffect } from "react";

export default function Modal({ isOpen, title, onClose, children }) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title || "Popup"}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="modal"
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="modal__head">
          <div className="modal__head-left">
            {title ? <h3 className="modal__title">{title}</h3> : null}
          </div>
          <button
            type="button"
            className="modal__close"
            onClick={() => onClose?.()}
            aria-label="Fermer"
          >
            X
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

