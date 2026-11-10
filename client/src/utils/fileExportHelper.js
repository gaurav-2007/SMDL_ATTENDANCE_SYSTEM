import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import toast from 'react-hot-toast'

/**
 * Saves and exports a file (CSV, HTML, PDF text, etc.) across Mobile APK & Desktop Web.
 * 
 * - On Mobile (Capacitor Android): Writes file to local storage and triggers the native
 *   Android Share/Save sheet so the user can immediately "Save to Downloads/Device",
 *   open in Excel / Google Sheets, or share via WhatsApp / Drive.
 * - On Desktop / Web Browser: Triggers standard direct browser download to the Downloads folder.
 * 
 * @param {Object} options
 * @param {string} options.content - The file text content (CSV string, HTML string, etc.)
 * @param {string} options.fileName - Target file name (e.g., 'SMDL_Attendance_Report.csv')
 * @param {string} options.mimeType - MIME type (e.g., 'text/csv;charset=utf-8;')
 * @param {string} options.dialogTitle - Android share dialog title
 * @param {string} [options.mobileSuccessMsg] - Optional custom toast message on mobile
 * @param {string} [options.webSuccessMsg] - Optional custom toast message on web
 */
export async function exportReportFile({
  content,
  fileName,
  mimeType = 'text/plain',
  dialogTitle = 'Download / Save Report',
  mobileSuccessMsg,
  webSuccessMsg,
}) {
  if (!content) {
    toast.error('No report data to export')
    return false
  }

  // 1. Mobile Android (Capacitor Native Platform)
  if (Capacitor.isNativePlatform()) {
    try {
      // 1.1 Write file to Cache directory (guaranteed URI accessible by Android FileProvider)
      const writtenFile = await Filesystem.writeFile({
        path: fileName,
        data: content,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
        recursive: true,
      })

      // 1.2 Also attempt to save a persistent copy in Documents directory
      try {
        await Filesystem.writeFile({
          path: fileName,
          data: content,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
          recursive: true,
        })
      } catch (_docErr) {
        // Non-blocking fallback
      }

      // 1.3 Open Native Android Share / Save Sheet
      if (writtenFile?.uri) {
        await Share.share({
          title: fileName,
          text: `SMDL College Official Report: ${fileName}`,
          url: writtenFile.uri,
          dialogTitle: dialogTitle,
        })
      }

      toast.success(
        mobileSuccessMsg || '📁 Report ready! Select "Save to device" or open directly in Excel/Sheets.',
        { duration: 4000 }
      )
      return true
    } catch (err) {
      if (err?.message?.includes('canceled') || err?.message?.includes('cancelled')) {
        // User closed the share sheet — silent return
        return true
      }
      console.warn('[fileExportHelper] Native export error:', err)
      toast.error(`Unable to save file: ${err.message || 'Storage error'}`)
      return false
    }
  }

  // 2. Desktop & Mobile Web Browser Fallback
  try {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 10000)

    toast.success(
      webSuccessMsg || '📥 Report downloaded! Check your browser Downloads folder.',
      { duration: 3500 }
    )
    return true
  } catch (err) {
    console.error('[fileExportHelper] Web download error:', err)
    toast.error('Failed to download report file.')
    return false
  }
}

