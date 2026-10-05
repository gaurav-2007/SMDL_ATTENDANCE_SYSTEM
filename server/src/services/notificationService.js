const { supabaseAdmin } = require('../config/db');
const { sendMulticastPush } = require('./fcmService');

// Fallback in-memory stores for resilience if migration tables are not yet run
const memoryDevices = new Map(); // key: userId, value: Set of { fcm_token, device_type, device_name }
const memoryPreferences = new Map(); // key: userId, value: preferences object

// Mandatory notification categories that cannot be disabled
const MANDATORY_CATEGORIES = new Set(['SECURITY_ALERT', 'PASSWORD_CHANGED', 'PASSWORD_RESET']);

/**
 * Resolve recipient user IDs for announcements based on target_type and target_id
 */
async function resolveAnnouncementRecipients(targetType, targetId) {
  try {
    if (targetType === 'ALL') {
      const { data } = await supabaseAdmin.from('users').select('id');
      return (data || []).map((u) => u.id);
    }
    if (targetType === 'STUDENT') {
      const { data } = await supabaseAdmin.from('students').select('user_id');
      return (data || []).map((s) => s.user_id).filter(Boolean);
    }
    if (targetType === 'TEACHER') {
      const { data } = await supabaseAdmin.from('teachers').select('user_id');
      return (data || []).map((t) => t.user_id).filter(Boolean);
    }
    if (targetType === 'COURSE' && targetId) {
      const { data } = await supabaseAdmin.from('students').select('user_id').eq('course_id', targetId);
      return (data || []).map((s) => s.user_id).filter(Boolean);
    }
    if (targetType === 'DIVISION' && targetId) {
      const { data } = await supabaseAdmin.from('students').select('user_id').eq('division_id', targetId);
      return (data || []).map((s) => s.user_id).filter(Boolean);
    }
  } catch (err) {
    console.error('[notificationService] Failed to resolve announcement recipients:', err.message);
  }
  return [];
}

/**
 * Checks whether user has enabled push notifications for a given category
 */
async function isPushAllowedForUser(userId, category) {
  if (MANDATORY_CATEGORIES.has(category)) return true;

  try {
    const { data: pref } = await supabaseAdmin
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (pref) {
      const mapping = {
        ANNOUNCEMENT: pref.announcements,
        LOW_ATTENDANCE: pref.low_attendance,
        LECTURE_STARTING: pref.lecture_reminders,
        LECTURE_CANCELLED: pref.lecture_reminders,
        LECTURE_RESCHEDULED: pref.lecture_reminders,
        ATTENDANCE_MARKED: pref.attendance_updates,
        ATTENDANCE_CORRECTED: pref.attendance_updates,
        ATTENDANCE_REMOVED: pref.attendance_updates,
        NEW_STUDY_MATERIAL: pref.study_material,
      };
      return mapping[category] !== false;
    }
  } catch (_e) {
    // If table not present, check memory store
    const memPref = memoryPreferences.get(userId);
    if (memPref) {
      const mapping = {
        ANNOUNCEMENT: memPref.announcements,
        LOW_ATTENDANCE: memPref.low_attendance,
        LECTURE_STARTING: memPref.lecture_reminders,
        LECTURE_CANCELLED: memPref.lecture_reminders,
        LECTURE_RESCHEDULED: memPref.lecture_reminders,
        ATTENDANCE_MARKED: memPref.attendance_updates,
        ATTENDANCE_CORRECTED: memPref.attendance_updates,
        ATTENDANCE_REMOVED: memPref.attendance_updates,
      };
      return mapping[category] !== false;
    }
  }

  // Default to true if no custom preferences set
  return true;
}

/**
 * Get active devices for users
 */
async function getActiveDevicesForUsers(userIds) {
  const devices = [];
  const uids = Array.isArray(userIds) ? userIds : [userIds];

  try {
    const { data: dbDevices } = await supabaseAdmin
      .from('user_devices')
      .select('fcm_token, device_type, device_name, user_id')
      .in('user_id', uids)
      .eq('is_active', true);

    if (dbDevices && dbDevices.length > 0) {
      devices.push(...dbDevices);
    }
  } catch (_e) {
    // Fallback to memory
    for (const uid of uids) {
      const devList = memoryDevices.get(uid);
      if (devList) {
        devices.push(...devList);
      }
    }
  }

  return devices;
}

