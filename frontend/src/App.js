import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ToastStack from "./components/ToastStack";
import Login from "./components/Login";
import StudentHomePage from "./components/student/StudentHomePage";
import StudentProgressionPage from "./components/student/StudentProgressionPage";
import StudentMesProjetsPage from "./components/student/StudentMesProjetsPage";
import StudentSoumissionPage from "./components/student/StudentSoumissionPage";
import StudentGraphePage from "./components/student/StudentGraphePage";
import TeacherHomePage from "./components/teacher/TeacherHomePage";
import TeacherGestionPage from "./components/teacher/TeacherGestionPage";
import TeacherGraphePage from "./components/teacher/TeacherGraphePage";
import TeacherSoumissionsPage from "./components/teacher/TeacherSoumissionsPage";
import TeacherProjectView from "./components/TeacherProjectView";
import ActivityFeedPage from "./components/ActivityFeedPage";
import AdminDashboardLayout from "./components/admin/AdminDashboardLayout";
import AdminHomePage from "./components/admin/AdminHomePage";
import AdminUsersPage from "./components/admin/AdminUsersPage";
import AdminSecurityPage from "./components/admin/AdminSecurityPage";
import AdminAuditPage from "./components/admin/AdminAuditPage";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./components/DashboardLayout";
import { StudentWorkspaceProvider } from "./context/StudentWorkspaceContext";
import { TeacherRefreshProvider } from "./context/TeacherRefreshContext";

function App() {
  return (
    <div className="app-shell">
      <Router>
        <ToastStack />
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
            <Route path="activite" element={<ActivityFeedPage />} />
          </Route>
          <Route
            path="/teacher-dashboard"
            element={
              <ProtectedRoute role="teacher">
                <TeacherRefreshProvider>
                  <DashboardLayout variant="teacher" />
                </TeacherRefreshProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<TeacherHomePage />} />
            <Route path="gestion" element={<TeacherGestionPage />} />
            <Route path="graphe" element={<TeacherGraphePage />} />
            <Route path="soumissions" element={<TeacherSoumissionsPage />} />
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
      </Router>
    </div>
  );
}

export default App;
