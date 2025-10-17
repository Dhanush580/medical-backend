const mongoose = require('mongoose');

const contactQuerySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true },
    userType: {
      type: String,
      required: true,
      enum: ['member', 'doctor', 'pharmacy', 'diagnostic', 'general'],
      default: 'general'
    },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'resolved', 'closed'],
      default: 'pending'
    },
    adminResponse: { type: String, default: '' },
    respondedAt: { type: Date },
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('ContactQuery', contactQuerySchema);