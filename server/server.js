require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const rateLimit = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/error');

const isProd = process.env.NODE_ENV === 'production';

/* ---------- Check the configuration before starting ---------- */
const missing = ['MONGO_URI', 'JWT_SECRET'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variable(s): ${missing.join(', ')}. See server/.env.example`);
  process.exit(1);
}
if (isProd && (process.env.JWT_SECRET.length < 24 || /change_this/i.test(process.env.JWT_SECRET))) {
  console.error('JWT_SECRET is too weak for production. Use a long random value (at least 24 characters).');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
// Render, Railway, Heroku etc. sit behind a proxy: needed for correct client IPs (rate limiting) and https URLs
app.set('trust proxy', 1);

/* ---------- Security headers ---------- */
const extraOrigins = (process.env.CLIENT_URL || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:'],
        'connect-src': ["'self'", ...extraOrigins],
        'worker-src': ["'self'", 'blob:'],
        'frame-ancestors': ["'none'"],
        // Hosting platforms already redirect to https; don't break plain-http local/LAN testing
        'upgrade-insecure-requests': null,
      },
    },
  })
);

/* ---------- CORS ----------
   Allowed: the addresses in CLIENT_URL (comma separated), plus the API's own address
   (when the API also serves the React app, everything is same-origin). */
const devOrigins = isProd ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173'];
app.use(
  cors((req, cb) => {
    const origin = req.header('Origin');
    const self = `${req.protocol}://${req.get('host')}`;
    const ok = !origin || origin === self || extraOrigins.includes(origin) || devOrigins.includes(origin);
    cb(null, { origin: ok, credentials: false });
  })
);

app.use(express.json({ limit: '2mb' }));

/* ---------- Request log (one line per request) ---------- */
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  const start = Date.now();
  res.on('finish', () => {
    if (isProd && res.statusCode < 400) return;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

/* ---------- Brute-force protection on sign-in related routes ---------- */
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: isProd ? 20 : 200, message: 'Too many attempts. Please wait a few minutes and try again.' });
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 600, message: 'Too many requests. Please slow down.', keyBy: (req) => req.ip }));

/* ---------- API ---------- */
const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];
app.get('/api/health', (req, res) => {
  const db = DB_STATES[mongoose.connection.readyState] || 'unknown';
  res.status(db === 'connected' ? 200 : 503).json({ status: db === 'connected' ? 'ok' : 'degraded', app: 'ClearPath API', db, uptime: Math.round(process.uptime()) });
});
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/clearances', require('./routes/clearanceRoutes'));
app.use('/api/dues', require('./routes/dueRoutes'));
app.use('/api/certificates', require('./routes/certificateRoutes'));
app.use('/api/verify', require('./routes/verifyRoutes'));
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/stats', require('./routes/statsRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/files', require('./routes/fileRoutes'));
app.use('/api/universities', require('./routes/universityRoutes'));
app.use('/api/platform', require('./routes/platformRoutes'));

// Files uploaded by older versions were stored on disk
const uploadDir = path.join(__dirname, 'uploads');
if (fs.existsSync(uploadDir)) app.use('/uploads', express.static(uploadDir, { maxAge: '1d' }));

app.use('/api', notFound);

/* ---------- The React app (production build) ----------
   After `npm run build` in /client, the API serves the app too: one service, one URL. */
const clientDist = path.resolve(__dirname, process.env.CLIENT_DIST || '../client/dist');
const serveClient = process.env.SERVE_CLIENT !== 'false' && fs.existsSync(path.join(clientDist, 'index.html'));
if (serveClient) {
  app.use(
    express.static(clientDist, {
      index: false,
      setHeaders: (res, file) => {
        // Hashed build files never change; index.html must always be fresh
        if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    })
  );
  // Any other address (e.g. /officer/requests after a refresh) gets the app, and React Router shows the page
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => res.json({ app: 'ClearPath API', health: '/api/health' }));
}

app.use(notFound);
app.use(errorHandler);

/* ---------- Start ---------- */
const PORT = process.env.PORT || 5000;
let server;
connectDB().then(async () => {
  await require('./utils/bootstrap')();
  server = app.listen(PORT, () => {
    console.log(`ClearPath API running on port ${PORT}${serveClient ? ' (also serving the web app)' : ''}`);
  });
});

// Finish open requests before stopping (hosting platforms send SIGTERM on redeploy)
const shutdown = (signal) => {
  console.log(`${signal} received, shutting down…`);
  const done = () => mongoose.connection.close(false).finally(() => process.exit(0));
  if (server) server.close(done);
  else done();
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => console.error('Unhandled promise rejection:', err));

module.exports = app;
