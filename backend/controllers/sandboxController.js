import {
  runSubmissionSandbox,
  stopSubmissionSandbox,
  refreshSubmissionSandboxLinks,
} from "../services/submissionSandboxService.js";

export const runSubmissionInSandbox = async (req, res) => {
  try {
    const { submissionId } = req.body || {};
    if (!submissionId) return res.status(400).json({ message: "submissionId requis" });

    const out = await runSubmissionSandbox(submissionId);
    if (out.error && !out.result) {
      return res.status(400).json({ message: out.error });
    }
    res.json({
      message: out.ok
        ? "Exécution Docker Compose terminée"
        : "Exécution Docker Compose terminée avec erreurs",
      result: out.result,
      ok: out.ok,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const refreshSubmissionSandboxLinksRun = async (req, res) => {
  try {
    const { submissionId } = req.body || {};
    if (!submissionId) return res.status(400).json({ message: "submissionId requis" });

    const out = await refreshSubmissionSandboxLinks(submissionId);
    if (!out.ok) return res.status(400).json({ message: out.message });
    res.json({
      message: out.message,
      accessLinks: out.accessLinks,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || "Impossible de récupérer les liens." });
  }
};

export const stopSubmissionSandboxRun = async (req, res) => {
  try {
    const { submissionId } = req.body || {};
    if (!submissionId) return res.status(400).json({ message: "submissionId requis" });

    const out = await stopSubmissionSandbox(submissionId);
    if (!out.ok) {
      return res.status(400).json({ message: out.message });
    }
    res.json({ message: out.message, projectName: out.projectName });
  } catch (error) {
    res.status(500).json({ message: error.message || "Impossible d’arrêter le sandbox." });
  }
};
