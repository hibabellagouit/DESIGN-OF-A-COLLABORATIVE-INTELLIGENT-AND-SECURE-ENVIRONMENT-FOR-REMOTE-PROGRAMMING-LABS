import React from "react";

export default function LoadingBlock({ label = "Chargement…", compact = false }) {
  return (
    <div className={`loading-block${compact ? " loading-block--compact" : ""}`} role="status" aria-live="polite">
      <span className="loading-block__spinner" aria-hidden="true" />
      <span className="loading-block__label">{label}</span>
    </div>
  );
}
