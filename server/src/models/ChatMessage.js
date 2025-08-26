import mongoose from "mongoose";

const ChatMessageSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    from: { type: String, enum: ["user", "bot"], required: true },
    text: { type: String, required: true },
    intents: [String],
    confidence: { type: Number, default: 0 },
    suggestedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }]
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model("ChatMessage", ChatMessageSchema);
