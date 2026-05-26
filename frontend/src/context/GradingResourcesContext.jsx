import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../apiBase";
import { authHeaders } from "../authStorage";

const FALLBACK_RUBRIC = {
  maxTotal: 20,
  criteria: [
    { id: "cahier_charges", label: "Respect du cahier des charges", maxPoints: 6 },
    { id: "fonctionnalite", label: "Fonctionnalités et complétude", maxPoints: 5 },
    { id: "qualite_code", label: "Qualité du code", maxPoints: 4 },
    { id: "docker_tests", label: "Docker & tests", maxPoints: 3 },
    { id: "documentation", label: "Documentation", maxPoints: 2 },
  ],
};

const GradingResourcesContext = createContext(null);

export function GradingResourcesProvider({ children }) {
  const [rubric, setRubric] = useState(FALLBACK_RUBRIC);
  const [ollamaStatus, setOllamaStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`${API_BASE}/api/submissions/grading-rubric`, { headers: authHeaders() }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`${API_BASE}/api/submissions/ai-status`, { headers: authHeaders() }).then((r) =>
        r.ok ? r.json() : null
      ),
    ])
      .then(([rubricBody, aiBody]) => {
        if (cancelled) return;
        if (rubricBody?.criteria?.length) setRubric(rubricBody);
        setOllamaStatus(aiBody?.ollama ?? { ok: false });
      })
      .catch(() => {
        if (!cancelled) setOllamaStatus({ ok: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ rubric, ollamaStatus, refreshOllamaStatus: () => setOllamaStatus(null) }),
    [rubric, ollamaStatus]
  );

  return (
    <GradingResourcesContext.Provider value={value}>{children}</GradingResourcesContext.Provider>
  );
}

export function useGradingResources() {
  const ctx = useContext(GradingResourcesContext);
  return ctx || { rubric: FALLBACK_RUBRIC, ollamaStatus: null };
}
