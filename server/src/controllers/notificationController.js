const { supabaseAdmin } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const {
  registerDevice,
  unregisterDevice,
  getUserPreferences,
  updateUserPreferences,
} = require('../services/notificationService');

// @desc   Get paginated notifications and unread count for authenticated user
// @route  GET /api/notifications
const getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '20', 10);
  const filter = req.query.filter || 'all'; // 'all' or 'unread'

  const offset = (page - 1) * limit;

  // 1. Fetch unread count strictly for req.user.id
  let unreadCount = 0;
  try {
    const { count, error: countErr } = await supabaseAdmin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (!countErr && count !== null) {
      unreadCount = count;
    }
  } catch (_e) {}

  // 2. Fetch notifications
  let query = supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filter === 'unread') {
    query = query.eq('is_read', false);
  }

  const { data: notifications, error } = await query;

  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  // Parse type from legacy [TYPE:...] messages if type column was empty
  const parsed = (notifications || []).map((n) => {
    let cleanMsg = n.message || '';
    let extractedType = n.type || 'SYSTEM';

    const match = cleanMsg.match(/^\[TYPE:([A-Z_]+)\]\s*(.*)$/s);
    if (match) {
      extractedType = match[1];
      cleanMsg = match[2];
    }

    return {
      ...n,
      type: extractedType,
      message: cleanMsg,
    };
  });

  res.json({
    success: true,
    data: {
      notifications: parsed,
      unread_count: unreadCount,
      page,
      limit,
    },
  });
});

// @desc   Mark a single notification as read
// @route  PATCH /api/notifications/:id/read
const markAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const notificationId = req.params.id;

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId) // Security boundary: Can only update own notification
    .select()
    .single();

  if (error) {
    res.status(404);
    throw new Error('Notification not found or unauthorized');
  }

  res.json({
    success: true,
    message: 'Notification marked as read',
    data,
  });
});

// @desc   Mark all notifications as read for current user
// @route  POST /api/notifications/mark-all-read
const markAllAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    res.status(500);
    throw new Error(error.message);
  }

  res.json({
    success: true,
    message: 'All notifications marked as read',
  });
});

// @desc   Get user notification preferences
// @route  GET /api/notifications/preferences
const getPreferences = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const prefs = await getUserPreferences(userId);

  res.json({
    success: true,
    data: { preferences: prefs },
  });
});

// @desc   Update user notification preferences
// @route  PUT /api/notifications/preferences
const updatePreferences = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const updated = await updateUserPreferences(userId, req.body || {});

  res.json({
    success: true,
    message: 'Notification preferences updated successfully',
    data: { preferences: updated },
  });
});

// @desc   Register device FCM token (Web & Android ready)
// @route  POST /api/notifications/devices
const registerDeviceToken = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { fcm_token, device_type, device_name } = req.body;

  if (!fcm_token) {
    res.status(400);
    throw new Error('fcm_token is required');
  }

  const device = await registerDevice(userId, {
    fcmToken: fcm_token,
    deviceType: device_type || 'WEB',
    deviceName: device_name || 'Browser',
  });

  res.status(201).json({
    success: true,
    message: 'Device registered successfully for push notifications',
    data: { device },
  });
});

// @desc   Unregister device token on logout
// @route  DELETE /api/notifications/devices
const unregisterDeviceToken = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { fcm_token } = req.body;

  if (fcm_token) {
    await unregisterDevice(userId, fcm_token);
  }

  res.json({
    success: true,
    message: 'Device token unregistered successfully',
  });
});

// @desc   Get public Firebase Web client configuration (No private keys or server secrets)
// @route  GET /api/notifications/firebase-config
const getFirebasePublicConfig = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_WEB_API_KEY || '',
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_WEB_AUTH_DOMAIN || '',
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_WEB_STORAGE_BUCKET || '',
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_WEB_APP_ID || '',
      vapidKey: process.env.VITE_FIREBASE_VAPID_KEY || process.env.FIREBASE_VAPID_KEY || '',
    },
  });
});

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getPreferences,
  updatePreferences,
  registerDeviceToken,
  unregisterDeviceToken,
  getFirebasePublicConfig,
};
