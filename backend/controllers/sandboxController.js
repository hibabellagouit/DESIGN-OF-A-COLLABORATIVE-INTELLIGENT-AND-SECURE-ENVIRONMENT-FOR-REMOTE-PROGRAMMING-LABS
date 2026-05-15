import fs from "fs";
import path from "path";
import Submission from "../models/Submission.js";
import { SUBMISSIONS_DIR } from "../middleware/submissionUpload.js";
import { runInSandbox } from "../services/dockerSandbox.js";

function resolveRunnableSubmissionFile(sub) {
  const entries = Array.isArray(sub.projectFiles) ? sub.projectFiles : [];
  const hasBundle = Boolean(sub.bundleId) && entries.length > 0;
  if (hasBundle) {
    const dir = path.join(SUBMISSIONS_DIR, "bundles", sub.bundleId);
    const ordered = [...entries].sort((a, b) =>
      String(a.relativePath || "").localeCompare(String(b.relativePath || ""))
    );
    const pick =
      ordered.find((p) => /\.py$/i.test(p.relativePath || p.storedName || "")) ||
      ordered.find((p) => /\.js$/i.test(p.relativePath || p.storedName || ""));
    if (pick?.storedName) {
      const fp = path.join(dir, pick.storedName);
      if (fs.existsSync(fp)) {
        return {
          inputFilePath: fp,
          inputFileOriginalName: pick.relativePath || pick.storedName,
        };
      }
    }
    return null;
  }
  if (sub.fileStoredName) {
    return {
      inputFilePath: path.join(SUBMISSIONS_DIR, sub.fileStoredName),
      inputFileOriginalName: sub.fileOriginalName,
    };
  }
  return null;
}

export const runSubmissionInSandbox = async (req, res) => {
  try {
    const { submissionId } = req.body || {};
    if (!submissionId) return res.status(400).json({ message: "submissionId requis" });

    const sub = await Submission.findById(submissionId);
    if (!sub) return res.status(404).json({ message: "Soumission introuvable" });

    if ((sub.kind || "file") === "github") {
      return res.status(400).json({
        message: "L’exécution sandbox ne s’applique pas à un lien GitHub.",
      });
    }

    const resolved = resolveRunnableSubmissionFile(sub);
    if (!resolved) {
      return res.status(400).json({
        message:
          "Aucun fichier .py ou .js exploitable trouvé dans cette soumission (déposez un tel fichier ou un projet qui en contient un).",
      });
    }

    const result = await runInSandbox({
      inputFilePath: resolved.inputFilePath,
      inputFileOriginalName: resolved.inputFileOriginalName,
    });

    res.json({
      message: "Sandbox run complete",
      result,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
