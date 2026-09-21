import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * ProtectedRoute — wraps any route that needs authentication
 * allowedRoles: ['admin','teacher','student'] — omit to allow all authenticated users
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner w-10 h-10 border-4" />
          <p className="text-brand-muted text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to their role's home page
    const homeMap = { admin: '/admin', teacher: '/teacher', student: '/student' }
    return <Navigate to={homeMap[user.role] || '/login'} replace />
  }

  return children
}
