import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

/**
 * Opens an attachment (PDF, image, document) safely across web and native Android platforms.
 * On native Android: Opens via in-app Chrome Custom Tab allowing native Android download manager to save the file.
 * On Web: Opens in new tab or initiates direct browser download.
 */
export async function openAttachment(url) {
  if (!url) return

  if (Capacitor.isNativePlatform()) {
    try {
      await Browser.open({ url, presentationStyle: 'popover' })
      return
    } catch (err) {
      console.warn('[attachmentHelper] Capacitor Browser failed, falling back to window.open:', err.message)
    }
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}
