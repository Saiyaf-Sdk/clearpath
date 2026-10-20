require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

// Make sure the uploads folder exists (payment receipts are stored here)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Security + parsing middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
  })
);
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadDir));

// Routes
app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'ClearPath API' }));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/clearances', require('./routes/clearanceRoutes'));
app.use('/api/dues', require('./routes/dueRoutes'));
app.use('/api/certificates', require('./routes/certificateRoutes'));
app.use('/api/verify', require('./routes/verifyRoutes'));
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/universities', require('./routes/universityRoutes'));
app.use('/api/platform', require('./routes/platformRoutes'));

// Errors
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  app.listen(PORT, () => console.log(`ClearPath API running on port ${PORT}`));
});

module.exports = app;
