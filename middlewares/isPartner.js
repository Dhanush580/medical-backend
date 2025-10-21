const jwt = require('jsonwebtoken');
const Partner = require('../models/Partner');

module.exports = async function (req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'partner') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if partner exists and is active
    const partner = await Partner.findById(decoded.id);
    if (!partner || partner.status !== 'Active') {
      return res.status(403).json({ message: 'Account not approved or inactive' });
    }

    req.partnerId = decoded.id;
    req.partner = partner;
    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ message: 'Invalid token' });
  }
};