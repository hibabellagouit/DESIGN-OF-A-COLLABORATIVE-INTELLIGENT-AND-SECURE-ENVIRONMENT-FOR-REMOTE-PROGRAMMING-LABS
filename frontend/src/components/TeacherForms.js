import React, { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../apiBase";
import { REFERENCE_KIND_LABELS } from "../referenceLabels";
import Modal from "./Modal";
import { authHeaders } from "../authStorage";
import { emitToast } from "../toastBus";

export default function TeacherForms({ onAssignmentsChanged }) {
  const [projects, setProjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [feedback, setFeedback] = useState({ ok: true, text: "" });
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectEditOpen, setProjectEditOpen] = useState(false);

  const studentList = useMemo(
    () => (Array.isArray(students) ? students : []),
    [students]
  );
  /** Sans équipe et avec GitHub renseigné (obligatoire pour composer une équipe). */
  const studentsEligibleForTeam = useMemo(
    () =>
      studentList.filter(
        (s) => !s.team && String(s.githubUsername || "").trim().length > 0
      ),
    [studentList]
  );

  const loadData = () => {
    fetch(`${API_BASE}/api/projects`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.message || data.error || "Projets");
        return data;
      })
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => {
        setProjects([]);
        setFeedback({ ok: false, text: "Erreur chargement projets" });
      });

    fetch(`${API_BASE}/api/students`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.message || data.error || "Étudiants");
        return data;
      })
      .then((data) => setStudents(Array.isArray(data) ? data : []))
      .catch(() => {
        setStudents([]);
        setFeedback({ ok: false, text: "Erreur chargement étudiants" });
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const [stuName, setStuName] = useState("");
  const [stuEmail, setStuEmail] = useState("");
  const [stuPass, setStuPass] = useState("");
  const [stuGithubOptional, setStuGithubOptional] = useState("");
  const [ghStudentPick, setGhStudentPick] = useState("");
  const [ghUsernameDraft, setGhUsernameDraft] = useState("");

  const handleRegisterStudent = async (e) => {
    e.preventDefault();
    setFeedback({ ok: true, text: "" });
    const ghRaw = stuGithubOptional.trim().replace(/^@/, "");
    if (!ghRaw) {
      const msg = "L’identifiant GitHub est obligatoire.";
      setFeedback({ ok: false, text: msg });
      emitToast({ title: "Création étudiant", message: msg, variant: "error" });
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/students/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: stuName,
          email: stuEmail,
          password: stuPass,
          githubUsername: ghRaw,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message);
      setFeedback({ ok: true, text: "Étudiant ajouté ✅" });
      emitToast({ title: "Étudiant ajouté", message: `${stuName.trim() || "Compte"} enregistré.` });
      setStuName("");
      setStuEmail("");
      setStuPass("");
      setStuGithubOptional("");
      loadData();
    } catch (err) {
      setFeedback({ ok: false, text: err.message });
      emitToast({
        title: "Création étudiant",
        message: err.message,
        variant: "error",
      });
    }
  };

  useEffect(() => {
    const s = studentList.find((x) => (x._id?.toString?.() ?? x._id) === ghStudentPick);
    setGhUsernameDraft(String(s?.githubUsername || "").replace(/^@/, ""));
  }, [ghStudentPick, studentList]);

  const handleSaveStudentGithub = async () => {
    const id = ghStudentPick;
    if (!id) {
      emitToast({ title: "GitHub", message: "Choisissez un étudiant.", variant: "error" });
      return;
    }
    const gh = ghUsernameDraft.trim().replace(/^@/, "");
    if (!gh) {
      emitToast({
        title: "GitHub",
        message: "L’identifiant GitHub est obligatoire.",
        variant: "error",
      });
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/students/${encodeURIComponent(id)}/github`, {
        method: "PATCH",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ githubUsername: gh }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error);
      emitToast({ title: "GitHub", message: data.message || "Enregistré." });
      loadData();
    } catch (e) {
      emitToast({ title: "GitHub", message: e.message || "Erreur", variant: "error" });
    }
  };

  const [projTitle, setProjTitle] = useState("");
  const [projDesc, setProjDesc] = useState("");
  const [projNiveau, setProjNiveau] = useState(1);
  const [projMax, setProjMax] = useState(3);
  const [projCahier, setProjCahier] = useState("");
  const [projRefKind, setProjRefKind] = useState("autre");
  const [projRef, setProjRef] = useState("");
  const [projDeadline, setProjDeadline] = useState("");
  const cdcFileRef = useRef(null);
  const composeFileRef = useRef(null);
  const editCdcFileRef = useRef(null);
  const editComposeFileRef = useRef(null);
  const [editProjectId, setEditProjectId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editNiveau, setEditNiveau] = useState(1);
  const [editMax, setEditMax] = useState(3);
  const [editCahier, setEditCahier] = useState("");
  const [editRefKind, setEditRefKind] = useState("autre");
  const [editRef, setEditRef] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [removeCdc, setRemoveCdc] = useState(false);

  const defaultProjSections = {
    description: true,
    cahierText: false,
    cahierFile: true,
    refBlock: false,
  };
  const [projSections, setProjSections] = useState(defaultProjSections);
  const [editSections, setEditSections] = useState(defaultProjSections);

  const toggleProjSection = (key, on) => {
    setProjSections((s) => ({ ...s, [key]: on }));
  };
  const toggleEditSection = (key, on) => {
    setEditSections((s) => ({ ...s, [key]: on }));
  };

  const editProjectRecord = useMemo(
    () => projects.find((x) => String(x._id) === String(editProjectId)),
    [projects, editProjectId]
  );

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
      if (projDeadline) fd.append("submissionDeadline", new Date(projDeadline).toISOString());
      const file = cdcFileRef.current?.files?.[0];
      if (file) fd.append("cahierFile", file);
      const compose = composeFileRef.current?.files?.[0];
      if (!compose) {
        const msg =
          "Fichier docker-compose obligatoire : joignez docker-compose.yml ou docker-compose.yaml (tests en environnement Docker).";
        setFeedback({ ok: false, text: msg });
        emitToast({ title: "Création projet", message: msg, variant: "error" });
        return;
      }
      fd.append("composeFile", compose);

      const res = await fetch(`${API_BASE}/api/projects`, {
        method: "POST",
        headers: authHeaders(),
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message);
      setFeedback({ ok: true, text: "Projet créé ✅" });
      emitToast({ title: "Projet créé", message: projTitle.trim() || "Nouveau projet enregistré." });
      setProjTitle("");
      setProjDesc("");
      setProjNiveau(1);
      setProjMax(3);
      setProjCahier("");
      setProjRefKind("autre");
      setProjRef("");
      setProjDeadline("");
      if (cdcFileRef.current) cdcFileRef.current.value = "";
      if (composeFileRef.current) composeFileRef.current.value = "";
      loadData();
      onAssignmentsChanged?.();
    } catch (err) {
      setFeedback({ ok: false, text: err.message });
      emitToast({ title: "Création projet", message: err.message, variant: "error" });
    }
  };

  const openEditProject = (projectId) => {
    const p = projects.find((x) => String(x._id) === String(projectId));
    if (!p) return;
    setEditProjectId(p._id);
    setEditTitle(p.title || "");
    setEditDesc(p.description || "");
    setEditNiveau(Number(p.niveau) || 1);
    setEditMax(Number(p.maxStudents) || 3);
    setEditCahier(p.cahierDeCharge || "");
    setEditRefKind(p.referenceKind || "autre");
    setEditRef(p.referenceValidation || "");
    setEditDeadline(
      p.submissionDeadline ? new Date(p.submissionDeadline).toISOString().slice(0, 16) : ""
    );
    setRemoveCdc(false);
    if (editCdcFileRef.current) editCdcFileRef.current.value = "";
    if (editComposeFileRef.current) editComposeFileRef.current.value = "";
    setProjectEditOpen(true);
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    setFeedback({ ok: true, text: "" });
    try {
      if (!editProjectId) throw new Error("Choisissez un projet");
      const fd = new FormData();
      fd.append("title", editTitle.trim());
      fd.append("description", editDesc);
      fd.append("niveau", String(editNiveau));
      fd.append("maxStudents", String(editMax));
      fd.append("cahierDeCharge", editCahier);
      fd.append("referenceKind", editRefKind);
      fd.append("referenceValidation", editRef);
      if (editDeadline) fd.append("submissionDeadline", new Date(editDeadline).toISOString());
      else fd.append("submissionDeadline", "");
      if (removeCdc) fd.append("removeCdc", "1");
      const file = editCdcFileRef.current?.files?.[0];
      if (file) fd.append("cahierFile", file);
      const compose = editComposeFileRef.current?.files?.[0];
      const hasComposeStored = Boolean(String(editProjectRecord?.composeFileStoredName || "").trim());
      if (!hasComposeStored && !compose) {
        const msg =
          "Ajoutez le fichier docker-compose de référence (.yml / .yaml) — obligatoire pour chaque projet.";
        setFeedback({ ok: false, text: msg });
        emitToast({ title: "Modification projet", message: msg, variant: "error" });
        return;
      }
      if (compose) fd.append("composeFile", compose);

      const res = await fetch(`${API_BASE}/api/projects/${editProjectId}`, {
        method: "PUT",
        headers: authHeaders(),
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Erreur modification");
      setFeedback({ ok: true, text: "Projet modifié ✅" });
      emitToast({ title: "Projet modifié", message: editTitle.trim() || "Modifications enregistrées." });
      setProjectEditOpen(false);
      loadData();
      onAssignmentsChanged?.();
    } catch (err) {
      setFeedback({ ok: false, text: err.message });
      emitToast({ title: "Modification projet", message: err.message, variant: "error" });
    }
  };

  const handleDeleteProject = async () => {
    setFeedback({ ok: true, text: "" });
    try {
      if (!editProjectId) throw new Error("Choisissez un projet");
      // eslint-disable-next-line no-restricted-globals
      const ok = confirm("Supprimer ce projet ? (irréversible)");
      if (!ok) return;
      const res = await fetch(`${API_BASE}/api/projects/${editProjectId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || "Erreur suppression");
      setFeedback({ ok: true, text: "Projet supprimé ✅" });
      emitToast({ title: "Projet supprimé", message: "Le projet a été retiré de la liste." });
      setProjectEditOpen(false);
      loadData();
      onAssignmentsChanged?.();
    } catch (err) {
      setFeedback({ ok: false, text: err.message });
      emitToast({ title: "Suppression projet", message: err.message, variant: "error" });
    }
  };

  const [teams, setTeams] = useState([]);
  const [teamName, setTeamName] = useState("");
  const [teamStudentIds, setTeamStudentIds] = useState([]);
  const [teamLeaderId, setTeamLeaderId] = useState("");

  const loadTeams = () => {
    fetch(`${API_BASE}/api/teams`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.message || data.error || "Équipes");
        return data;
      })
      .then((data) => setTeams(Array.isArray(data) ? data : []))
      .catch(() => setTeams([]));
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const toggleTeamStudent = (id) => {
    const sid = typeof id === "string" ? id : id?.toString?.();
    setTeamStudentIds((prev) => {
      const next = prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid];
      setTeamLeaderId((leader) => {
        if (next.length === 0) return "";
        if (next.length === 1) return next[0];
        if (leader && next.includes(leader)) return leader;
        return next[0];
      });
      return next;
    });
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setFeedback({ ok: true, text: "" });
    if (!teamName.trim() || teamStudentIds.length === 0) {
      const msg = "Indiquez un nom d’équipe et au moins un étudiant.";
      setFeedback({ ok: false, text: msg });
      emitToast({ title: "Équipe", message: msg, variant: "error" });
      return;
    }
    if (!teamLeaderId || !teamStudentIds.includes(teamLeaderId)) {
      const msg = "Désignez le responsable de l’équipe parmi les membres sélectionnés.";
      setFeedback({ ok: false, text: msg });
      emitToast({ title: "Équipe", message: msg, variant: "error" });
      return;
    }
    const missingGh = teamStudentIds.filter((tid) => {
      const st = studentList.find((x) => (x._id?.toString?.() ?? x._id) === tid);
      return !st || !String(st.githubUsername || "").trim();
    });
    if (missingGh.length > 0) {
      const msg =
        "Chaque membre doit avoir un identifiant GitHub renseigné (voir étape 1).";
      setFeedback({ ok: false, text: msg });
      emitToast({ title: "Équipe", message: msg, variant: "error" });
      return;
    }
    try {
      const leaderStudent = studentList.find(
        (s) => (s._id?.toString?.() ?? s._id) === teamLeaderId
      );
      const res = await fetch(`${API_BASE}/api/teams`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: teamName.trim(),
          studentIds: teamStudentIds,
          leaderId: teamLeaderId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error);
      setFeedback({ ok: true, text: "Équipe créée ✅" });
      emitToast({
        title: "Équipe créée",
        message: `« ${teamName.trim()} » — responsable : ${leaderStudent?.name || "—"} (${teamStudentIds.length} membre(s)).`,
      });
      setTeamName("");
      setTeamStudentIds([]);
      setTeamLeaderId("");
      loadTeams();
      loadData();
      onAssignmentsChanged?.();
    } catch (err) {
      setFeedback({ ok: false, text: err.message });
      emitToast({ title: "Équipe", message: err.message, variant: "error" });
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (!teamId) return;
    // eslint-disable-next-line no-restricted-globals
    if (!confirm("Supprimer cette équipe ? Les étudiants pourront être réaffectés à une autre équipe.")) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/teams/${teamId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error);
      emitToast({ title: "Équipe supprimée", message: "L’équipe a été retirée." });
      loadTeams();
      loadData();
    } catch (err) {
      emitToast({ title: "Équipe", message: err.message, variant: "error" });
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
          <details style={{ marginTop: 16 }}>
            <summary className="form-label" style={{ cursor: "pointer" }}>
              Compte GitHub des étudiants (obligatoire)
            </summary>
            <p className="diagram-item__meta" style={{ marginTop: 8 }}>
              À la création du compte, le GitHub doit déjà être indiqué. Utilisez ce bloc pour corriger ou
              compléter un identifiant. Les commits sont aussi rapprochés via l&apos;e-mail si elle
              correspond à celle de GitHub.
            </p>
            <div className="form-field" style={{ marginTop: 10 }}>
              <label className="form-label">Étudiant</label>
              <select
                className="form-select form-input--full"
                value={ghStudentPick}
                onChange={(e) => setGhStudentPick(e.target.value)}
              >
                <option value="">— Choisir —</option>
                {studentList.map((s) => {
                  const sid = s._id?.toString?.() ?? s._id;
                  return (
                    <option key={sid} value={sid}>
                      {s.name} ({s.email})
                    </option>
                  );
                })}
              </select>
            </div>
            <label className="form-label">Identifiant GitHub (obligatoire · sans @)</label>
            <input
              className="form-input form-input--full"
              placeholder="ex. octocat (sans @)"
              value={ghUsernameDraft}
              onChange={(e) => setGhUsernameDraft(e.target.value)}
              maxLength={39}
              autoCapitalize="off"
              autoCorrect="off"
            />
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ marginTop: 10 }}
              onClick={handleSaveStudentGithub}
            >
              Enregistrer pour cet étudiant
            </button>
          </details>
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
          <label className="form-label">
            Identifiant GitHub (pour analyse des commits){' '}
            <span className="check-row__muted">· obligatoire</span>
          </label>
          <input
            className="form-input form-input--full"
            placeholder="Sans @ · ex. monlogin"
            value={stuGithubOptional}
            onChange={(e) => setStuGithubOptional(e.target.value)}
            maxLength={39}
            required
            autoCapitalize="off"
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
              <label className="form-label">Nombre max d’équipes</label>
              <input
                className="form-input form-input--full"
                type="number"
                min={1}
                value={projMax}
                onChange={(e) => setProjMax(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label">Date limite de soumission (optionnel)</label>
              <input
                className="form-input form-input--full"
                type="datetime-local"
                value={projDeadline}
                onChange={(e) => setProjDeadline(e.target.value)}
              />
            </div>
          </div>

          <div className="form-section-block">
            <div className="form-section-block__head">
              <span className="form-section-block__label">Description</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => toggleProjSection("description", !projSections.description)}
              >
                {projSections.description ? "Masquer" : "Ajouter"}
              </button>
            </div>
            {projSections.description ? (
              <textarea
                className="form-textarea form-input--full"
                value={projDesc}
                onChange={(e) => setProjDesc(e.target.value)}
                rows={3}
                placeholder="Résumé court du projet…"
              />
            ) : null}
          </div>

          <div className="form-section-block">
            <div className="form-section-block__head">
              <span className="form-section-block__label">Cahier des charges (texte)</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => toggleProjSection("cahierText", !projSections.cahierText)}
              >
                {projSections.cahierText ? "Masquer" : "Ajouter"}
              </button>
            </div>
            {projSections.cahierText ? (
              <textarea
                className="form-textarea form-input--full"
                value={projCahier}
                onChange={(e) => setProjCahier(e.target.value)}
                rows={2}
                placeholder="Objectifs, livrables, contraintes…"
              />
            ) : null}
          </div>

          <div className="form-section-block">
            <div className="form-section-block__head">
              <span className="form-section-block__label">Cahier des charges (fichier)</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => toggleProjSection("cahierFile", !projSections.cahierFile)}
              >
                {projSections.cahierFile ? "Masquer" : "Ajouter"}
              </button>
            </div>
            {projSections.cahierFile ? (
              <input
                ref={cdcFileRef}
                className="form-input form-input--file form-input--full"
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md,.odt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
              />
            ) : null}
          </div>

          <div className="form-section-block form-section-block--required">
            <label className="form-label">
              docker-compose de référence <span className="form-label__req">*</span>
            </label>
            <p className="diagram-item__meta" style={{ marginTop: 4 }}>
              Obligatoire — modèle pour les tests Docker des équipes (.yml ou .yaml · max 15 Mo).
            </p>
            <input
              ref={composeFileRef}
              className="form-input form-input--file form-input--full"
              type="file"
              accept=".yml,.yaml,text/yaml,application/x-yaml"
              style={{ marginTop: 6 }}
              required
            />
          </div>

          <div className="form-section-block">
            <div className="form-section-block__head">
              <span className="form-section-block__label">Référence technique (optionnel)</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => toggleProjSection("refBlock", !projSections.refBlock)}
              >
                {projSections.refBlock ? "Masquer" : "Ajouter"}
              </button>
            </div>
            {projSections.refBlock ? (
              <div className="form-row form-row--2">
                <div className="form-field">
                  <label className="form-label">Type</label>
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
                  <label className="form-label">Lien ou consigne</label>
                  <textarea
                    className="form-textarea form-input--full"
                    value={projRef}
                    onChange={(e) => setProjRef(e.target.value)}
                    rows={2}
                    placeholder="URL repo, stack, consignes de tests…"
                  />
                </div>
              </div>
            ) : null}
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
            <h3 className="panel__title">Gérer les projets</h3>
          </div>
        </div>
        <div className="panel__body">
          <label className="form-label">Projet</label>
          <select
            className="form-select form-input--full"
            value={editProjectId}
            onChange={(e) => setEditProjectId(e.target.value)}
          >
            <option value="">— Choisir un projet —</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>
                {p.title} (N{p.niveau})
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!editProjectId}
            onClick={() => openEditProject(editProjectId)}
          >
            Modifier / supprimer
          </button>
        </div>
      </section>

      <Modal
        isOpen={projectEditOpen}
        title="Modifier un projet"
        onClose={() => setProjectEditOpen(false)}
      >
        {feedback.text && (
          <div className={`feedback${feedback.ok ? " feedback--ok" : " feedback--err"}`}>
            {feedback.text}
          </div>
        )}
        <form onSubmit={handleUpdateProject}>
          <div className="form-row form-row--2">
            <div className="form-field">
              <label className="form-label">Titre</label>
              <input
                className="form-input form-input--full"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
            </div>
            <div className="form-field form-field--span">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea form-input--full"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
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
                value={editNiveau}
                onChange={(e) => setEditNiveau(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label">Nombre max d’équipes</label>
              <input
                className="form-input form-input--full"
                type="number"
                min={1}
                value={editMax}
                onChange={(e) => setEditMax(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label">Date limite de soumission (optionnel)</label>
              <input
                className="form-input form-input--full"
                type="datetime-local"
                value={editDeadline}
                onChange={(e) => setEditDeadline(e.target.value)}
              />
            </div>
          </div>
          <label className="form-label">Cahier des charges — résumé (optionnel)</label>
          <textarea
            className="form-textarea form-input--full"
            value={editCahier}
            onChange={(e) => setEditCahier(e.target.value)}
            rows={2}
          />
          <label className="form-label">Remplacer le fichier CDC (optionnel)</label>
          <input
            ref={editCdcFileRef}
            className="form-input form-input--file form-input--full"
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md,.odt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
          />
          <label className="check-row" style={{ marginTop: 10 }}>
            <input
              type="checkbox"
              className="check-row__input"
              checked={removeCdc}
              onChange={(e) => setRemoveCdc(e.target.checked)}
            />
            <span>Supprimer le fichier CDC actuel</span>
          </label>
          <p className="diagram-item__meta" style={{ marginTop: 14 }}>
            <strong>Docker-compose</strong> (obligatoire par projet)&nbsp;:{" "}
            {editProjectRecord?.composeFileStoredName ? (
              <>
                fichier actuel — <strong>{editProjectRecord.composeFileOriginalName || "docker-compose.yml"}</strong>.
              </>
            ) : (
              <>
                aucun fichier enregistré — <strong>vous devez en joindre un</strong> (.yml ou .yaml).
              </>
            )}
          </p>
          <label className="form-label">Remplacer docker-compose (.yml / .yaml)</label>
          <input
            ref={editComposeFileRef}
            className="form-input form-input--file form-input--full"
            type="file"
            accept=".yml,.yaml,text/yaml,application/x-yaml"
          />
          <div className="form-row form-row--2" style={{ marginTop: 12 }}>
            <div className="form-field">
              <label className="form-label">Type de référence</label>
              <select
                className="form-select form-input--full"
                value={editRefKind}
                onChange={(e) => setEditRefKind(e.target.value)}
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
                value={editRef}
                onChange={(e) => setEditRef(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <div className="form-row form-row--2" style={{ marginTop: 12 }}>
            <button type="submit" className="btn btn-primary">
              Enregistrer
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleDeleteProject}
            >
              Supprimer
            </button>
          </div>
        </form>
      </Modal>

      <section className="panel panel--wide">
        <div className="panel__head">
          <span className="panel__step">4</span>
          <div>
            <h3 className="panel__title">Équipes</h3>
            <p className="diagram-item__meta" style={{ marginTop: 4 }}>
              Seuls les étudiants avec un <strong>compte GitHub renseigné</strong> (étape&nbsp;1) peuvent être
              ajoutés. Chaque équipe choisit son projet ; vous validez pour débloquer le niveau suivant — pas
              d’affectation manuelle.
            </p>
          </div>
        </div>
        <form className="panel__body" onSubmit={handleCreateTeam}>
          <label className="form-label">Nom de l’équipe</label>
          <input
            className="form-input form-input--full"
            placeholder="Ex. Équipe Alpha, Binôme 2…"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            maxLength={120}
            required
          />
          <label className="form-label">Membres (sans équipe, GitHub obligatoire)</label>
          <div className="student-list-box">
            {studentsEligibleForTeam.length === 0 ? (
              <p className="panel__empty">
                Aucun étudiant disponible sans équipe : soit tous sont déjà affectés, soit certains n’ont pas
                encore de compte GitHub renseigné (voir étape&nbsp;1).
              </p>
            ) : (
              studentsEligibleForTeam.map((s) => {
                const sid = s._id?.toString?.() ?? s._id;
                return (
                  <label key={sid} className="check-row">
                    <input
                      type="checkbox"
                      className="check-row__input"
                      checked={teamStudentIds.includes(sid)}
                      onChange={() => toggleTeamStudent(sid)}
                    />
                    <span>
                      {s.name}{" "}
                      <span className="check-row__muted">
                        ({s.email}) · @{String(s.githubUsername || "").trim()}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>

          {teamStudentIds.length > 0 ? (
            <div style={{ marginTop: 16 }}>
              <label className="form-label">Responsable de l’équipe</label>
              <p className="diagram-item__meta" style={{ marginTop: 0, marginBottom: 8 }}>
                Cette personne représente l’équipe (choix de projet, coordination). Obligatoire.
              </p>
              <div className="student-list-box">
                {studentList
                  .filter((s) => {
                    const sid = s._id?.toString?.() ?? s._id;
                    return teamStudentIds.includes(sid);
                  })
                  .map((s) => {
                    const sid = s._id?.toString?.() ?? s._id;
                    return (
                      <label key={`leader-${sid}`} className="check-row">
                        <input
                          type="radio"
                          name="teamLeader"
                          className="check-row__input"
                          checked={teamLeaderId === sid}
                          onChange={() => setTeamLeaderId(sid)}
                          required
                        />
                        <span>
                          {s.name}{" "}
                          <span className="check-row__muted">({s.email})</span>
                        </span>
                      </label>
                    );
                  })}
              </div>
            </div>
          ) : null}

          <button type="submit" className="btn btn-primary" style={{ marginTop: 16 }}>
            Créer l’équipe
          </button>
        </form>

        {teams.length > 0 ? (
          <div style={{ marginTop: 16, padding: "0 1.25rem 1.25rem" }}>
            <h4 className="form-label">Équipes existantes</h4>
            <ul className="diagram-item__meta" style={{ paddingLeft: 0, listStyle: "none" }}>
              {teams.map((t) => (
                <li
                  key={t._id}
                  style={{
                    marginBottom: 10,
                    padding: 10,
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                  }}
                >
                  <strong>{t.name}</strong>
                  <span>
                    {" "}
                    — {(t.students || []).length} membre{(t.students || []).length > 1 ? "s" : ""}
                  </span>
                  {t.leader ? (
                    <p className="diagram-item__meta" style={{ marginTop: 6, marginBottom: 0 }}>
                      Responsable :{" "}
                      <strong>{t.leader.name || t.leader.email || "—"}</strong>
                    </p>
                  ) : (
                    <p className="diagram-item__meta" style={{ marginTop: 6, marginBottom: 0 }}>
                      Responsable : <em>non désigné</em>
                    </p>
                  )}
                  <div style={{ marginTop: 6 }}>
                    {(t.students || []).map((s) => {
                      const isLeader =
                        t.leader &&
                        String(t.leader._id || t.leader) === String(s._id);
                      return (
                        <span
                          key={s._id}
                          className="meta-chip"
                          style={{
                            marginRight: 6,
                            borderColor: isLeader ? "#0d9488" : undefined,
                          }}
                          title={isLeader ? "Responsable de l’équipe" : undefined}
                        >
                          {s.name || s.email}
                          {isLeader ? " · responsable" : ""}
                        </span>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ marginTop: 8 }}
                    onClick={() => handleDeleteTeam(t._id)}
                  >
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
