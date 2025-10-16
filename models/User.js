const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { isEmail } = require('validator');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, validate: [isEmail, 'Invalid email'] },
    phone: { type: String, required: true },
    password: { type: String, required: true },
  // Single plan model: 'annual'. Keep field for compatibility.
  plan: { type: String, enum: ['annual'], default: 'annual' },
    // Number of additional family members added (0 means single member)
    familyMembers: { type: Number, default: 0 },
    // Store details for each family member
    familyDetails: [
      {
        name: { type: String },
        age: { type: Number },
        gender: { type: String },
        relationship: { type: String },
      },
    ],
    membershipId: { type: String, unique: true },
    // Flag to indicate administrative user
    isAdmin: { type: Boolean, default: false },
    status: { type: String, enum: ['Active', 'Inactive', 'Expired'], default: 'Active' },
    validUntil: { type: Date },
    createdAt: { type: Date, default: Date.now },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  const user = this;
  if (!user.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate a simple membership id after creation
userSchema.post('save', async function (doc, next) {
  try {
    if (!doc.membershipId) {
      const membershipId = `HC-${new Date().getFullYear()}-${String(doc._id).slice(-6).toUpperCase()}`;
      // Use findByIdAndUpdate to avoid triggering another save hook on the same doc
      await mongoose.model('User').findByIdAndUpdate(doc._id, { membershipId }, { new: true, timestamps: false });
    }
  } catch (err) {
    console.error('Error setting membershipId:', err);
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
