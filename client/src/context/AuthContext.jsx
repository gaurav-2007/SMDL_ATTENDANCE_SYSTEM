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

  const login = useCallback(async (email, password, extra = {}) => {
    const { data } = await api.post('/auth/login', { email, password, ...extra })
    // Backend returns: { success, data: { id, name, role, token, ...user fields, user: {...} } }
    // Extract token from the top-level data object
    const token = data?.data?.token
    // Build userData from flat fields (exclude nested 'user' key and token)
    const raw = data?.data || {}
    const userData = {
      id:             raw.id,
      name:           raw.name,
      email:          raw.email,
      role:           raw.role,
      account_status: raw.account_status,
      phone:          raw.phone,
      created_at:     raw.created_at,
      roll_number:    raw.roll_number || raw.profile?.roll_number,
      course:         raw.course || raw.profile?.course,
      course_code:    raw.course_code || raw.profile?.course_code,
      division:       raw.division || raw.profile?.division,
      class:          raw.class || raw.profile?.class,
      employee_id:    raw.employee_id || raw.profile?.employee_id,
      department:     raw.department || raw.profile?.department,
      profile:        raw.profile,
    }
    if (token) localStorage.setItem('smdl_token', token)
    if (userData?.id) localStorage.setItem('smdl_user', JSON.stringify(userData))
    setUser(userData)
    return userData
  }, [])


  const logout = useCallback(() => {
    localStorage.removeItem('smdl_token')
    localStorage.removeItem('smdl_user')
    setUser(null)
  }, [])

  // Re-fetch current user from server (used by PendingApproval to check if teacher was approved)
  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me')
      const raw = data?.data || {}
      const userData = {
        id:             raw.id,
        name:           raw.name,
        email:          raw.email,
        role:           raw.role,
        account_status: raw.account_status,
        phone:          raw.phone,
        created_at:     raw.created_at,
        roll_number:    raw.profile?.roll_number,
        course:         raw.profile?.course,
        course_code:    raw.profile?.course_code,
        division:       raw.profile?.division,
        class:          raw.profile?.class,
        employee_id:    raw.profile?.employee_id,
        department:     raw.profile?.department,
        profile:        raw.profile,
      }
      localStorage.setItem('smdl_user', JSON.stringify(userData))
      setUser(userData)
      return userData
    } catch {
      return null
    }
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
    <AuthContext.Provider value={{ user, loading, login, logout, register, refreshUser, isAdmin, isTeacher, isStudent }}>
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
