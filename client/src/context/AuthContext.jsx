import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  // Restore session on page load
  useEffect(() => {
    const token = localStorage.getItem('smdl_token')
    const stored = localStorage.getItem('smdl_user')
    if (token && stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        localStorage.removeItem('smdl_user')
      }
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    const userData = data?.data?.user || data?.data
    const token = data?.data?.token || userData?.token
    if (token) localStorage.setItem('smdl_token', token)
    if (userData) localStorage.setItem('smdl_user', JSON.stringify(userData))
    setUser(userData)
    return userData
  }, [])


  const logout = useCallback(() => {
    localStorage.removeItem('smdl_token')
    localStorage.removeItem('smdl_user')
    setUser(null)
  }, [])

  const register = useCallback(async (role, payload) => {
    const endpoint = role === 'student'
      ? '/auth/register/student'
      : '/auth/register/teacher'
    const { data } = await api.post(endpoint, payload)
    return data
  }, [])

  // Helpers
  const isAdmin   = user?.role === 'admin'
  const isTeacher = user?.role === 'teacher'
  const isStudent = user?.role === 'student'

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, isAdmin, isTeacher, isStudent }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
