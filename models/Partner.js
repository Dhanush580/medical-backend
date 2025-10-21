const mongoose = require('mongoose');

const partnerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String },
    address: { type: String },
    contactEmail: { type: String },
    contactPhone: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
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
    specialization: { type: String },
    timings: { type: String },
    timeFrom: { type: String },
    timeTo: { type: String },
    dayFrom: { type: String },
    dayTo: { type: String },
    passportPhoto: { type: String },
    certificateFile: { type: String },
    clinicPhotos: { type: [String], default: [] },
    discountAmount: { type: String, required: true },
    discountItems: { type: [String], required: true },
  rejectionReason: { type: String },
  membersServed: { type: Number, default: 0 },
  status: { type: String, enum: ['Pending', 'Active', 'Inactive', 'Rejected'], default: 'Pending' },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Hash password before saving
partnerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const bcrypt = require('bcryptjs');
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
partnerSchema.methods.comparePassword = async function (candidatePassword) {
  const bcrypt = require('bcryptjs');
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Partner', partnerSchema);
