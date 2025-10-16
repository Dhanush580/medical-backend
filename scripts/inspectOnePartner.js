const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Partner = require('../models/Partner');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return console.error('MONGODB_URI not set');
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  const p = await Partner.findOne({ status: 'Pending' }).lean();
  if (!p) {
    console.log('No pending partner found');
    await mongoose.disconnect();
    return;
  }
  console.log('Partner id:', p._id);
  console.log('passportPhoto:', p.passportPhoto);
  console.log('certificateFile:', p.certificateFile);
  console.log('clinicPhotos:', p.clinicPhotos);
  console.log('full partner doc:', JSON.stringify(p, null, 2));
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
