import mongoose from 'mongoose';

const ChatMessageSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    from: { type: String, enum: ['user', 'bot', 'staff'], required: true },
    text: { type: String, required: true },
    intents: [String],
    confidence: { type: Number, default: 0 },
    suggestedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    staffName: { type: String },
    attachment: {
      url: { type: String },
      type: { type: String, enum: ['image', 'video'] },
      publicId: { type: String },
      width: { type: Number },
      height: { type: Number },
      duration: { type: Number }, // for videos
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export default mongoose.model('ChatMessage', ChatMessageSchema);
