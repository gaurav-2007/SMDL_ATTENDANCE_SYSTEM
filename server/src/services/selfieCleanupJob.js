const cron = require('node-cron');
const { supabaseAdmin } = require('../config/db');
const { deleteSelfieObject } = require('./selfieStorageService');

let cleanupCronTask = null;
let isCleanupRunning = false;

/**
 * Executes a single run of the 48-hour attendance selfie retention cleanup.
 * Identifies expired selfies, deletes them from Supabase Storage, and clears
 * the database reference while leaving attendance records and status intact.
 */
async function runSelfieCleanup() {
  if (isCleanupRunning) {
    console.log('[SELFIE-CLEANUP] Previous cleanup run still in progress, skipping tick.');
    return { skipped: true };
  }

  isCleanupRunning = true;
  const nowUtc = new Date().toISOString();
  let found = 0;
  let deleted = 0;
  let alreadyMissing = 0;
  let failed = 0;

  try {
    // 1. Query records where selfie_expires_at is expired (or fallback on marked_at + 48h)
    let expiredRecords = [];

    // Attempt primary query with dedicated columns
    try {
      const { data: records, error } = await supabaseAdmin
        .from('attendance')
        .select('id, student_id, selfie_storage_path, selfie_expires_at, selfie_url, marked_at')
        .not('selfie_storage_path', 'is', null)
        .lte('selfie_expires_at', nowUtc);

      if (!error && records) {
        expiredRecords = records;
      }
    } catch (_colErr) {
      // Columns may not be migrated yet or error encountered
    }

    // Fallback: check selfie_url column for storage paths with marked_at > 48h ago
    try {
      const cutoffDate = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
      const { data: legacyRecords, error: legErr } = await supabaseAdmin
        .from('attendance')
        .select('id, student_id, selfie_url, marked_at')
        .not('selfie_url', 'is', null)
        .not('selfie_url', 'like', 'data:image%')
        .lte('marked_at', cutoffDate);

      if (!legErr && legacyRecords && legacyRecords.length > 0) {
        const seenIds = new Set(expiredRecords.map((r) => r.id));
        for (const lr of legacyRecords) {
          if (!seenIds.has(lr.id)) {
            expiredRecords.push(lr);
          }
        }
      }
    } catch (_e) {}

    found = expiredRecords.length;

    if (found === 0) {
      isCleanupRunning = false;
      return { found: 0, deleted: 0, alreadyMissing: 0, failed: 0 };
    }

    // 2. Process each expired record safely
    for (const record of expiredRecords) {
      const pathToDelete = record.selfie_storage_path || record.selfie_url;

      if (!pathToDelete || pathToDelete.startsWith('data:image')) {
        continue;
      }

      // Delete storage object from private bucket
      const { success, notFound, error: delErr } = await deleteSelfieObject(pathToDelete);

      if (success) {
        if (notFound) {
          alreadyMissing++;
        } else {
          deleted++;
        }

        // Clear DB selfie references (leaves status, marked_at, student_id, lecture_id untouched!)
        const updatePayload = {
          selfie_url: null,
        };

        // If schema has the new columns, clear them too
        if (record.selfie_storage_path !== undefined) {
          updatePayload.selfie_storage_path = null;
          updatePayload.selfie_uploaded_at = null;
          updatePayload.selfie_expires_at = null;
        }

        let { error: updateErr } = await supabaseAdmin
          .from('attendance')
          .update(updatePayload)
          .eq('id', record.id);

        if (updateErr && (updateErr.code === 'PGRST204' || updateErr.code === '42703' || updateErr.message?.includes('schema cache'))) {
          const fallbackRes = await supabaseAdmin
            .from('attendance')
            .update({ selfie_url: null })
            .eq('id', record.id);
          updateErr = fallbackRes.error;
        }

        if (updateErr) {
          console.warn(`[SELFIE-CLEANUP] Failed to clear DB selfie reference for record ${record.id}:`, updateErr.message);
        }
      } else {
        failed++;
        console.warn(`[SELFIE-CLEANUP] Storage deletion failed for record ${record.id}:`, delErr);
      }
    }

    // Operational log (strictly safe: no PII, no binary data, no tokens)
    console.log(`[SELFIE-CLEANUP] Found: ${found} | Deleted: ${deleted} | Already missing: ${alreadyMissing} | Failed: ${failed}`);
  } catch (err) {
    console.error('[SELFIE-CLEANUP] Unexpected error during cleanup execution:', err.message);
  } finally {
    isCleanupRunning = false;
  }

  return { found, deleted, alreadyMissing, failed };
}

/**
 * Initializes the automated server-side cleanup cron job.
 * Runs periodically (default: every hour at minute 0).
 */
function initSelfieCleanupJob(cronPattern = '0 * * * *') {
  if (cleanupCronTask) {
    return;
  }

  cleanupCronTask = cron.schedule(cronPattern, async () => {
    try {
      await runSelfieCleanup();
    } catch (err) {
      console.error('[SELFIE-CLEANUP] Cron tick error:', err.message);
    }
  });

  console.log(`⏱️ [SELFIE-CLEANUP] 48-Hour attendance selfie retention cleanup job initialized (${cronPattern}).`);
}

module.exports = {
  runSelfieCleanup,
  initSelfieCleanupJob,
};
