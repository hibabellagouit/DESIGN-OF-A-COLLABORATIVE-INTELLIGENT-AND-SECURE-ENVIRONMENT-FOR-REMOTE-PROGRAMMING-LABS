import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import Teacher from "../models/Teacher.js";

function toObjectIds(ids) {
  return (ids || [])
    .map((id) => {
      try {
        return new mongoose.Types.ObjectId(id);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export async function notifyStudents(studentIds, payload) {
  const { type, title, body = "", meta = {} } = payload;
  const oids = toObjectIds(studentIds);
  if (!oids.length) return;
  const docs = oids.map((recipientId) => ({
    recipientRole: "student",
    recipientId,
    type,
    title,
    body,
    meta,
    read: false,
  }));
  await Notification.insertMany(docs);
}

export async function notifyAllTeachers(payload) {
  const { type, title, body = "", meta = {} } = payload;
  const teachers = await Teacher.find().select("_id").lean();
  if (!teachers.length) return;
  const docs = teachers.map((t) => ({
    recipientRole: "teacher",
    recipientId: t._id,
    type,
    title,
    body,
    meta,
    read: false,
  }));
  await Notification.insertMany(docs);
}
