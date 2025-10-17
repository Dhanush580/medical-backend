const ContactQuery = require('../models/ContactQuery');

// Submit contact form
exports.submitContactForm = async (req, res) => {
  try {
    const { name, email, userType, subject, message } = req.body;

    // Basic validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const contactQuery = new ContactQuery({
      name,
      email,
      userType: userType || 'general',
      subject,
      message
    });

    await contactQuery.save();

    res.status(201).json({
      message: 'Your message has been sent successfully. We will get back to you within 24 hours.',
      queryId: contactQuery._id
    });
  } catch (err) {
    console.error('Contact form submission error:', err);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};

// Get all contact queries (Admin only)
exports.getAllQueries = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status; // pending, in-progress, resolved, closed
    const userType = req.query.userType;

    let filter = {};
    if (status) filter.status = status;
    if (userType) filter.userType = userType;

    const queries = await ContactQuery.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .populate('respondedBy', 'name email');

    const total = await ContactQuery.countDocuments(filter);

    res.json({
      queries,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalQueries: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error('Get queries error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get single query details
exports.getQueryById = async (req, res) => {
  try {
    const query = await ContactQuery.findById(req.params.id)
      .populate('respondedBy', 'name email');

    if (!query) {
      return res.status(404).json({ message: 'Query not found' });
    }

    res.json(query);
  } catch (err) {
    console.error('Get query error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update query status and add response
exports.updateQuery = async (req, res) => {
  try {
    const { status, adminResponse } = req.body;
    const adminId = req.adminId; // From auth middleware

    const updateData = { status };
    if (adminResponse) {
      updateData.adminResponse = adminResponse;
      updateData.respondedAt = new Date();
      updateData.respondedBy = adminId;
    }

    const query = await ContactQuery.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('respondedBy', 'name email');

    if (!query) {
      return res.status(404).json({ message: 'Query not found' });
    }

    res.json({
      message: 'Query updated successfully',
      query
    });
  } catch (err) {
    console.error('Update query error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get query statistics
exports.getQueryStats = async (req, res) => {
  try {
    const stats = await ContactQuery.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalQueries = await ContactQuery.countDocuments();
    const pendingQueries = await ContactQuery.countDocuments({ status: 'pending' });
    const resolvedToday = await ContactQuery.countDocuments({
      status: 'resolved',
      respondedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    res.json({
      totalQueries,
      pendingQueries,
      resolvedToday,
      statusBreakdown: stats
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete query (Admin only)
exports.deleteQuery = async (req, res) => {
  try {
    const query = await ContactQuery.findByIdAndDelete(req.params.id);

    if (!query) {
      return res.status(404).json({ message: 'Query not found' });
    }

    res.json({ message: 'Query deleted successfully' });
  } catch (err) {
    console.error('Delete query error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};