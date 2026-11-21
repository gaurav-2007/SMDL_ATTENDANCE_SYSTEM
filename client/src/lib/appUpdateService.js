import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import api from './api';

const POSTPONE_KEY = 'smdl_update_postponed_until';

/**
 * Checks if a newer Android APK version is available on the server.
 * Completely safe and non-blocking: fails silently if network is offline.
 */
export async function checkForAppUpdate() {
  // Only check for updates when running inside the native Android APK
  if (!Capacitor.isNativePlatform()) {
    return { isUpdateAvailable: false, reason: 'web_platform' };
  }

  try {
    // 1. Get installed native package info
    const appInfo = await App.getInfo();
    const installedVersion = appInfo?.version || '1.0.0';
    const installedBuild = parseInt(appInfo?.build || '1', 10);

    // 2. Query backend version endpoint with short timeout (4s)
    const { data: res } = await api.get('/app/version', { timeout: 4000 });
    const remote = res?.data;

    if (!remote || !remote.latestVersionCode) {
      return { isUpdateAvailable: false, reason: 'no_remote_data' };
    }

    const latestBuild = parseInt(remote.latestVersionCode, 10);
    const minBuild = parseInt(remote.minSupportedVersionCode || '1', 10);
    const isMandatory = installedBuild < minBuild || remote.mandatory === true;
    const isUpdateAvailable = installedBuild < latestBuild;

    // 3. Check 24-hour postponement if not mandatory
    if (isUpdateAvailable && !isMandatory) {
      const postponedUntil = localStorage.getItem(POSTPONE_KEY);
      if (postponedUntil && Date.now() < parseInt(postponedUntil, 10)) {
        return { isUpdateAvailable: false, reason: 'postponed' };
      }
    }

    return {
      isUpdateAvailable,
      isMandatory,
      installedVersion,
      installedBuild,
      latestVersion: remote.latestVersion || 'Latest',
      latestBuild,
      releaseNotes: Array.isArray(remote.releaseNotes) ? remote.releaseNotes : [],
      downloadUrl: remote.downloadUrl,
      apkSizeMb: remote.apkSizeMb || 7.5,
      publishedAt: remote.publishedAt,
    };
  } catch (err) {
    console.warn('[appUpdateService] Version check notice:', err?.message || err);
    return { isUpdateAvailable: false, error: err?.message };
  }
}

/**
 * Snooze non-mandatory update notification for 24 hours
 */
export function postponeUpdate() {
  const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
  localStorage.setItem(POSTPONE_KEY, tomorrow.toString());
}

/**
 * Clear snoozed state (e.g. for manual check)
 */
export function clearPostponedUpdate() {
  localStorage.removeItem(POSTPONE_KEY);
}
