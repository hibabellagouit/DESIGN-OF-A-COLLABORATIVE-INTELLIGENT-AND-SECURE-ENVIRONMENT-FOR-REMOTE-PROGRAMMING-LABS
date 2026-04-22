import React, { useEffect, useRef, useState } from "react";
import { API_BASE } from "../apiBase";
import { REFERENCE_KIND_LABELS } from "../referenceLabels";
import Modal from "./Modal";

export default function TeacherForms({ onAssignmentsChanged }) {
  const [projects, setProjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [feedback, setFeedback] = useState({ ok: true, text: "" });
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);

  const loadData = () => {
    fetch(`${API_BASE}/api/projects`)
      .then((r) => r.json())
      .then(setProjects)
      .catch(() =>
        setFeedback({ ok: false, text: "Erreur chargement projets" })
      );

    fetch(`${API_BASE}/api/students`)
      .then((r) => r.json())
      .then(setStudents)
      .catch(() =>
        setFeedback({ ok: false, text: "Erreur chargement étudiants" })
      );
  };

  useEffect(() => {
    loadData();
  }, []);

  const [stuName, setStuName] = useState("");
  const [stuEmail, setStuEmail] = useState("");
  const [stuPass, setStuPass] = useState("");

  const handleRegisterStudent = async (e) => {
    e.preventDefault();
    setFeedback({ ok: true, text: "" });
    try {
      const res = await fetch(`${API_BASE}/api/students/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: stuName,
          email: stuEmail,
          password: stuPass,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message);
      setFeedback({ ok: true, text: "Étudiant ajouté ✅" });
      setStuName("");
      setStuEmail("");
      setStuPass("");
      loadData();
    } catch (err) {
      setFeedback({ ok: false, text: err.message });
    }
  };

  const [projTitle, setProjTitle] = useState("");
  const [projDesc, setProjDesc] = useState("");
  const [projNiveau, setProjNiveau] = useState(1);
  const [projMax, setProjMax] = useState(3);
  const [projCahier, setProjCahier] = useState("");
  const [projRefKind, setProjRefKind] = useState("autre");
  const [projRef, setProjRef] = useState("");
  const cdcFileRef = useRef(null);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setFeedback({ ok: true, text: "" });
    try {
      const fd = new FormData();
      fd.append("title", projTitle.trim());
      fd.append("description", projDesc);
      fd.append("niveau", String(projNiveau));
      fd.append("maxStudents", String(projMax));
      fd.append("cahierDeCharge", projCahier);
      fd.append("referenceKind", projRefKind);
      fd.append("referenceValidation", projRef);
      const file = cdcFileRef.current?.files?.[0];
      if (file) fd.append("cahierFile", file);

      const res = await fetch(`${API_BASE}/api/projects`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message);
      setFeedback({ ok: true, text: "Projet créé ✅" });
      setProjTitle("");
      setProjDesc("");
      setProjNiveau(1);
      setProjMax(3);
      setProjCahier("");
      setProjRefKind("autre");
      setProjRef("");
      if (cdcFileRef.current) cdcFileRef.current.value = "";
      loadData();
    } catch (err) {
      setFeedback({ ok: false, text: err.message });
    }
  };

  const [assignProjectId, setAssignProjectId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  const toggleStudent = (id) => {
    const sid = typeof id === "string" ? id : id?.toString?.();
    setSelectedStudentIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]
    );
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    setFeedback({ ok: true, text: "" });
    if (!assignProjectId || selectedStudentIds.length === 0) {
      setFeedback({
        ok: false,
        text: "Choisissez un projet et au moins un étudiant.",
      });
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: assignProjectId,
          students: selectedStudentIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error);
      setFeedback({ ok: true, text: "Projet affecté ✅" });
      setSelectedStudentIds([]);
      loadData();
      onAssignmentsChanged?.();
    } catch (err) {
      setFeedback({ ok: false, text: err.message });
    }
  };

  return (
    <div className="teacher-forms">
      {feedback.text && !studentModalOpen && !projectModalOpen && (
        <div
          className={`feedback${feedback.ok ? " feedback--ok" : " feedback--err"}`}
        >
          {feedback.text}
        </div>
      )}

      <section className="panel panel--wide">
        <div className="panel__head">
          <span className="panel__step">1</span>
          <div>
            <h3 className="panel__title">Étudiant</h3>
            <p className="panel__hint">
              Création par l’enseignant — les étudiants peuvent aussi s’inscrire sur la page
              d’accueil.
            </p>
          </div>
        </div>
        <div className="panel__body">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setStudentModalOpen(true)}
          >
            Créer un étudiant
          </button>
        </div>
      </section>

      <Modal
        isOpen={studentModalOpen}
        title="Créer un étudiant"
        onClose={() => setStudentModalOpen(false)}
      >
        {feedback.text && (
          <div
            className={`feedback${feedback.ok ? " feedback--ok" : " feedback--err"}`}
          >
            {feedback.text}
          </div>
        )}
        <form onSubmit={handleRegisterStudent}>
          <label className="form-label">Nom</label>
          <input
            className="form-input form-input--full"
            value={stuName}
            onChange={(e) => setStuName(e.target.value)}
            required
          />
          <label className="form-label">Email</label>
          <input
            className="form-input form-input--full"
            type="email"
            value={stuEmail}
            onChange={(e) => setStuEmail(e.target.value)}
            required
          />
          <label className="form-label">Mot de passe</label>
          <input
            className="form-input form-input--full"
            type="password"
            value={stuPass}
            onChange={(e) => setStuPass(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-secondary">
            Enregistrer l’étudiant
          </button>
        </form>
      </Modal>

      <section className="panel panel--wide">
        <div className="panel__head">
          <span className="panel__step">2</span>
          <div>
            <h3 className="panel__title">Nouveau projet</h3>
            <p className="panel__hint">
              Définition du sujet, niveau, effectif, cahier des charges (texte + fichier) et
              références techniques.
            </p>
          </div>
        </div>
        <div className="panel__body">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setProjectModalOpen(true)}
          >
            Créer un projet
          </button>
        </div>
      </section>

      <Modal
        isOpen={projectModalOpen}
        title="Créer un projet"
        onClose={() => setProjectModalOpen(false)}
      >
        {feedback.text && (
          <div
            className={`feedback${feedback.ok ? " feedback--ok" : " feedback--err"}`}
          >
            {feedback.text}
          </div>
        )}
        <form onSubmit={handleCreateProject}>
          <div className="form-row form-row--2">
            <div className="form-field">
              <label className="form-label">Titre</label>
              <input
                className="form-input form-input--full"
                value={projTitle}
                onChange={(e) => setProjTitle(e.target.value)}
                required
              />
            </div>
            <div className="form-field form-field--span">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea form-input--full"
                value={projDesc}
                onChange={(e) => setProjDesc(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <div className="form-row form-row--2">
            <div className="form-field">
              <label className="form-label">Niveau (1–5)</label>
              <input
                className="form-input form-input--full"
                type="number"
                min={1}
                max={5}
                value={projNiveau}
                onChange={(e) => setProjNiveau(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label">Effectif max</label>
              <input
                className="form-input form-input--full"
                type="number"
                min={1}
                value={projMax}
                onChange={(e) => setProjMax(e.target.value)}
                required
              />
            </div>
          </div>
          <label className="form-label">Cahier des charges — résumé (optionnel)</label>
          <textarea
            className="form-textarea form-input--full"
            value={projCahier}
            onChange={(e) => setProjCahier(e.target.value)}
            rows={2}
            placeholder="Objectifs, livrables, contraintes en quelques lignes..."
          />
          <label className="form-label">
            Cahier des charges — fichier (PDF, Word, TXT, MD, ODT · max 15 Mo)
          </label>
          <input
            ref={cdcFileRef}
            className="form-input form-input--file form-input--full"
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md,.odt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
          />
          <div className="form-row form-row--2">
            <div className="form-field">
              <label className="form-label">Type de référence</label>
              <select
                className="form-select form-input--full"
                value={projRefKind}
                onChange={(e) => setProjRefKind(e.target.value)}
              >
                {Object.entries(REFERENCE_KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field form-field--span">
              <label className="form-label">Référence / lien / consigne</label>
              <textarea
                className="form-textarea form-input--full"
                value={projRef}
                onChange={(e) => setProjRef(e.target.value)}
                rows={2}
                placeholder="URL repo, stack, ID salle TP, commande de tests..."
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">
            Créer le projet
          </button>
        </form>
      </Modal>

      <section className="panel panel--wide">
        <div className="panel__head">
          <span className="panel__step">3</span>
          <div>
            <h3 className="panel__title">Affectation</h3>
            <p className="panel__hint">Liez un projet existant à un ou plusieurs étudiants.</p>
          </div>
        </div>
        <form className="panel__body" onSubmit={handleAssign}>
          <label className="form-label">Projet</label>
          <select
            className="form-select form-input--full"
            value={assignProjectId}
            onChange={(e) => setAssignProjectId(e.target.value)}
            required
          >
            <option value="">— Choisir un projet —</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>
                {p.title} (max {p.maxStudents})
              </option>
            ))}
          </select>
          <label className="form-label">Étudiants</label>
          <div className="student-list-box">
            {students.length === 0 ? (
              <p className="panel__empty">Aucun étudiant enregistré</p>
            ) : (
              students.map((s) => {
                const sid = s._id?.toString?.() ?? s._id;
                return (
                  <label key={sid} className="check-row">
                    <input
                      type="checkbox"
                      className="check-row__input"
                      checked={selectedStudentIds.includes(sid)}
                      onChange={() => toggleStudent(sid)}
                    />
                    <span>
                      {s.name}{" "}
                      <span className="check-row__muted">({s.email})</span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
          <button type="submit" className="btn btn-primary">
            Affecter le projet
          </button>
        </form>
      </section>
    </div>
  );
}
