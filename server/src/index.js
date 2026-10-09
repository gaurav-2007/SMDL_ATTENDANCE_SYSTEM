const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const academicRoutes = require('./routes/academicRoutes');
const lectureRoutes = require('./routes/lectureRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { initLectureScheduler } = require('./services/lectureScheduler');
const { initSelfieCleanupJob } = require('./services/selfieCleanupJob');

const helmet = require('helmet');
const hpp = require('hpp');
const sanitizeInput = require('./middleware/sanitizer');
const { globalApiLimiter } = require('./middleware/rateLimiter');

const app = express();

// 1. Remove technology footprint
app.disable('x-powered-by');

// 2. HTTP Security Headers (Anti-Clickjacking, NoSniff, XSS Protection, HSTS)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: { action: 'deny' },
    xssFilter: true,
    noSniff: true,
    hsts:
      env.NODE_ENV === 'production'
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
  })
);

// 3. Strict Production CORS configuration
const allowedOrigins = (env.CLIENT_URL || '')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, curl, same-origin)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin === 'https://localhost' ||
        origin === 'capacitor://localhost' ||
        (env.NODE_ENV !== 'production' && /^https?:\/\/localhost(:\d+)?$/.test(origin)) ||
        /^https?:\/\/172\.16\.\d+\.\d+(:\d+)?$/.test(origin) ||
        /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin) ||
        /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy violation: Origin '${origin}' is not authorized.`));
    },
    credentials: true,
  })
);

// 4. Scoped High-Payload Parser for Attendance Photos (up to 15MB)
app.use(
  '/api/attendance/mark',
  express.json({ limit: '15mb' }),
  express.urlencoded({ extended: true, limit: '15mb' })
);

// 5. Hardened Global Body Limit for all standard routes (Max 100KB to prevent DoS)
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// 6. HTTP Parameter Pollution Protection
app.use(hpp());

// 7. Input Sanitization against XSS & dangerous control characters
app.use(sanitizeInput);

// Global Request Logger for debugging mobile connections
app.use((req, res, next) => {
  console.log(`📡 [REQ] ${new Date().toLocaleTimeString()} ${req.method} ${req.url} from ${req.ip} origin: ${req.headers.origin || 'none'}`);
  next();
});

// 8. Global API Rate Limiter
app.use('/api', globalApiLimiter);
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/lectures', lectureRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/notifications', notificationRoutes);

// Initialize atomic lecture reminder scheduler (runs every minute in Asia/Kolkata timezone)
initLectureScheduler();

// Initialize 48-hour attendance selfie retention cleanup job (runs hourly)
initSelfieCleanupJob();

// Direct alias for Section 3: GET /student/today-classes & /api/student/today-classes
const protect = require('./middleware/auth');
const { getStudentTodayClasses } = require('./controllers/lectureController');
app.get('/api/student/today-classes', protect, getStudentTodayClasses);
app.get('/student/today-classes', protect, getStudentTodayClasses);


app.get('/', (_req, res) => {
  res.json({
    success: true,
    name: 'SMDL College Smart Attendance & Communication System',
    version: '1.0.0',
    docs: '/api/health',
  });
});

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`\n🚀 SMDL Attendance Server running on http://localhost:${env.PORT}`);
    console.log(`📱 Mobile/LAN Network URL: http://172.16.225.19:${env.PORT}`);
    console.log(`🌍 Environment: ${env.NODE_ENV}`);
    console.log(`🔗 Client URL: ${env.CLIENT_URL}\n`);
  });
}

module.exports = app;
