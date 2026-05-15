import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipientRole: { type: String, enum: ["student", "teacher"], required: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    read: { type: Boolean, default: false, index: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientRole: 1, recipientId: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
