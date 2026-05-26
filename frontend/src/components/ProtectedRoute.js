import React from "react";
import { Navigate } from "react-router-dom";
import { readToken, readTokenRole, readUser } from "../authStorage";

const ProtectedRoute = ({ children, role }) => {
  const user = readUser();
  const token = readToken();
  const tokenRole = readTokenRole();
  if (!user || !token || user.role !== role) {
    return <Navigate to="/" replace />;
  }
  if (tokenRole && tokenRole !== role) {
    localStorage.removeItem("user");
    return <Navigate to="/" replace />;
  }
  return children;
};

export default ProtectedRoute;
