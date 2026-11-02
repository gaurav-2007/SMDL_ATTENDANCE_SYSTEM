import axios from 'axios'
import { Capacitor } from '@capacitor/core'

const isProd = Boolean(import.meta.env?.PROD)

/**
 * Normalizes an API base URL candidate.
 * Ensures scheme, valid format, and /api suffix while preventing duplicate /api/api.
 */
export const normalizeApiUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return null
  let trimmed = rawUrl.trim()
  if (!trimmed) return null

  // Reject unsupported schemes explicitly (e.g. ftp://, file://, javascript:)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return null
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `http://${trimmed}`
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.username || parsed.password) {
      return null
    }
    const protocol = parsed.protocol.toLowerCase()
    if (protocol !== 'http:' && protocol !== 'https:') {
      return null
    }

    let pathname = parsed.pathname.replace(/\/+$/, '')
    while (pathname.endsWith('/api/api')) {
      pathname = pathname.slice(0, -4)
    }
    if (!pathname.endsWith('/api')) {
      pathname = pathname ? `${pathname}/api` : '/api'
    }
    pathname = pathname.replace(/\/{2,}/g, '/')

    return `${protocol}//${parsed.host}${pathname}`
  } catch (_err) {
    return null
  }
}

/**
 * Checks if a hostname belongs to RFC 1918 private LAN or loopback ranges.
 */
export const isPrivateLanHost = (hostname) => {
  if (!hostname || typeof hostname !== 'string') return false
  const lower = hostname.toLowerCase()
  return (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '[::1]' ||
    lower === '::1' ||
    lower.startsWith('10.') ||
    lower.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(lower)
  )
}

// Backward-compatible alias
export const isDevPrivateHost = isPrivateLanHost

const configuredApiUrl = normalizeApiUrl(import.meta.env?.VITE_API_URL)
const configuredOrigin = configuredApiUrl ? new URL(configuredApiUrl).origin : null

/**
 * Checks whether a target URL is trusted to receive requests and Authorization headers (JWT tokens).
 * Protects against token exfiltration to unauthorized, external, or attacker-controlled hosts.
 */
export const isTrustedDestination = (uri) => {
  if (!uri || typeof uri !== 'string') return false

  // Relative paths (e.g., /api) are always same-origin and trusted (exclude protocol-relative //)
  if (uri.startsWith('/') && !uri.startsWith('//')) {
    return true
  }

  try {
    const activeUrl = getBaseURL()
    const activeOrigin = activeUrl ? new URL(activeUrl).origin : null
    const parsed = new URL(uri, activeOrigin || 'https://guard-fallback.invalid')

    // Rule 1: Matches the active configured baseURL origin
    if (activeOrigin && parsed.origin === activeOrigin) {
      if (parsed.protocol === 'https:') {
        return true
      }
      if (parsed.protocol === 'http:' && isPrivateLanHost(parsed.hostname)) {
        return true
      }
      return false
    }

    // Rule 2: Matches build-time configuredOrigin (VITE_API_URL)
    if (configuredOrigin && parsed.origin === configuredOrigin) {
      if (parsed.protocol === 'https:') {
        return true
      }
      if (!isProd && parsed.protocol === 'http:' && isPrivateLanHost(parsed.hostname)) {
        return true
      }
      return false
    }

    // Rule 3: Development mode web loopback
    if (!isProd && typeof window !== 'undefined' && !Capacitor.isNativePlatform()) {
      if (isPrivateLanHost(parsed.hostname)) {
        return true
      }
    }

    return false
  } catch (_e) {
    return false
  }
}

// Backward-compatible alias
export const isTrustedHost = isTrustedDestination

/**
 * Resolves the active API base URL.
 * User-configured custom URL takes highest precedence across all environments.
 */
export const getBaseURL = () => {
  // 1. Explicit user-configured URL from localStorage
  if (typeof localStorage !== 'undefined') {
    const custom = localStorage.getItem('smdl_api_url')
    if (custom) {
      const normalized = normalizeApiUrl(custom)
      if (normalized) return normalized
    }
  }

  // 2. Build-time configured VITE_API_URL
  if (configuredApiUrl) {
    return configuredApiUrl
  }

  // 3. Native Capacitor Android handling
  if (Capacitor.isNativePlatform()) {
    // Return empty string to signify unconfigured state (no fake missing-api-url.invalid)
    return ''
  }

  // 4. Web browser fallback (Vite proxy / reverse proxy)
  return '/api'
}

/**
 * Sets or clears a custom API URL.
 * Persists in localStorage across application restarts.
 */
export const setCustomApiUrl = (url) => {
  if (!url || typeof url !== 'string' || !url.trim()) {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('smdl_api_url')
    }
    return true
  }

  const normalized = normalizeApiUrl(url)
  if (!normalized) {
    return false
  }

  try {
    const parsed = new URL(normalized)
    // Public HTTP destinations are strictly forbidden
    if (parsed.protocol === 'http:' && !isPrivateLanHost(parsed.hostname)) {
      console.error('[SMDL Security] HTTP is only permitted for local private LAN / loopback destinations.')
      return false
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('smdl_api_url', normalized)
    }
    return true
  } catch (_e) {
    return false
  }
}

const api = axios.create({
  baseURL: getBaseURL(),
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// Automatically attach JWT token & dynamically resolve active baseURL
api.interceptors.request.use((config) => {
  const activeBase = getBaseURL()

  // On native Capacitor, if no server URL has been configured, reject cleanly with actionable message
  if (!activeBase && Capacitor.isNativePlatform()) {
    const unconfiguredMsg = 'Backend server URL is not configured. Please tap "Server" on the login screen to configure your server IP.'
    return Promise.reject(new Error(unconfiguredMsg))
  }

  // 1. Always enforce authoritative baseURL; never allow caller baseURL overrides
  config.baseURL = activeBase || '/api'

  // Helper for case-insensitive Authorization header removal
  const stripAuthorizationHeader = () => {
    if (config.headers) {
      if (typeof config.headers.delete === 'function') {
        config.headers.delete('Authorization')
        config.headers.delete('authorization')
      } else {
        for (const key of Object.keys(config.headers)) {
          if (key.toLowerCase() === 'authorization') {
            delete config.headers[key]
          }
        }
      }
    }
  }

  // 2. Resolve the effective destination using the installed Axios implementation
  let effectiveUri = ''
  try {
    effectiveUri = api.getUri(config)
  } catch (err) {
    stripAuthorizationHeader()
    const errorMsg = `[SMDL Security] Blocked API request: URL resolution failed (${err.message})`
    console.error(errorMsg)
    return Promise.reject(new Error(errorMsg))
  }

  // 3. Validate destination independently
  if (isTrustedDestination(effectiveUri)) {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('smdl_token') : null
    if (token) {
      if (config.headers && typeof config.headers.set === 'function') {
        config.headers.set('Authorization', `Bearer ${token}`)
      } else {
        if (!config.headers) config.headers = {}
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  }

  // 4. Destination is untrusted: strip Authorization header case-insensitively and reject
  stripAuthorizationHeader()
  const blockedMsg = `[SMDL Security] Blocked API request to untrusted destination: "${effectiveUri}"`
  console.error(blockedMsg)
  return Promise.reject(new Error(blockedMsg))
})

// Handle 401 globally → logout
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('smdl_token')
      localStorage.removeItem('smdl_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
