const mongoose = require('mongoose');

const approvedPartnerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String },
    address: { type: String },
    contactEmail: { type: String },
    contactPhone: { type: String },
    district: { type: String },
    state: { type: String },
    pincode: { type: String },
    responsible: {
      name: String,
      age: Number,
      sex: String,
      dob: String,
    },
    council: {
      name: String,
      number: String,
    },
    passportPhoto: { type: String },
    certificateFile: { type: String },
    clinicPhotos: { type: [String], default: [] },
    membersServed: { type: Number, default: 0 },
    // keep createdAt/updatedAt
  },
  { timestamps: true }
);

module.exports = mongoose.model('ApprovedPartner', approvedPartnerSchema);
