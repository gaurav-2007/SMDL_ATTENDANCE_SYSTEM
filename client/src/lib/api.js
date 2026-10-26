import axios from 'axios'
import { Capacitor } from '@capacitor/core'

export const getBaseURL = () => {
  const custom = typeof window !== 'undefined' ? localStorage.getItem('smdl_api_url') : null
  if (custom) return custom
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  if (Capacitor.isNativePlatform()) {
    return 'http://10.75.38.19:5000/api'
  }
  return '/api'
}

export const setCustomApiUrl = (url) => {
  if (!url) {
    localStorage.removeItem('smdl_api_url')
  } else {
    let clean = url.trim().replace(/\/+$/, '')
    if (!clean.endsWith('/api')) clean += '/api'
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `http://${clean}`
    }
    localStorage.setItem('smdl_api_url', clean)
  }
}

const api = axios.create({
  baseURL: getBaseURL(),
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// Automatically attach JWT token & dynamically resolve active baseURL
api.interceptors.request.use((config) => {
  config.baseURL = getBaseURL()
  const token = localStorage.getItem('smdl_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
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
