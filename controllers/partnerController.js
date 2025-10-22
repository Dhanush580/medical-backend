const Partner = require('../models/Partner');
const ApprovedPartner = require('../models/ApprovedPartner');
const Visit = require('../models/Visit');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

exports.verifyMembership = async (req, res) => {
  try {
    const { membershipId } = req.body;
    const user = await User.findOne({ membershipId });
    if (!user) return res.status(404).json({ valid: false, message: 'Membership not found' });

    // return basic membership info
    // Compute discount: if familyMembers > 0 then 10% on total (as per new pricing), otherwise 0-10% base as configured
    const discount = user.familyMembers && user.familyMembers > 0 ? '10%' : '0%';
    res.json({
      valid: true,
      member: {
        name: user.name,
        membershipId: user.membershipId,
        plan: user.plan,
        familyMembers: user.familyMembers || 0,
        familyDetails: user.familyDetails || [],
        discount,
        validUntil: user.validUntil,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.recordVisit = async (req, res) => {
  try {
    const { membershipId, partnerId, service, discountApplied, savedAmount } = req.body;
    const user = await User.findOne({ membershipId });
    if (!user) return res.status(404).json({ message: 'Member not found' });

    const visit = new Visit({ user: user._id, partner: partnerId, service, discountApplied, savedAmount });
    await visit.save();

    // Increment the partner's membersServed count
    await Partner.findByIdAndUpdate(partnerId, { $inc: { membersServed: 1 } });

    res.status(201).json(visit);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getUserVisits = async (req, res) => {
  try {
    // Get user ID from auth middleware
    const userId = req.userId;

    const visits = await Visit.find({ user: userId })
      .populate('partner', 'name type address')
      .sort({ createdAt: -1 })
      .limit(10);

    const formattedVisits = visits.map(visit => ({
      id: visit._id,
      facility: visit.partner?.name || 'Unknown Facility',
      type: visit.partner?.type || 'Unknown',
      service: visit.service || 'General Consultation',
      date: visit.createdAt.toLocaleDateString('en-IN'),
      discount: visit.discountApplied ? `₹${visit.savedAmount || 0}` : '₹0',
      savedAmount: visit.savedAmount || 0
    }));

    res.json(formattedVisits);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getPartnerStats = async (req, res) => {
  try {
    // Get partner from JWT token
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const partnerId = decoded.id;

    const partner = await Partner.findById(partnerId);
    if (!partner) return res.status(404).json({ message: 'Partner not found' });

    // Get visit count for this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyVisits = await Visit.countDocuments({
      partner: partnerId,
      createdAt: { $gte: startOfMonth }
    });

    res.json({
      membersServed: partner.membersServed || 0,
      monthlyVisits,
      totalRevenue: 0, // This would need to be calculated from visits
      averageDiscount: '12.5%' // This could be calculated from visit data
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.listPartners = async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const state = (req.query.state || '').toString().trim();
    const district = (req.query.district || '').toString().trim();
    const type = (req.query.type || '').toString().trim();

    const filter = { status: 'Active' }; // Only show active partners

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { type: { $regex: q, $options: 'i' } },
        { address: { $regex: q, $options: 'i' } }
      ];
    }

    if (state) {
      filter.state = { $regex: state, $options: 'i' };
    }

    if (district) {
      filter.district = { $regex: district, $options: 'i' };
    }

    if (type && type !== 'all') {
      filter.type = type;
    }

    const partners = await Partner.find(filter).limit(100);
    res.json(partners);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: list pending partner applications
exports.listApplications = async (req, res) => {
  try {
    const apps = await Partner.find({ status: 'Pending' }).sort({ createdAt: -1 }).limit(200);
    res.json(apps);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: approve an application
exports.approveApplication = async (req, res) => {
  try {
    const id = req.params.id;
    const p = await Partner.findById(id);
    if (!p) return res.status(404).json({ message: 'Application not found' });

    // Simply update the status to 'Active' instead of moving to separate collection
    p.status = 'Active';
    await p.save();

    res.json({ message: 'Application approved successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: reject an application
exports.rejectApplication = async (req, res) => {
  try {
    const id = req.params.id;
    const reason = req.body.reason || '';
    const p = await Partner.findById(id);
    if (!p) return res.status(404).json({ message: 'Application not found' });

    // Delete uploaded files if present
    const uploadsRoot = path.join(__dirname, '..', 'uploads');
    const srcDir = path.join(uploadsRoot, 'partners', String(p._id));
    if (fs.existsSync(srcDir)) {
      try {
        fs.rmdirSync(srcDir, { recursive: true });
      } catch (e) {
        console.warn('Could not remove upload dir', srcDir, e.message);
      }
    }

    // Save a rejection record: set status and rejectionReason and keep record OR delete doc.
    // Here we will delete the application document entirely.
    await Partner.findByIdAndDelete(id);

    res.json({ message: 'Application rejected and removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Register a new partner (self-service)
exports.register = async (req, res) => {
  try {
    // Accept multipart/form-data: fields in req.body, files in req.files (multer memoryStorage)
    const {
      role,
      responsibleName,
      responsibleAge,
      responsibleSex,
      responsibleDOB,
      address,
      timings,
      website,
      contactEmail,
      contactPhone,
      email,
      password,
      councilName,
      councilNumber,
      state,
      district,
      pincode,
      clinicName,
      specialization,
      timeFrom,
      timeTo,
      dayFrom,
      dayTo,
      discountAmount,
      discountItems,
    } = req.body;

    if (!responsibleName || !contactEmail || !email || !password) return res.status(400).json({ message: 'Missing required fields' });

    const partner = new Partner({
      name: clinicName || responsibleName,
      type: role || 'partner',
      address,
      contactEmail,
      contactPhone,
      email,
      password,
      district,
      state,
      pincode,
      responsible: {
        name: responsibleName,
        age: responsibleAge ? Number(responsibleAge) : undefined,
        sex: responsibleSex,
        dob: responsibleDOB,
      },
      council: {
        name: councilName,
        number: councilNumber,
      },
      specialization,
      timings: timings || undefined,
      timeFrom: timeFrom || undefined,
      timeTo: timeTo || undefined,
      dayFrom: dayFrom || undefined,
      dayTo: dayTo || undefined,
      clinicName: clinicName || undefined,
      discountAmount,
      discountItems: discountItems ? JSON.parse(discountItems) : [],
    });

    await partner.save();

    // handle files: req.files contains buffers from multer memoryStorage
    const files = req.files || {};
    const fs = require('fs');
    const path = require('path');
    const uploadsBase = path.join(__dirname, '..', 'uploads', 'partners', String(partner._id));
    if (!fs.existsSync(uploadsBase)) fs.mkdirSync(uploadsBase, { recursive: true });

    // passportPhoto
    if (files.passportPhoto && files.passportPhoto.length > 0) {
      const f = files.passportPhoto[0];
      const dest = path.join(uploadsBase, `passport_${Date.now()}_${f.originalname}`);
      fs.writeFileSync(dest, f.buffer);
      partner.passportPhoto = path.relative(path.join(__dirname, '..'), dest).replace(/\\/g, '/');
    }

    // certificateFile
    if (files.certificateFile && files.certificateFile.length > 0) {
      const f = files.certificateFile[0];
      const dest = path.join(uploadsBase, `certificate_${Date.now()}_${f.originalname}`);
      fs.writeFileSync(dest, f.buffer);
      partner.certificateFile = path.relative(path.join(__dirname, '..'), dest).replace(/\\/g, '/');
    }

    // clinicPhotos (multiple)
    if (files.clinicPhotos && files.clinicPhotos.length > 0) {
      partner.clinicPhotos = [];
      files.clinicPhotos.forEach((f) => {
        const dest = path.join(uploadsBase, `clinic_${Date.now()}_${f.originalname}`);
        fs.writeFileSync(dest, f.buffer);
        partner.clinicPhotos.push(path.relative(path.join(__dirname, '..'), dest).replace(/\\/g, '/'));
      });
    }

    await partner.save();

    res.status(201).json({ message: 'Partner registered', partner });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: get dashboard stats
exports.getStats = async (req, res) => {
  try {
    const approvedPartnersCount = await Partner.countDocuments({ status: 'Active' });
    const totalUsersCount = await User.countDocuments();

    res.json({
      approvedPartners: approvedPartnersCount,
      totalUsers: totalUsersCount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: get recent members
exports.getRecentMembers = async (req, res) => {
  try {
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name plan familyMembers createdAt status');
    
    const formattedMembers = recentUsers.map(user => ({
      name: user.name,
      plan: user.plan + (user.familyMembers > 0 ? ` (${user.familyMembers} family)` : ''),
      date: user.createdAt.toISOString().split('T')[0],
      status: user.status
    }));
    
    res.json(formattedMembers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: get recent partners
exports.getRecentPartners = async (req, res) => {
  try {
    const recentPartners = await Partner.find({ status: 'Active' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name type membersServed createdAt');

    const formattedPartners = recentPartners.map(partner => ({
      name: partner.name,
      type: partner.type,
      members: partner.membersServed || 0,
      status: 'Active'
    }));

    res.json(formattedPartners);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};;

// Partner login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const partner = await Partner.findOne({ email, status: 'Active' });
    if (!partner) return res.status(401).json({ message: 'Invalid credentials or account not approved yet' });
    const match = await partner.comparePassword(password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: partner._id, email: partner.email, type: 'partner' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, partner: { id: partner._id, email: partner.email, name: partner.name, type: partner.type } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
