import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

// Lazy-loaded pages (will be created step by step)
import { lazy, Suspense } from 'react'

const LoginPage         = lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage      = lazy(() => import('./pages/auth/RegisterPage'))
const PendingApproval   = lazy(() => import('./pages/auth/PendingApproval'))
const AdminDashboard    = lazy(() => import('./pages/admin/AdminDashboard'))
const TeacherDashboard  = lazy(() => import('./pages/teacher/TeacherDashboard'))
const StudentDashboard  = lazy(() => import('./pages/student/StudentDashboard'))
const NotFound          = lazy(() => import('./pages/NotFound'))

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-brand-dark">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-white/20 border-t-brand-accent rounded-full animate-spin" />
      <p className="text-brand-muted text-sm animate-pulse">Loading page...</p>
    </div>
  </div>
)

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!user)   return <Navigate to="/login" replace />
  if (user.role === 'teacher' && user.account_status === 'PENDING') {
    return <Navigate to="/pending-approval" replace />
  }
  const roleMap = { admin: '/admin', teacher: '/teacher', student: '/student' }
  return <Navigate to={roleMap[user.role] || '/login'} replace />
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/login"         element={<LoginPage />} />
        <Route path="/register"      element={<RegisterPage />} />
        <Route path="/pending-approval" element={<PendingApproval />} />

        {/* Root → role-based redirect */}
        <Route path="/" element={<RootRedirect />} />

        {/* Admin routes */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Teacher routes */}
        <Route
          path="/teacher/*"
          element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />

        {/* Student routes */}
        <Route
          path="/student/*"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1e293b',
              color: '#f1f5f9',
              border: '1px solid #334155',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#22c55e', secondary: '#1e293b' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#1e293b' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  )
}
