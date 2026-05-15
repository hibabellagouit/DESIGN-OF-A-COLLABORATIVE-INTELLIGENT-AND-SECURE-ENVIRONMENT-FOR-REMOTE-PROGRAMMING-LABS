import mongoose from "mongoose";
import Notification from "../models/Notification.js";

function recipientQuery(req) {
  const role = req.user?.role;
  const id = req.user?.id;
  if (!role || !id || !["student", "teacher"].includes(role)) return null;
  let oid;
  try {
    oid = new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
  return { recipientRole: role, recipientId: oid };
}

export const listMine = async (req, res) => {
  try {
    const q = recipientQuery(req);
    if (!q) return res.status(401).json({ message: "Session invalide" });

    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const [items, unreadCount] = await Promise.all([
      Notification.find(q).sort({ createdAt: -1 }).limit(limit).lean(),
      Notification.countDocuments({ ...q, read: false }),
    ]);

    res.json({ items, unreadCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const markRead = async (req, res) => {
  try {
    const q = recipientQuery(req);
    if (!q) return res.status(401).json({ message: "Session invalide" });

    let nid;
    try {
      nid = new mongoose.Types.ObjectId(req.params.id);
    } catch {
      return res.status(400).json({ message: "Identifiant invalide" });
    }

    const n = await Notification.findOneAndUpdate(
      { _id: nid, ...q },
      { $set: { read: true } },
      { new: true }
    );
    if (!n) return res.status(404).json({ message: "Notification introuvable" });
    res.json({ message: "OK", notification: n });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const markAllRead = async (req, res) => {
  try {
    const q = recipientQuery(req);
    if (!q) return res.status(401).json({ message: "Session invalide" });

    const result = await Notification.updateMany({ ...q, read: false }, { $set: { read: true } });
    res.json({ message: "OK", modified: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
