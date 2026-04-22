import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiBase";

const Login = () => {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regFeedback, setRegFeedback] = useState({ ok: true, text: "" });
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const teacherRes = await fetch(`${API_BASE}/api/teachers/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const teacherData = await teacherRes.json();
      if (teacherRes.ok) {
        localStorage.setItem(
          "user",
          JSON.stringify({ ...teacherData, role: "teacher" })
        );
        navigate("/teacher-dashboard");
        return;
      }
      if (teacherRes.status !== 404) {
        throw new Error(teacherData.message || teacherData.error || "Échec connexion");
      }

      const studentRes = await fetch(`${API_BASE}/api/students/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const studentData = await studentRes.json();
      if (!studentRes.ok) {
        throw new Error(studentData.message || studentData.error || "Échec connexion");
      }
      localStorage.setItem(
        "user",
        JSON.stringify({ ...studentData, role: "student" })
      );
      navigate("/student-dashboard");
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRegisterStudent = async (e) => {
    e.preventDefault();
    setRegFeedback({ ok: true, text: "" });
    try {
      const res = await fetch(`${API_BASE}/api/students/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message);
      setRegFeedback({
        ok: true,
        text: "Compte créé. Vous pouvez vous connecter.",
      });
      setEmail(regEmail);
      setPassword("");
      setRegName("");
      setRegEmail("");
      setRegPassword("");
      setMode("login");
    } catch (err) {
      setRegFeedback({ ok: false, text: err.message });
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <aside className="auth-aside" aria-hidden="true">
          <div className="auth-aside__pattern" />
          <div className="auth-aside__content">
            <span className="auth-aside__badge">TP &amp; projets</span>
            <h2 className="auth-aside__heading">
              Travaux pratiques et sujets de programmation, au même endroit.
            </h2>
          </div>
        </aside>

        <div className="auth-main">
          <div className="auth-card">
            <div className="auth-brand">
              <div className="auth-brand__mark" aria-hidden="true" />
              <div>
                <h1 className="auth-brand__title">TP Projets</h1>
                <p className="auth-brand__subtitle">Connexion à la plateforme</p>
              </div>
            </div>

            <div className="auth-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                className={`auth-tab${mode === "login" ? " auth-tab--active" : ""}`}
                onClick={() => setMode("login")}
              >
                Connexion
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                className={`auth-tab${mode === "register" ? " auth-tab--active" : ""}`}
                onClick={() => setMode("register")}
              >
                Inscription étudiant
              </button>
            </div>

            {mode === "login" && (
              <form className="auth-form" onSubmit={handleLogin}>
                <label className="form-label">Email</label>
                <input
                  className="form-input form-input--full"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                />

                <label className="form-label">Mot de passe</label>
                <input
                  className="form-input form-input--full"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />

                <button type="submit" className="btn btn-primary btn-block">
                  Se connecter
                </button>
                <p className="auth-footnote">
                  Le profil est déduit automatiquement à partir de votre e-mail.
                </p>
              </form>
            )}

            {mode === "register" && (
              <form className="auth-form" onSubmit={handleRegisterStudent}>
                {regFeedback.text && (
                  <div
                    className={`feedback${regFeedback.ok ? " feedback--ok" : " feedback--err"}`}
                  >
                    {regFeedback.text}
                  </div>
                )}

                <label className="form-label">Nom complet</label>
                <input
                  className="form-input form-input--full"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                  autoComplete="name"
                />

                <label className="form-label">Email</label>
                <input
                  className="form-input form-input--full"
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  autoComplete="email"
                />

                <label className="form-label">Mot de passe</label>
                <input
                  className="form-input form-input--full"
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />

                <button type="submit" className="btn btn-primary btn-block">
                  Créer mon compte étudiant
                </button>
                <p className="auth-footnote">
                  Les comptes enseignants sont créés par l’administration ou via un accès
                  dédié.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
