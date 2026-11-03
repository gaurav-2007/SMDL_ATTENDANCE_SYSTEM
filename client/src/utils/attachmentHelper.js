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
 * Downloads an attachment to local device storage.
 * Works seamlessly across web browsers and mobile WebViews without forcing open share sheets.
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

    try {
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
      toast.success(`Downloaded ${fileName}`)
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

  try {
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success(`Downloading ${fileName}...`)
  } catch (err) {
    window.open(url, '_blank')
  }
}

/**
 * Shares an attachment directly to WhatsApp or native device share sheet.
 * Supported on mobile phones (Android/iOS) and web.
 */
export async function shareAttachmentWhatsApp(attachment, title = 'Notice Attachment') {
  if (!attachment) return

  const fileName = attachment.file_name || 'Notice_Attachment'
  const url = attachment.file_url

  // 1. Try Native Share API with File (Supported on mobile Android WebView / Safari)
  if (url && url.startsWith('data:') && typeof navigator !== 'undefined' && navigator.canShare && navigator.share) {
    try {
      const blob = dataUrlToBlob(url)
      if (blob) {
        const file = new File([blob], fileName, { type: blob.type })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: title,
            text: `*${title}*\nAttached: ${fileName}\nSMDL Attendance System`,
          })
          toast.success('Shared successfully!')
          return
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      console.warn('[attachmentHelper] Native file share cancelled/failed, falling back to WhatsApp link:', err.message)
    }
  }

  // 2. Direct WhatsApp Web / App intent
  const message = `*${title}*\nAttachment: ${fileName}\nFrom SMDL College Attendance Portal`
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`
  window.open(whatsappUrl, '_blank')
  toast.success('Opening WhatsApp...')
}

/**
 * Opens an attachment (PDF, image, document) safely across web and native Android platforms.
 */
export async function openAttachment(url, fileName = 'document') {
  if (!url) return

  if (url.startsWith('data:')) {
    await downloadAttachment(url, fileName)
    return
  }

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
