import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiBase";
import { emitToast } from "../toastBus";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regFeedback, setRegFeedback] = useState({ ok: true, text: "" });
  const [publicAllowReg, setPublicAllowReg] = useState(true);
  const [showFirstAdminSetup, setShowFirstAdminSetup] = useState(false);
  const [setupKey, setSetupKey] = useState("");
  const [setupName, setSetupName] = useState("");
  const [setupEmail, setSetupEmail] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_BASE}/api/public/settings`)
      .then((r) => r.json())
      .then((d) => setPublicAllowReg(d.allowStudentSelfRegistration !== false))
      .catch(() => setPublicAllowReg(true));
  }, []);

  useEffect(() => {
    if (!publicAllowReg && showRegister) setShowRegister(false);
  }, [publicAllowReg, showRegister]);

  const handleUnifiedLogin = async (e) => {
    e.preventDefault();
    try {
      const teacherRes = await fetch(`${API_BASE}/api/teachers/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const teacherData = await teacherRes.json();
      if (teacherRes.ok) {
        localStorage.setItem("user", JSON.stringify({ ...teacherData, role: "teacher" }));
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
      if (studentRes.ok) {
        localStorage.setItem("user", JSON.stringify({ ...studentData, role: "student" }));
        navigate("/student-dashboard");
        return;
      }
      if (studentRes.status !== 404) {
        throw new Error(studentData.message || studentData.error || "Échec connexion");
      }

      const adminRes = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const adminData = await adminRes.json();
      if (adminRes.ok) {
        localStorage.setItem("user", JSON.stringify({ ...adminData, role: "admin" }));
        navigate("/admin-dashboard");
        return;
      }

      throw new Error(adminData.message || adminData.error || "Identifiants non reconnus.");
    } catch (err) {
      emitToast({ title: "Connexion", message: err.message, variant: "error" });
    }
  };

  const handleFirstAdminSetup = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/admin/first-setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupKey,
          name: setupName,
          email: setupEmail,
          password: setupPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Échec");
      emitToast({
        title: "Administrateur créé",
        message: data.message || "Connectez-vous avec cet e-mail.",
      });
      setEmail(setupEmail);
      setPassword("");
      setShowFirstAdminSetup(false);
      setSetupKey("");
      setSetupName("");
      setSetupEmail("");
      setSetupPassword("");
    } catch (err) {
      emitToast({ title: "Configuration", message: err.message, variant: "error" });
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
      setRegFeedback({ ok: true, text: "Compte créé." });
      emitToast({ title: "Compte créé", message: "Vous pouvez vous connecter." });
      setEmail(regEmail);
      setPassword("");
      setRegName("");
      setRegEmail("");
      setRegPassword("");
      setShowRegister(false);
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
            <h2 className="auth-aside__heading">Projets et TP.</h2>
          </div>
        </aside>

        <div className="auth-main">
          <div className="auth-card">
            <div className="auth-brand">
              <div className="auth-brand__mark" aria-hidden="true" />
              <div>
                <h1 className="auth-brand__title">TP Projets</h1>
                <p className="auth-brand__subtitle auth-brand__subtitle--muted">
                  Connexion enseignant, étudiant ou administrateur
                </p>
              </div>
            </div>

            {!showRegister ? (
              <form className="auth-form" onSubmit={handleUnifiedLogin}>
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

                {publicAllowReg ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-block"
                    style={{ marginTop: "0.35rem" }}
                    onClick={() => {
                      setShowRegister(true);
                      setRegFeedback({ ok: true, text: "" });
                    }}
                  >
                    Créer un compte étudiant
                  </button>
                ) : null}
              </form>
            ) : (
              <form className="auth-form" onSubmit={handleRegisterStudent}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginBottom: "0.75rem", alignSelf: "flex-start" }}
                  onClick={() => setShowRegister(false)}
                >
                  ← Retour connexion
                </button>
                {regFeedback.text ? (
                  <div
                    className={`feedback${regFeedback.ok ? " feedback--ok" : " feedback--err"}`}
                    style={{ marginBottom: "0.75rem" }}
                  >
                    {regFeedback.text}
                  </div>
                ) : null}

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
                  S&apos;inscrire
                </button>
              </form>
            )}

            <div className="auth-secondary">
              <button
                type="button"
                className="auth-secondary__toggle"
                onClick={() => setShowFirstAdminSetup((v) => !v)}
                aria-expanded={showFirstAdminSetup}
              >
                {showFirstAdminSetup ? "Masquer la configuration initiale" : "Configuration initiale (admin)"}
              </button>
              {showFirstAdminSetup ? (
                <form className="auth-form auth-form--compact" onSubmit={handleFirstAdminSetup}>
                  <p className="auth-footnote" style={{ textAlign: "left", marginBottom: "0.5rem" }}>
                    <code>ADMIN_FIRST_SETUP_KEY</code> · aucun admin en base
                  </p>
                  <label className="form-label">Clé</label>
                  <input
                    className="form-input form-input--full"
                    type="password"
                    value={setupKey}
                    onChange={(e) => setSetupKey(e.target.value)}
                    required
                    autoComplete="off"
                  />
                  <label className="form-label">Nom</label>
                  <input
                    className="form-input form-input--full"
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    required
                  />
                  <label className="form-label">Email</label>
                  <input
                    className="form-input form-input--full"
                    type="email"
                    value={setupEmail}
                    onChange={(e) => setSetupEmail(e.target.value)}
                    required
                  />
                  <label className="form-label">Mot de passe</label>
                  <input
                    className="form-input form-input--full"
                    type="password"
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button type="submit" className="btn btn-secondary btn-block">
                    Créer le premier administrateur
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
