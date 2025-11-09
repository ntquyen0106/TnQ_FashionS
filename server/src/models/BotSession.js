import mongoose from "mongoose";

const BotSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    sessionId: { type: String, required: true, index: true, unique: true },
    channel: { type: String, default: "web" },
    status: { 
      type: String, 
      enum: ['active', 'waiting_staff', 'with_staff', 'resolved'], 
      default: 'active' 
    },
    aiEnabled: { type: Boolean, default: true },
    assignedStaffId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lastIntent: String,
    context: { type: Map, of: mongoose.Schema.Types.Mixed },
    customerInfo: {
      name: String,
      email: String,
      phone: String,
    },
    lastMessageAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.model("BotSession", BotSessionSchema);
