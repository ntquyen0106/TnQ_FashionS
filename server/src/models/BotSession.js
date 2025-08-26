import mongoose from "mongoose";

const BotSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    sessionId: { type: String, required: true, index: true }, // guest id
    channel: { type: String, default: "web" },
    lastIntent: String,
    context: { type: Map, of: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

export default mongoose.model("BotSession", BotSessionSchema);
