const mongoose = require('mongoose');
require('dotenv').config();
const Plan = require('../models/Plan');

// Single annual plan: ₹365 per year. Family members are charged at ₹365 each and
// a 10% discount is applied to the total when any family members are added.
const plans = [
  {
    name: 'Annual',
    slug: 'annual',
    price: 365,
    durationInMonths: 12,
    discountPercent: 0,
    features: [
      'Access to partner hospitals nationwide',
      'Digital membership card',
      'Option to add family members (charged per person)',
      '10% discount on total when family members added',
    ],
  },
];

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    await Plan.deleteMany({});
    await Plan.insertMany(plans);
    console.log('Seeded plans');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
