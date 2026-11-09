const cron = require('node-cron');
const { supabaseAdmin } = require('../config/db');

let cleanupCronTask = null;
let isCleanupRunning = false;

/**
 * Deletes all notifications older than 24 hours from the database.
 * Leaves recent notifications (< 24 hours) completely intact.
 */
async function runNotificationCleanup() {
  if (isCleanupRunning) {
    console.log('⏰ [NOTIFICATION-CLEANUP] Previous cleanup run still in progress, skipping tick.');
    return { skipped: true };
  }

  isCleanupRunning = true;
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const { error, count } = await supabaseAdmin
      .from('notifications')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff24h);

    if (error) {
      console.error('❌ [NOTIFICATION-CLEANUP] Error deleting expired notifications:', error.message);
      return { success: false, error: error.message };
    }

    const deletedCount = count || 0;
    if (deletedCount > 0) {
      console.log(`🧹 [NOTIFICATION-CLEANUP] Successfully purged ${deletedCount} notification(s) older than 24 hours.`);
    } else {
      console.log('✨ [NOTIFICATION-CLEANUP] No expired notifications (> 24h) found. Database is clean.');
    }

    return { success: true, deleted: deletedCount };
  } catch (err) {
    console.error('❌ [NOTIFICATION-CLEANUP] Unexpected error during cleanup:', err.message);
    return { success: false, error: err.message };
  } finally {
    isCleanupRunning = false;
  }
}

/**
 * Initializes the automated 24-hour notification retention scheduler.
 * Runs once at startup (after a short 5-second stabilization delay),
 * and thereafter automatically at minute 0 of every hour (0 * * * *).
 */
function initNotificationCleanupJob() {
  if (cleanupCronTask) {
    console.log('⚠️ [NOTIFICATION-CLEANUP] Job already initialized.');
    return cleanupCronTask;
  }

  // 1. Run initial cleanup 5 seconds after server startup
  setTimeout(() => {
    runNotificationCleanup().catch((err) => {
      console.error('❌ [NOTIFICATION-CLEANUP] Startup cleanup run failed:', err.message);
    });
  }, 5000);

  // 2. Schedule recurring hourly job: minute 0 of every hour
  cleanupCronTask = cron.schedule('0 * * * *', async () => {
    console.log('⏰ [NOTIFICATION-CLEANUP] Triggering scheduled hourly 24-hour notification cleanup...');
    await runNotificationCleanup();
  });

  console.log('🛡️ [NOTIFICATION-CLEANUP] 24-Hour Notification Retention Scheduler initialized (Hourly: 0 * * * *).');
  return cleanupCronTask;
}

module.exports = {
  runNotificationCleanup,
  initNotificationCleanupJob,
};
