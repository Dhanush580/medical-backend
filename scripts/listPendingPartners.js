// List pending partner applications from MongoDB
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Partner = require('../models/Partner');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return console.error('MONGODB_URI not set in backend/.env');
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  const count = await Partner.countDocuments({ status: 'Pending' });
  console.log('Pending partners count:', count);
  if (count > 0) {
    const apps = await Partner.find({ status: 'Pending' }).sort({ createdAt: -1 }).limit(20).lean();
    apps.forEach((a, i) => {
      console.log(`${i+1}. ${a.name} | type: ${a.type} | email: ${a.contactEmail || 'N/A'} | phone: ${a.contactPhone || 'N/A'} | createdAt: ${a.createdAt}`);
    });
  }
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
