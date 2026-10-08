import axios from 'axios'
import { Capacitor } from '@capacitor/core'

// Multi-environment API URL resolution (Step 8 architecture):
// 1. Explicit VITE_API_URL if configured in environment
// 2. Native Android APK fallback: Host Wi-Fi LAN IP (avoids dead localhost inside APK)
// 3. Web browser fallback: Relative '/api' via Vite development proxy
const isNative = Capacitor.isNativePlatform()
const DEFAULT_NATIVE_API_URL = 'http://172.16.225.19:5000/api'

const baseURL = import.meta.env.VITE_API_URL || (isNative ? DEFAULT_NATIVE_API_URL : '/api')

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// Automatically attach JWT token to every request
api.interceptors.request.use((config) => {
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
