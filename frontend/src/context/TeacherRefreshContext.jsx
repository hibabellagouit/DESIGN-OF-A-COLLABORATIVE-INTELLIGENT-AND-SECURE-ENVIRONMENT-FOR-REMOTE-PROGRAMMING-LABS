import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const TeacherRefreshContext = createContext(null);

export function TeacherRefreshProvider({ children }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);
  const value = useMemo(() => ({ refreshKey, bump }), [refreshKey, bump]);
  return <TeacherRefreshContext.Provider value={value}>{children}</TeacherRefreshContext.Provider>;
}

export function useTeacherRefresh() {
  const ctx = useContext(TeacherRefreshContext);
  if (!ctx) {
    throw new Error("useTeacherRefresh doit être utilisé sous TeacherRefreshProvider");
  }
  return ctx;
}
