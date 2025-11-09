import mongoose from 'mongoose';

/**
 * Store shop policies, FAQs, and training data for AI
 */
const PolicySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['shipping', 'return', 'payment', 'warranty', 'faq', 'about'],
      required: true,
    },
    title: { type: String, required: true },
    content: { type: String, required: true },
    order: { type: Number, default: 0 }, // For sorting
    isActive: { type: Boolean, default: true },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

PolicySchema.index({ type: 1, isActive: 1, order: 1 });

export default mongoose.model('Policy', PolicySchema);
