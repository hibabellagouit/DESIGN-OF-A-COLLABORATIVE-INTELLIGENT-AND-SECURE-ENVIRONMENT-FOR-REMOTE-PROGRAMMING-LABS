import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../apiBase";
import { authHeaders } from "../authStorage";
import { emitToast } from "../toastBus";

const StudentWorkspaceContext = createContext(null);

function readStudentId() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}")?.student?._id || "";
  } catch {
    return "";
  }
}

export function StudentWorkspaceProvider({ children }) {
  const [assignments, setAssignments] = useState([]);
  const [selectableProjects, setSelectableProjects] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionFeedback, setActionFeedback] = useState({ ok: true, text: "" });
  const [selecting, setSelecting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState({ ok: true, text: "" });
  /** Fichiers du projet (multi-sélection ou dossier) */
  const [submissionFiles, setSubmissionFiles] = useState([]);
  const [submissionMode, setSubmissionMode] = useState("file");
  const [submissionGithubUrl, setSubmissionGithubUrl] = useState("");
  const [submissionHistoryTick, setSubmissionHistoryTick] = useState(0);

  const studentId = readStudentId();

  const reload = useCallback(async () => {
    if (!studentId) {
      setLoading(false);
      setError("Session invalide");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [assignmentData, selectionData] = await Promise.all([
        fetch(`${API_BASE}/api/assignments/student/${studentId}`, {
          headers: authHeaders(),
        }).then((res) => {
          if (!res.ok) throw new Error("Impossible de charger vos projets");
          return res.json();
        }),
        fetch(`${API_BASE}/api/assignments/student/${studentId}/selectable-projects`, {
          headers: authHeaders(),
        }).then((res) => {
          if (!res.ok) throw new Error("Impossible de charger le schéma des niveaux");
          return res.json();
        }),
      ]);
      setAssignments(assignmentData);
      setSelectableProjects(selectionData.projects || []);
      setCurrentLevel(selectionData.currentLevel || 1);
    } catch (e) {
      setError(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const activeAssignment = useMemo(
    () => assignments.find((a) => a.status === "en cours"),
    [assignments]
  );

  const chooseProject = useCallback(
    async (projectId) => {
      setActionFeedback({ ok: true, text: "" });
      setSelecting(true);
      try {
        if (!studentId) throw new Error("Session invalide");
        const res = await fetch(`${API_BASE}/api/assignments/student/select-project`, {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ studentId, projectId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error);
        setActionFeedback({
          ok: true,
          text: "Projet sélectionné. Terminez-le pour débloquer le niveau suivant.",
        });
        emitToast({
          title: "Projet choisi",
          message: "Projet enregistré. Terminez-le pour débloquer le niveau suivant.",
        });
        await reload();
        setSubmissionFiles([]);
      } catch (err) {
        setActionFeedback({ ok: false, text: err.message });
        emitToast({ title: "Choix impossible", message: err.message, variant: "error" });
      } finally {
        setSelecting(false);
      }
    },
    [studentId, reload]
  );

  const submitWork = useCallback(async () => {
    setUploadFeedback({ ok: true, text: "" });
    try {
      const current = assignments.find((a) => a.status === "en cours");
      if (!current?._id) throw new Error("Aucun projet en cours");
      if (submissionMode === "file" && !submissionFiles.length) {
        throw new Error("Choisissez au moins un fichier, ou tout un dossier de projet.");
      }
      if (submissionMode === "github" && !String(submissionGithubUrl || "").trim()) {
        throw new Error("Collez l’URL https de votre dépôt GitHub");
      }
      setUploading(true);
      const assignmentId = String(current._id);
      let res;
      if (submissionMode === "github") {
        res = await fetch(`${API_BASE}/api/submissions`, {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            assignmentId,
            githubUrl: String(submissionGithubUrl).trim(),
          }),
        });
      } else {
        const fd = new FormData();
        fd.append("assignmentId", assignmentId);
        if (submissionFiles.length > 120) {
          throw new Error("Maximum 120 fichiers par envoi.");
        }
        for (const f of submissionFiles) {
          const rel = (f.webkitRelativePath || f.name || "fichier").replace(/\\/g, "/");
          fd.append("files", f, rel);
        }
        res = await fetch(`${API_BASE}/api/submissions`, {
          method: "POST",
          headers: authHeaders(),
          body: fd,
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Erreur soumission");
      setUploadFeedback({ ok: true, text: "Soumission envoyée ✅" });
      emitToast({
        title: "Soumission",
        message:
          submissionMode === "github"
            ? "Lien GitHub enregistré."
            : submissionFiles.length > 1
              ? `${submissionFiles.length} fichiers envoyés.`
              : "Fichier envoyé avec succès.",
      });
      setSubmissionFiles([]);
      setSubmissionGithubUrl("");
      setSubmissionHistoryTick((t) => t + 1);
    } catch (err) {
      setUploadFeedback({ ok: false, text: err.message });
      emitToast({ title: "Soumission", message: err.message, variant: "error" });
    } finally {
      setUploading(false);
    }
  }, [assignments, submissionFiles, submissionMode, submissionGithubUrl]);

  const projectsByLevel = useMemo(
    () =>
      [1, 2, 3, 4, 5].map((level) => ({
        level,
        list: selectableProjects.filter((p) => Number(p.niveau) === level),
      })),
    [selectableProjects]
  );

  const activeProjectId = activeAssignment?.project?._id
    ? String(activeAssignment.project._id)
    : "";

  const value = {
    studentId,
    assignments,
    selectableProjects,
    currentLevel,
    loading,
    error,
    actionFeedback,
    selecting,
    uploading,
    uploadFeedback,
    submissionFiles,
    setSubmissionFiles,
    submissionMode,
    setSubmissionMode,
    submissionGithubUrl,
    setSubmissionGithubUrl,
    submissionHistoryTick,
    activeAssignment,
    activeProjectId,
    projectsByLevel,
    chooseProject,
    submitWork,
    reload,
  };

  return <StudentWorkspaceContext.Provider value={value}>{children}</StudentWorkspaceContext.Provider>;
}

export function useStudentWorkspace() {
  const ctx = useContext(StudentWorkspaceContext);
  if (!ctx) {
    throw new Error("useStudentWorkspace doit être utilisé sous StudentWorkspaceProvider");
  }
  return ctx;
}
