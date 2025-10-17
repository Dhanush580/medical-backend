const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const authMiddleware = require('../middlewares/auth');
const isAdminMiddleware = require('../middlewares/isAdmin');

// Public routes
router.post('/submit', contactController.submitContactForm);

// Admin routes (protected)
router.get('/queries', authMiddleware, isAdminMiddleware, contactController.getAllQueries);
router.get('/queries/:id', authMiddleware, isAdminMiddleware, contactController.getQueryById);
router.put('/queries/:id', authMiddleware, isAdminMiddleware, contactController.updateQuery);
router.delete('/queries/:id', authMiddleware, isAdminMiddleware, contactController.deleteQuery);
router.get('/stats', authMiddleware, isAdminMiddleware, contactController.getQueryStats);

module.exports = router;