/*
 Simple script to create an admin user. Use only in development.
 Set environment variables ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, ADMIN_PHONE and MONGODB_URI before running.
 Example:
  node scripts/createAdmin.js
*/
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return console.error('MONGODB_URI not set');
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  const email = process.env.ADMIN_EMAIL || 'admin@local.test';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const name = process.env.ADMIN_NAME || 'Admin User';
  const phone = process.env.ADMIN_PHONE || '9999999999';

  let existing = await Admin.findOne({ email });
  if (existing) {
    console.log('Admin user already exists:', existing.email);
    process.exit(0);
  }

  const admin = new Admin({ name, email, phone, password });
  await admin.save();
  console.log('Created admin user:', email);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
