import React, { Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ToastStack from "./components/ToastStack";
import LoadingBlock from "./components/LoadingBlock";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./components/DashboardLayout";
import { StudentWorkspaceProvider } from "./context/StudentWorkspaceContext";
import { TeacherRefreshProvider } from "./context/TeacherRefreshContext";
import { GradingResourcesProvider } from "./context/GradingResourcesContext";
import { lazyWithRetry } from "./lazyWithRetry";
import StudentHomePage from "./components/student/StudentHomePage";
import TeacherHomePage from "./components/teacher/TeacherHomePage";

const Login = lazyWithRetry(() => import("./components/Login"), "Login");
const StudentProgressionPage = lazyWithRetry(
  () => import("./components/student/StudentProgressionPage"),
  "StudentProgressionPage"
);
const StudentMesProjetsPage = lazyWithRetry(
  () => import("./components/student/StudentMesProjetsPage"),
  "StudentMesProjetsPage"
);
const StudentSoumissionPage = lazyWithRetry(
  () => import("./components/student/StudentSoumissionPage"),
  "StudentSoumissionPage"
);
const StudentClassementPage = lazyWithRetry(
  () => import("./components/student/StudentClassementPage"),
  "StudentClassementPage"
);
const StudentGraphePage = lazyWithRetry(
  () => import("./components/student/StudentGraphePage"),
  "StudentGraphePage"
);
const TeacherGestionPage = lazyWithRetry(
  () => import("./components/teacher/TeacherGestionPage"),
  "TeacherGestionPage"
);
const TeacherGraphePage = lazyWithRetry(
  () => import("./components/teacher/TeacherGraphePage"),
  "TeacherGraphePage"
);
const TeacherClassementPage = lazyWithRetry(
  () => import("./components/teacher/TeacherClassementPage"),
  "TeacherClassementPage"
);
const TeacherSuiviPage = lazyWithRetry(
  () => import("./components/teacher/TeacherSuiviPage"),
  "TeacherSuiviPage"
);
const StudentMaNotePage = lazyWithRetry(
  () => import("./components/student/StudentMaNotePage"),
  "StudentMaNotePage"
);
const TeacherProjectView = lazyWithRetry(
  () => import("./components/TeacherProjectView"),
  "TeacherProjectView"
);
const ActivityFeedPage = lazyWithRetry(() => import("./components/ActivityFeedPage"), "ActivityFeedPage");
const AdminDashboardLayout = lazyWithRetry(
  () => import("./components/admin/AdminDashboardLayout"),
  "AdminDashboardLayout"
);
const AdminHomePage = lazyWithRetry(() => import("./components/admin/AdminHomePage"), "AdminHomePage");
const AdminUsersPage = lazyWithRetry(() => import("./components/admin/AdminUsersPage"), "AdminUsersPage");
const AdminSecurityPage = lazyWithRetry(
  () => import("./components/admin/AdminSecurityPage"),
  "AdminSecurityPage"
);
const AdminAuditPage = lazyWithRetry(() => import("./components/admin/AdminAuditPage"), "AdminAuditPage");

function PageFallback() {
  return (
    <div className="layout-content">
      <LoadingBlock />
    </div>
  );
}

function App() {
  return (
    <div className="app-shell">
      <Router>
        <ToastStack />
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route
              path="/student-dashboard"
              element={
                <ProtectedRoute role="student">
                  <StudentWorkspaceProvider>
                    <DashboardLayout variant="student" />
                  </StudentWorkspaceProvider>
                </ProtectedRoute>
              }
            >
              <Route index element={<StudentHomePage />} />
              <Route path="progression" element={<StudentProgressionPage />} />
              <Route path="mes-projets" element={<StudentMesProjetsPage />} />
              <Route path="graphe" element={<StudentGraphePage />} />
              <Route path="soumission" element={<StudentSoumissionPage />} />
              <Route path="classement" element={<StudentClassementPage />} />
              <Route path="ma-note" element={<StudentMaNotePage />} />
              <Route path="activite" element={<ActivityFeedPage />} />
            </Route>
            <Route
              path="/teacher-dashboard"
              element={
                <ProtectedRoute role="teacher">
                  <TeacherRefreshProvider>
                    <GradingResourcesProvider>
                      <DashboardLayout variant="teacher" />
                    </GradingResourcesProvider>
                  </TeacherRefreshProvider>
                </ProtectedRoute>
              }
            >
              <Route index element={<TeacherHomePage />} />
              <Route path="gestion" element={<TeacherGestionPage />} />
              <Route path="graphe" element={<TeacherGraphePage />} />
              <Route path="classement" element={<TeacherClassementPage />} />
              <Route path="suivi" element={<TeacherSuiviPage />} />
              <Route path="project/:projectId" element={<TeacherProjectView />} />
              <Route path="activite" element={<ActivityFeedPage />} />
            </Route>
            <Route
              path="/admin-dashboard"
              element={
                <ProtectedRoute role="admin">
                  <AdminDashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminHomePage />} />
              <Route path="utilisateurs" element={<AdminUsersPage />} />
              <Route path="securite" element={<AdminSecurityPage />} />
              <Route path="audit" element={<AdminAuditPage />} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </div>
  );
}

export default App;
