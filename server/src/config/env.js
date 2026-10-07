const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'];
const missing = required.filter((k) => !process.env[k]);

if (missing.length && process.env.NODE_ENV === 'production') {
  console.error(`🚨 [FATAL SECURITY ERROR] Missing required env vars in production: ${missing.join(', ')}`);
  process.exit(1);
}

if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET === 'dev_jwt_secret_change_me') {
  console.error(`🚨 [FATAL SECURITY ERROR] Cannot use default 'dev_jwt_secret_change_me' JWT_SECRET in production! Please generate a strong 256-bit secret.`);
  process.exit(1);
}

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  JWT_SECRET: process.env.JWT_SECRET || 'dev_jwt_secret_change_me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  // Email / SMTP configuration
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || '"SMDL College Smart Attendance" <noreply@smdl.ac.in>',
  // Attendance rate limiting
  ATTENDANCE_LIMIT_WINDOW_MS: parseInt(process.env.ATTENDANCE_LIMIT_WINDOW_MS || '60000', 10),
  ATTENDANCE_LIMIT_MAX: parseInt(process.env.ATTENDANCE_LIMIT_MAX || '10', 10),
  // Attendance selfie private storage & 48-hour retention
  ATTENDANCE_SELFIE_BUCKET: process.env.ATTENDANCE_SELFIE_BUCKET || 'attendance-selfies',
  ATTENDANCE_SELFIE_RETENTION_HOURS: (() => {
    const hours = parseInt(process.env.ATTENDANCE_SELFIE_RETENTION_HOURS || '48', 10);
    return isNaN(hours) || hours <= 0 ? 48 : hours;
  })(),
};
