require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const planRoutes = require('./routes/plans');
const partnerRoutes = require('./routes/partners');
const paymentRoutes = require('./routes/payments');
const contactRoutes = require('./routes/contact');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080', 'http://localhost:5000', 'https://medicostsaver.vercel.app', 'https://medical-backend-e4z1.onrender.com'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json());

// Serve uploaded files with CORS enabled for all origins (for file access) - kept for backward compatibility
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, path) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/contact', contactRoutes);

app.get('/', (req, res) => res.send({ ok: true, message: 'Medico Backend Running', timestamp: new Date().toISOString() }));

// Test endpoint
app.get('/api/test', (req, res) => res.json({ ok: true, message: 'API is working', timestamp: new Date().toISOString() }));

// Connect DB and start server
if (process.env.MONGODB_URI) {
  connectDB(process.env.MONGODB_URI);
} else {
  console.warn('MONGODB_URI not set. Server will run but DB operations will fail until a valid URI is provided.');
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
