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

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Serve uploaded files (e.g. partner uploads) as static assets
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/payments', paymentRoutes);

app.get('/', (req, res) => res.send({ ok: true, message: 'Medico Backend Running' }));

// Connect DB and start server
if (process.env.MONGODB_URI) {
  connectDB(process.env.MONGODB_URI);
} else {
  console.warn('MONGODB_URI not set. Server will run but DB operations will fail until a valid URI is provided.');
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
