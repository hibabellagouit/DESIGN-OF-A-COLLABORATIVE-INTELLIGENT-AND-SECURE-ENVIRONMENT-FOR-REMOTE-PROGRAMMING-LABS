import Team from "../models/Team.js";
import Student from "../models/Student.js";
import { populateTeam } from "../utils/teamPopulate.js";
import { studentHasGithubUsername } from "../utils/studentGithub.js";

export const listTeams = async (_req, res) => {
  try {
    const teams = await populateTeam(Team.find().sort({ name: 1 }));
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createTeam = async (req, res) => {
  try {
    const { name: rawName, studentIds, leaderId } = req.body || {};
    const name = String(rawName || "").trim().slice(0, 120);
    if (!name) {
      return res.status(400).json({ message: "Nom d’équipe requis" });
    }
    const ids = Array.isArray(studentIds) ? studentIds.filter(Boolean).map(String) : [];
    if (ids.length === 0) {
      return res.status(400).json({ message: "Ajoutez au moins un étudiant à l’équipe" });
    }
    const leader = leaderId ? String(leaderId) : "";
    if (!leader) {
      return res.status(400).json({ message: "Désignez le responsable de l’équipe." });
    }
    if (!ids.includes(leader)) {
      return res.status(400).json({
        message: "Le responsable doit faire partie des membres sélectionnés.",
      });
    }

    const alreadyInTeam = await Student.findOne({
      _id: { $in: ids },
      team: { $ne: null },
    }).select("name email");
    if (alreadyInTeam) {
      return res.status(400).json({
        message: `${alreadyInTeam.name || alreadyInTeam.email} appartient déjà à une autre équipe.`,
      });
    }

    const members = await Student.find({ _id: { $in: ids } }).select("name email githubUsername");
    if (members.length !== ids.length) {
      return res.status(400).json({ message: "Un ou plusieurs étudiants sont introuvables." });
    }
    for (const m of members) {
      if (!studentHasGithubUsername(m)) {
        return res.status(400).json({
          message: `${m.name || m.email || "Un étudiant"} doit avoir un identifiant GitHub renseigné avant d’intégrer une équipe.`,
        });
      }
    }

    const team = await Team.create({ name, students: ids, leader });
    await Student.updateMany({ _id: { $in: ids } }, { $set: { team: team._id } });

    const populated = await populateTeam(Team.findById(team._id));
    res.status(201).json({ message: "Équipe créée", team: populated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const team = await Team.findById(id);
    if (!team) return res.status(404).json({ message: "Équipe introuvable" });

    await Student.updateMany({ team: id }, { $set: { team: null } });
    await Team.findByIdAndDelete(id);
    res.json({ message: "Équipe supprimée" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
