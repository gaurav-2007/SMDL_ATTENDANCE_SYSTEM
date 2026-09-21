const express = require('express');
const env = require('../config/env');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'SMDL Attendance Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: env.NODE_ENV,
    services: {
      database: env.SUPABASE_URL ? 'configured' : 'not configured',
      jwt: env.JWT_SECRET && env.JWT_SECRET !== 'dev_jwt_secret_change_me' ? 'configured' : 'using default (insecure)',
    },
  });
});

module.exports = router;
