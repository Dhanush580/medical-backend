const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/auth');

router.post('/register', authController.register);
router.post('/register-with-order', authController.registerWithOrder);
router.post('/login', authController.login);
router.post('/check-email', authController.checkEmail);
router.get('/me', authMiddleware, authController.me);

// Admin routes
router.post('/admin/register', authController.registerAdmin);
router.post('/admin/login', authController.loginAdmin);

module.exports = router;
