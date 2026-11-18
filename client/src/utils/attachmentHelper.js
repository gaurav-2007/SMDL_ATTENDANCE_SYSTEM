import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
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
 * Helper to resolve raw base64 data and sanitized file name with correct extension.
 */
async function resolveBase64AndName(url, rawFileName = 'Notice_Attachment') {
  let safeName = String(rawFileName || 'Notice_Attachment')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .trim()

  let base64Data = null
  let mimeType = 'application/octet-stream'

  if (url && typeof url === 'string') {
    if (url.startsWith('data:')) {
      const match = url.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        mimeType = match[1]
        base64Data = match[2]
      } else {
        const parts = url.split(',')
        base64Data = parts[1] || parts[0]
      }
    } else if (/^https?:\/\//i.test(url)) {
      try {
        const res = await fetch(url)
        const blob = await res.blob()
        mimeType = blob.type || mimeType
        base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => {
            const result = reader.result
            if (typeof result === 'string') {
              resolve(result.includes(',') ? result.split(',')[1] : result)
            } else {
              resolve(null)
            }
          }
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
      } catch (fetchErr) {
        console.warn('[attachmentHelper] Failed to fetch remote file to base64:', fetchErr.message)
      }
    }
  }

  // Ensure appropriate extension if none exists
  if (!safeName.includes('.')) {
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) safeName += '.jpg'
    else if (mimeType.includes('png')) safeName += '.png'
    else if (mimeType.includes('webp')) safeName += '.webp'
    else if (mimeType.includes('pdf')) safeName += '.pdf'
    else safeName += '.bin'
  }

  return { base64Data, safeName, mimeType }
}

/**
 * Downloads an attachment to local device storage.
 * - On Mobile APK: Directly saves to device Documents/Downloads folder without opening the share sheet.
 * - On Laptop/Web: Downloads to browser Downloads folder.
 */
export async function downloadAttachment(url, fileName = 'attachment') {
  if (!url) {
    toast.error('No attachment URL available')
    return
  }

  // Case 1: Mobile Android Native Platform (Capacitor APK)
  if (Capacitor.isNativePlatform()) {
    try {
      const { base64Data, safeName } = await resolveBase64AndName(url, fileName)

      if (base64Data) {
        // Request storage permission if required on Android
        try {
          const perm = await Filesystem.checkPermissions()
          if (perm.publicStorage !== 'granted') {
            await Filesystem.requestPermissions()
          }
        } catch (_pErr) {}

        let saved = false

        // 1. Save directly into public Documents folder (accessible in phone file manager)
        try {
          await Filesystem.writeFile({
            path: safeName,
            data: base64Data,
            directory: Directory.Documents,
            recursive: true,
          })
          saved = true
        } catch (_docErr) {
          // 2. Fallback to app Data folder if Documents has permission restrictions
          try {
            await Filesystem.writeFile({
              path: safeName,
              data: base64Data,
              directory: Directory.Data,
              recursive: true,
            })
            saved = true
          } catch (_dataErr) {
            // 3. Fallback to Cache
            await Filesystem.writeFile({
              path: safeName,
              data: base64Data,
              directory: Directory.Cache,
              recursive: true,
            })
            saved = true
          }
        }

        if (saved) {
          toast.success(`📥 Downloaded! Saved to Documents: ${safeName}`, {
            duration: 4000,
          })
          return
        }
      }
    } catch (nativeErr) {
      console.warn('[attachmentHelper] Native direct download error:', nativeErr)
      toast.error(`Download failed: ${nativeErr.message || 'Storage error'}`)
      return
    }
  }

  // Case 2: Desktop / Laptop Web Browser (or web fallback)
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
      a.download = fileName || 'attachment'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
      toast.success(`Downloaded ${fileName || 'attachment'}`)
      return
    } catch (blobErr) {
      console.warn('[attachmentHelper] Blob download failed:', blobErr.message)
    }
  }

  // Case 3: Remote HTTP/HTTPS URL on Web Browser
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = fileName || 'attachment'
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success(`Downloading ${fileName}...`)
  } catch (_err) {
    window.open(url, '_blank')
  }
}

/**
 * Shares an attachment directly to WhatsApp or native device share sheet.
 * - On Mobile APK: Shares ONLY the photo / document file (without any text caption).
 * - On Laptop / Web: Opens WhatsApp Web with notice reference.
 */
export async function shareAttachmentWhatsApp(attachment, title = 'Notice Attachment') {
  if (!attachment) return

  const rawName = attachment.file_name || 'Notice_Attachment'
  const url = attachment.file_url

  // 1. Mobile Android APK (Capacitor Native Platform)
  if (Capacitor.isNativePlatform()) {
    try {
      const { base64Data, safeName } = await resolveBase64AndName(url, rawName)

      if (base64Data) {
        // Write file into Cache for FileProvider sharing
        const written = await Filesystem.writeFile({
          path: safeName,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true,
        })

        if (written?.uri) {
          // Shares ONLY the photo/document file into WhatsApp with NO text caption
          await Share.share({
            files: [written.uri],
            dialogTitle: 'Share to WhatsApp',
          })
          toast.success('Sharing photo...')
          return
        }
      }
    } catch (err) {
      if (err?.message?.includes('cancel') || err?.message?.includes('canceled')) {
        return
      }
      console.warn('[attachmentHelper] Native photo share error:', err.message)
    }

    // Direct WhatsApp fallback if share fails
    try {
      window.location.href = `whatsapp://send`
      return
    } catch (_wErr) {}
  }

  // 2. Desktop Web Browser / Laptop
  const message = `*${title}*\nAttachment: ${rawName}\nFrom SMDL College Attendance Portal`
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`

  window.open(whatsappUrl, '_blank')
  toast.success('Opening WhatsApp...')
}

/**
 * Opens an attachment (PDF, image, document) safely across web and native Android platforms.
 */
export async function openAttachment(url, fileName = 'document') {
  if (!url) return

  if (Capacitor.isNativePlatform()) {
    await downloadAttachment(url, fileName)
    return
  }

  if (url.startsWith('data:')) {
    const blob = dataUrlToBlob(url)
    if (blob) {
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, '_blank')
      return
    }
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}
