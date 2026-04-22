import React from "react";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children, role }) => {
  let user = null;
  try {
    const raw = localStorage.getItem("user");
    if (raw) user = JSON.parse(raw);
  } catch {
    user = null;
  }
  if (!user || user.role !== role) {
    return <Navigate to="/" replace />;
  }
  return children;
};

export default ProtectedRoute;
