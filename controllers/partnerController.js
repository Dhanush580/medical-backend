const Partner = require('../models/Partner');
const ApprovedPartner = require('../models/ApprovedPartner');
const Visit = require('../models/Visit');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

// Helper function to get MIME type from file extension
const getMimeType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  return mimeTypes[ext] || 'application/octet-stream';
};

exports.verifyMembership = async (req, res) => {
  try {
    const { membershipId } = req.body;
    const user = await User.findOne({ membershipId });
    if (!user) return res.status(404).json({ valid: false, message: 'Membership not found' });

    // return basic membership info
    // All members get 10% discount at partner facilities
    const discount = '10%';
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
      .populate('partner', 'name type address responsible')
      .sort({ createdAt: -1 })
      .limit(10);

    const formattedVisits = visits.map(visit => ({
      id: visit._id,
      hospitalName: visit.partner?.name || 'Unknown Hospital',
      doctorName: visit.partner?.responsible?.name || 'Not specified',
      address: visit.partner?.address || 'Address not available',
      visitedTime: visit.createdAt.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      service: visit.service || 'General Consultation'
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
    const { q, type, state, district, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Build search query
    let query = { status: 'Active' };

    if (q && q.trim()) {
      query.$or = [
        { name: { $regex: q.trim(), $options: 'i' } },
        { clinicName: { $regex: q.trim(), $options: 'i' } },
        { specialization: { $regex: q.trim(), $options: 'i' } },
        { address: { $regex: q.trim(), $options: 'i' } }
      ];
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    if (state) {
      query.state = { $regex: `^${state.trim()}$`, $options: 'i' };
    }

    if (district) {
      query.district = { $regex: `^${district.trim()}$`, $options: 'i' };
    }

    // Get total count for pagination
    const totalPartners = await Partner.countDocuments(query);

    // Get paginated results
    const partners = await Partner.find(query)
      .select('name type clinicName specialization address state district contactPhone contactEmail discountAmount discountItems timings timeFrom timeTo dayFrom dayTo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalPartners / limit);

    res.json({
      partners,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalPartners,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
        limit: parseInt(limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: list pending partner applications
exports.listApplications = async (req, res) => {
  try {
    const apps = await Partner.find({ status: 'Pending' }).sort({ createdAt: -1 }).limit(200);

    // Convert file paths to base64 data URLs for reliable image display
    const processedApps = await Promise.all(apps.map(async (app) => {
      const appObj = app.toObject();

      // Convert passport photo
      if (appObj.passportPhoto) {
        try {
          const filePath = path.join(__dirname, '..', appObj.passportPhoto);
          if (fs.existsSync(filePath)) {
            const fileBuffer = fs.readFileSync(filePath);
            const mimeType = getMimeType(filePath);
            appObj.passportPhoto = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
          }
        } catch (error) {
          console.error('Error converting passport photo:', error);
          appObj.passportPhoto = null;
        }
      }

      // Convert certificate file
      if (appObj.certificateFile) {
        try {
          const filePath = path.join(__dirname, '..', appObj.certificateFile);
          if (fs.existsSync(filePath)) {
            const fileBuffer = fs.readFileSync(filePath);
            const mimeType = getMimeType(filePath);
            appObj.certificateFile = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
          }
        } catch (error) {
          console.error('Error converting certificate file:', error);
          appObj.certificateFile = null;
        }
      }

      // Convert clinic photos
      if (appObj.clinicPhotos && Array.isArray(appObj.clinicPhotos)) {
        appObj.clinicPhotos = await Promise.all(appObj.clinicPhotos.map(async (photoPath) => {
          try {
            const filePath = path.join(__dirname, '..', photoPath);
            if (fs.existsSync(filePath)) {
              const fileBuffer = fs.readFileSync(filePath);
              const mimeType = getMimeType(filePath);
              return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
            }
            return null;
          } catch (error) {
            console.error('Error converting clinic photo:', error);
            return null;
          }
        }));
      }

      return appObj;
    }));

    res.json(processedApps);
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

    // Use a single timestamp for all files in this request to avoid mismatches
    const timestamp = Date.now();

    // passportPhoto
    if (files.passportPhoto && files.passportPhoto.length > 0) {
      const f = files.passportPhoto[0];
      const dest = path.join(uploadsBase, `passport_${timestamp}_${f.originalname}`);
      fs.writeFileSync(dest, f.buffer);
      // Store path relative to uploads directory for proper static serving
      partner.passportPhoto = `uploads/partners/${partner._id}/passport_${timestamp}_${f.originalname}`;
    }

    // certificateFile
    if (files.certificateFile && files.certificateFile.length > 0) {
      const f = files.certificateFile[0];
      const dest = path.join(uploadsBase, `certificate_${timestamp}_${f.originalname}`);
      fs.writeFileSync(dest, f.buffer);
      // Store path relative to uploads directory for proper static serving
      partner.certificateFile = `uploads/partners/${partner._id}/certificate_${timestamp}_${f.originalname}`;
    }

    // clinicPhotos (multiple)
    if (files.clinicPhotos && files.clinicPhotos.length > 0) {
      partner.clinicPhotos = [];
      files.clinicPhotos.forEach((f, index) => {
        const dest = path.join(uploadsBase, `clinic_${timestamp}_${index}_${f.originalname}`);
        fs.writeFileSync(dest, f.buffer);
        // Store path relative to uploads directory for proper static serving
        partner.clinicPhotos.push(`uploads/partners/${partner._id}/clinic_${timestamp}_${index}_${f.originalname}`);
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

exports.getPartnerVisits = async (req, res) => {
  try {
    // Get partner from JWT token
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const partnerId = decoded.id;

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalVisits = await Visit.countDocuments({ partner: partnerId });

    const visits = await Visit.find({ partner: partnerId })
      .populate('user', 'name membershipId email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const formattedVisits = visits.map(visit => ({
      id: visit._id,
      memberName: visit.user?.name || 'Unknown Member',
      membershipId: visit.user?.membershipId || 'N/A',
      email: visit.user?.email || 'N/A',
      phone: visit.user?.phone || 'N/A',
      service: visit.service || 'General Service',
      discount: `${visit.discountApplied}%`,
      savedAmount: visit.savedAmount || 0,
      date: visit.createdAt.toLocaleDateString('en-IN'),
      time: visit.createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    }));

    const totalPages = Math.ceil(totalVisits / limit);

    res.json({
      visits: formattedVisits,
      pagination: {
        currentPage: page,
        totalPages,
        totalVisits,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

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

// Get all users with pagination (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';

    let filter = {};
    if (search) {
      filter = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { membershipId: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const users = await User.find(filter)
      .select('name email membershipId plan validUntil createdAt')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      users,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    });
  } catch (err) {
    console.error('Get all users error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all active partners with pagination (Admin only) - ALL ACTIVE PARTNERS
exports.getAllPartners = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';

    let filter = { status: 'Active' }; // Only show active partners
    if (search) {
      filter = {
        status: 'Active',
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { clinicName: { $regex: search, $options: 'i' } },
          { facilityType: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const partners = await Partner.find(filter)
      .select('name email clinicName facilityType address contactPhone contactEmail membersServed status createdAt')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await Partner.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.json({
      partners,
      pagination: {
        currentPage: page,
        totalPages,
        totalPartners: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        limit
      }
    });
  } catch (err) {
    console.error('Get all partners error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete partner (Admin only)
exports.deletePartner = async (req, res) => {
  try {
    const partner = await Partner.findByIdAndDelete(req.params.id);

    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }

    res.json({ message: 'Partner deleted successfully' });
  } catch (err) {
    console.error('Delete partner error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete user (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
