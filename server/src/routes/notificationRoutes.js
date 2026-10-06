const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getPreferences,
  updatePreferences,
  registerDeviceToken,
  unregisterDeviceToken,
  getFirebasePublicConfig,
} = require('../controllers/notificationController');

// Public route to retrieve public Web FCM client configuration (No server secrets)
router.get('/firebase-config', getFirebasePublicConfig);

// All notification routes below require authenticated JWT session
router.use(protect);

router.get('/', getNotifications);
router.patch('/:id/read', markAsRead);
router.post('/mark-all-read', markAllAsRead);

router.get('/preferences', getPreferences);
router.put('/preferences', updatePreferences);

router.post('/devices', registerDeviceToken);
router.delete('/devices', unregisterDeviceToken);

module.exports = router;
