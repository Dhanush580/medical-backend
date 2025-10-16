const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner' },
    date: { type: Date, default: Date.now },
    service: { type: String },
    discountApplied: { type: Number, default: 0 },
    savedAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Visit', visitSchema);
