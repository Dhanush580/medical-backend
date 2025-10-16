const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    // Use a flexible name; we only seed an 'Annual' plan but keep name as string
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    price: { type: Number, required: true },
    durationInMonths: { type: Number, required: true },
    discountPercent: { type: Number, default: 0 },
    features: [{ type: String }],
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Plan', planSchema);
