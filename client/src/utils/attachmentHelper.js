import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import toast from 'react-hot-toast'

/**
 * Converts a data: URI (base64) to a Blob object.
 */
export function dataUrlToBlob(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return null
  }
  try {
    const parts = dataUrl.split(',')
    const mimeMatch = parts[0].match(/:(.*?);/)
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream'
    const byteCharacters = atob(parts[1])
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: mime })
  } catch (err) {
    console.warn('[attachmentHelper] Failed to convert data URL to Blob:', err.message)
    return null
  }
}

/**
 * Triggers a file download or native Android Share dialog for an attachment.
 * Works for both Base64 Data URLs and remote HTTP/HTTPS URLs.
 */
export async function downloadAttachment(url, fileName = 'attachment') {
  if (!url) {
    toast.error('No attachment URL available')
    return
  }

  // Case A: Base64 Data URL (images, documents, circulars)
  if (url.startsWith('data:')) {
    const blob = dataUrlToBlob(url)
    if (!blob) {
      toast.error('Unable to parse attachment data')
      return
    }

    // Try Native Share API first (supported by modern Android WebViews & mobile browsers)
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.share) {
      try {
        const file = new File([blob], fileName, { type: blob.type })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: fileName,
            text: `Attachment: ${fileName}`,
          })
          toast.success('Attachment saved / shared successfully!')
          return
        }
      } catch (shareErr) {
        if (shareErr.name === 'AbortError') {
          return // User cancelled share sheet
        }
        console.warn('[attachmentHelper] navigator.share error, falling back:', shareErr.message)
      }
    }

    // Standard DOM Blob anchor download fallback (Desktop & web)
    try {
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
      toast.success(`Downloading ${fileName}...`)
      return
    } catch (blobErr) {
      console.warn('[attachmentHelper] Blob download failed:', blobErr.message)
    }
  }

  // Case B: Remote HTTP / HTTPS URL
  if (Capacitor.isNativePlatform()) {
    try {
      await Browser.open({ url, presentationStyle: 'popover' })
      return
    } catch (err) {
      console.warn('[attachmentHelper] Capacitor Browser failed, falling back:', err.message)
    }
  }

  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/**
 * Opens an attachment (PDF, image, document) safely across web and native Android platforms.
 * Handles data: URLs smoothly without crashing Android Chrome Custom Tabs.
 */
export async function openAttachment(url, fileName = 'document') {
  if (!url) return

  // If it's a data URL, download / view via downloadAttachment
  if (url.startsWith('data:')) {
    await downloadAttachment(url, fileName)
    return
  }

  // If remote URL on native Android
  if (Capacitor.isNativePlatform()) {
    try {
      await Browser.open({ url, presentationStyle: 'popover' })
      return
    } catch (err) {
      console.warn('[attachmentHelper] Capacitor Browser failed, falling back:', err.message)
    }
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}
