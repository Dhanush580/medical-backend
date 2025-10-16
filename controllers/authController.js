const jwt = require('jsonwebtoken');
const User = require('../models/User');

const createToken = (user, secret, expiresIn = '7d') => {
  return jwt.sign({ id: user._id, email: user.email, isAdmin: !!user.isAdmin }, secret, { expiresIn });
};

exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, plan, familyMembers, familyDetails } = req.body;

    // Basic validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already in use' });

  const members = Math.max(0, Number(familyMembers) || (Array.isArray(familyDetails) ? familyDetails.length : 0));
  const user = new User({ name, email, phone, password, plan, familyMembers: members, familyDetails: Array.isArray(familyDetails) ? familyDetails : [] });

  // Set validity: annual plan -> 1 year from now
  const now = new Date();
  user.validUntil = new Date(now.setFullYear(now.getFullYear() + 1));

    await user.save();

    const token = createToken(user, process.env.JWT_SECRET);

    res.status(201).json({ token, user: { id: user._id, email: user.email, name: user.name, membershipId: user.membershipId } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a Razorpay order for registration payment and return order details
exports.registerWithOrder = async (req, res) => {
  try {
  const { name, email, phone, password, plan, familyMembers, familyDetails } = req.body;
    // basic validation
    if (!name || !email || !phone || !password || !plan) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Decide amount based on plan (match frontend prices)
    // Single annual price is ₹365 per person per year. familyMembers is number of additional members.
  const basePrice = 365;
  const members = Math.max(0, Number(familyMembers) || (Array.isArray(familyDetails) ? familyDetails.length : 0));
  // total persons = 1 primary + additional family members
  const totalPersons = 1 + members;
    let amount = basePrice * totalPersons;
    // Apply 10% discount on total if any family members added
    if (members > 0) {
      amount = Math.round(amount * 0.9);
    }

    // create razorpay order using payment controller's instance
    const Razorpay = require('razorpay');
    const instance = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const order = await instance.orders.create({ amount: Math.round(amount * 100), currency: 'INR', receipt: `reg_${Date.now()}` });

    // Send back order info and the received form data for frontend to complete payment
  res.json({ order, tempUser: { name, email, phone, password, plan, familyMembers: members, familyDetails: Array.isArray(familyDetails) ? familyDetails : [] } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create registration order' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = createToken(user, process.env.JWT_SECRET);
    res.json({ token, user: { id: user._id, email: user.email, name: user.name, membershipId: user.membershipId } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin registration
exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Basic validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const Admin = require('../models/Admin');
    const existing = await Admin.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already in use' });

    const admin = new Admin({ name, email, phone, password });
    await admin.save();

    const token = createToken(admin, process.env.JWT_SECRET);
    res.status(201).json({ token, admin: { id: admin._id, email: admin.email, name: admin.name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin login
exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const Admin = require('../models/Admin');
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(401).json({ message: 'Invalid credentials' });
    const match = await admin.comparePassword(password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = createToken({ _id: admin._id, email: admin.email, isAdmin: true }, process.env.JWT_SECRET);
    res.json({ token, admin: { id: admin._id, email: admin.email, name: admin.name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