/**
 * Central function to create an in-app notification and optionally dispatch FCM push
 * DATABASE-FIRST: Always writes to PostgreSQL first.
 */
async function createNotification({
  userId,
  type = 'SYSTEM',
  title,
  message,
  relatedId = null,
  relatedType = null,
  metadata = {},
  expiresAt = null,
}) {
  if (!userId || !title || !message) {
    console.warn('[notificationService] Missing required parameters for notification');
    return null;
  }

  // 1. IN-APP DATABASE INSERT FIRST
  let savedRecord = null;
  const insertPayload = {
    user_id: userId,
    title: title.trim(),
    message: message.trim(),
    is_read: false,
    created_at: new Date().toISOString(),
  };

  // Attempt insert with rich columns
  try {
    const { data: richRec, error: richErr } = await supabaseAdmin
      .from('notifications')
      .insert({
        ...insertPayload,
        type,
        related_id: relatedId,
        related_type: relatedType,
        metadata,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (!richErr && richRec) {
      savedRecord = richRec;
    } else {
      // Fallback if type/metadata columns are not yet created in Supabase
      const { data: baseRec } = await supabaseAdmin
        .from('notifications')
        .insert({
          ...insertPayload,
          message: `[TYPE:${type}] ${message.trim()}`,
        })
        .select()
        .single();
      savedRecord = baseRec || { ...insertPayload, id: 'mem_' + Date.now(), type, metadata };
    }
  } catch (err) {
    console.error('[notificationService] DB insert error:', err.message);
    savedRecord = { ...insertPayload, id: 'mem_' + Date.now(), type, metadata };
  }

  // 2. CHECK PREFERENCES FOR PUSH
  const pushAllowed = await isPushAllowedForUser(userId, type);
  if (!pushAllowed) {
    return savedRecord;
  }

  // 3. ASYNC FCM PUSH DELIVERY (Secondary channel; failures never affect in-app record)
  try {
    const devices = await getActiveDevicesForUsers([userId]);
    if (devices.length > 0) {
      sendMulticastPush(devices, {
        title,
        body: message,
        data: {
          notificationId: savedRecord?.id || '',
          relatedId: relatedId || '',
          relatedType: relatedType || '',
          ...metadata,
        },
        notificationType: type,
      }).catch((e) => console.warn('[notificationService] Push dispatch warning:', e.message));
    }
  } catch (pushErr) {
    console.warn('[notificationService] Non-blocking push warning:', pushErr.message);
  }

  return savedRecord;
}

/**
 * Bulk dispatch notification to multiple users
 */
async function sendToUsers(userIds, {
  type = 'SYSTEM',
  title,
  message,
  relatedId = null,
  relatedType = null,
  metadata = {},
}) {
  if (!Array.isArray(userIds) || userIds.length === 0) return [];

  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  const results = [];

  // Batch insert into notifications table
  const rows = uniqueUserIds.map((uid) => ({
    user_id: uid,
    title: title.trim(),
    message: message.trim(),
    type,
    related_id: relatedId,
    related_type: relatedType,
    metadata,
    is_read: false,
    created_at: new Date().toISOString(),
  }));

  try {
    const { data: inserted, error } = await supabaseAdmin
      .from('notifications')
      .insert(rows)
      .select();

    if (!error && inserted) {
      results.push(...inserted);
    } else {
      // Fallback one-by-one with basic columns
      for (const row of rows) {
        try {
          const { data } = await supabaseAdmin.from('notifications').insert({
            user_id: row.user_id,
            title: row.title,
            message: `[TYPE:${type}] ${row.message}`,
            is_read: false,
          }).select().single();
          if (data) results.push(data);
        } catch (_e) {}
      }
    }
  } catch (err) {
    console.error('[notificationService] Bulk insert error:', err.message);
  }

  // Secondary push delivery
  try {
    const devices = await getActiveDevicesForUsers(uniqueUserIds);
    if (devices.length > 0) {
      sendMulticastPush(devices, {
        title,
        body: message,
        data: {
          relatedId: relatedId || '',
          relatedType: relatedType || '',
          ...metadata,
        },
        notificationType: type,
      }).catch(() => {});
    }
  } catch (_e) {}

  return results;
}

/**
 * Register or update device token (Web & Android ready)
 */
async function registerDevice(userId, { fcmToken, deviceType = 'WEB', deviceName = 'Browser' }) {
  if (!userId || !fcmToken) {
    throw new Error('User ID and FCM token are required.');
  }

  const cleanType = ['WEB', 'ANDROID', 'IOS'].includes(deviceType?.toUpperCase())
    ? deviceType.toUpperCase()
    : 'WEB';

  try {
    const { data, error } = await supabaseAdmin
      .from('user_devices')
      .upsert(
        {
          user_id: userId,
          fcm_token: fcmToken,
          device_type: cleanType,
          device_name: deviceName || (cleanType === 'WEB' ? 'Browser' : 'Mobile App'),
          is_active: true,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id, fcm_token' }
      )
      .select()
      .single();

    if (!error && data) return data;
  } catch (_e) {
    // Fallback to memory
  }

  if (!memoryDevices.has(userId)) memoryDevices.set(userId, []);
  const list = memoryDevices.get(userId).filter((d) => d.fcm_token !== fcmToken);
  const dev = {
    user_id: userId,
    fcm_token: fcmToken,
    device_type: cleanType,
    device_name: deviceName,
    is_active: true,
  };
  list.push(dev);
  memoryDevices.set(userId, list);
  return dev;
}

/**
 * Unregister device token on logout
 */
async function unregisterDevice(userId, fcmToken) {
  if (!fcmToken) return;
  try {
    await supabaseAdmin
      .from('user_devices')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('fcm_token', fcmToken);
  } catch (_e) {
    if (memoryDevices.has(userId)) {
      const list = memoryDevices.get(userId).filter((d) => d.fcm_token !== fcmToken);
      memoryDevices.set(userId, list);
    }
  }
}

/**
 * Get user notification preferences
 */
async function getUserPreferences(userId) {
  const defaultPrefs = {
    announcements: true,
    low_attendance: true,
    lecture_reminders: true,
    attendance_updates: true,
    study_material: true,
    security_alerts: true, // locked
  };

  try {
    const { data } = await supabaseAdmin
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      return {
        ...defaultPrefs,
        ...data,
        security_alerts: true, // Always mandatory
      };
    }
  } catch (_e) {
    if (memoryPreferences.has(userId)) {
      return { ...defaultPrefs, ...memoryPreferences.get(userId), security_alerts: true };
    }
  }

  return defaultPrefs;
}

/**
 * Update user notification preferences
 */
async function updateUserPreferences(userId, prefs) {
  const current = await getUserPreferences(userId);
  const updated = {
    ...current,
    announcements: prefs.announcements !== undefined ? Boolean(prefs.announcements) : current.announcements,
    low_attendance: prefs.low_attendance !== undefined ? Boolean(prefs.low_attendance) : current.low_attendance,
    lecture_reminders: prefs.lecture_reminders !== undefined ? Boolean(prefs.lecture_reminders) : current.lecture_reminders,
    attendance_updates: prefs.attendance_updates !== undefined ? Boolean(prefs.attendance_updates) : current.attendance_updates,
    study_material: prefs.study_material !== undefined ? Boolean(prefs.study_material) : current.study_material,
    security_alerts: true, // Mandatory
    updated_at: new Date().toISOString(),
  };

  try {
    await supabaseAdmin
      .from('notification_preferences')
      .upsert({ user_id: userId, ...updated }, { onConflict: 'user_id' });
  } catch (_e) {
    memoryPreferences.set(userId, updated);
  }

  return updated;
}

module.exports = {
  createNotification,
  sendToUsers,
  resolveAnnouncementRecipients,
  registerDevice,
  unregisterDevice,
  getUserPreferences,
  updateUserPreferences,
  _memoryDevices: memoryDevices,
  _memoryPreferences: memoryPreferences,
};
