import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

// Lazy-loaded pages (will be created step by step)
import LoginPage from './pages/auth/LoginPage'
import { lazy, Suspense } from 'react'

const RegisterPage      = lazy(() => import('./pages/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'))
const ResetPasswordPage  = lazy(() => import('./pages/auth/ResetPasswordPage'))
const PendingApproval   = lazy(() => import('./pages/auth/PendingApproval'))
const AdminDashboard    = lazy(() => import('./pages/admin/AdminDashboard'))
const TeacherDashboard  = lazy(() => import('./pages/teacher/TeacherDashboard'))
const StudentDashboard  = lazy(() => import('./pages/student/StudentDashboard'))
const NotFound          = lazy(() => import('./pages/NotFound'))

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-bg">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-3 border-line border-t-brand rounded-full animate-spin" />
      <p className="text-muted text-xs font-medium">Loading institutional portal...</p>
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

  // Check if a notification click saved a pending target route
  const pendingNav = sessionStorage.getItem('smdl_pending_redirect')
  if (pendingNav) {
    sessionStorage.removeItem('smdl_pending_redirect')
    return <Navigate to={pendingNav} replace />
  }

  const roleMap = { admin: '/admin', teacher: '/teacher', student: '/student' }
  return <Navigate to={roleMap[user.role] || '/login'} replace />
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/login"           element={<LoginPage />} />
        <Route path="/register"        element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />
        <Route path="/pending-approval" element={<PendingApproval />} />

        {/* Root → role-based redirect */}
        <Route path="/" element={<RootRedirect />} />
        <Route path="/index.html" element={<RootRedirect />} />

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

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { setupNativePushListeners, setNotificationClickHandler } from './lib/firebase'

function NativeBridgeListener() {
  const navigate = useNavigate()

  useEffect(() => {
    // 1. Listen for notification navigation events
    const handleNotificationNav = (e) => {
      const url = e?.detail?.url
      if (url) {
        console.log('🚀 [NativeBridge] Direct deep link to route:', url)
        navigate(url)
      }
    }
    window.addEventListener('app:notification-nav', handleNotificationNav)

    // 2. Check if a pending notification redirect was saved
    const pendingNav = sessionStorage.getItem('smdl_pending_redirect')
    if (pendingNav) {
      sessionStorage.removeItem('smdl_pending_redirect')
      navigate(pendingNav)
    }

    // 3. Native Android / iOS integrations
    if (Capacitor.isNativePlatform()) {
      // Connect click handler so notification tap directs immediately
      setNotificationClickHandler((targetUrl) => {
        console.log('🎯 [Push Notification Clicked] Directly navigating to:', targetUrl)
        navigate(targetUrl)
      })
      setupNativePushListeners((targetUrl) => {
        navigate(targetUrl)
      })

      // Handle custom deep link URL open (e.g., smdl://... or https://...)
      CapApp.addListener('appUrlOpen', (data) => {
        try {
          const url = new URL(data.url)
          const path = url.pathname || data.url.replace(/^.*:\/\/[^/]+/, '')
          if (path) navigate(path)
        } catch (_e) {
          if (data.url) navigate(data.url)
        }
      }).catch(() => {})

      // Daylight status bar matching academic theme
      StatusBar.setStyle({ style: Style.Light }).catch(() => {})
      StatusBar.setBackgroundColor({ color: '#F7F8FA' }).catch(() => {})

      // Hide splash screen after React mounts
      SplashScreen.hide().catch(() => {})

      // Handle Android physical & gesture back button
      let backListener = null
      CapApp.addListener('backButton', ({ canGoBack }) => {
        const path = window.location.pathname
        const isRootPortal = path === '/login' || path === '/student' || path === '/teacher' || path === '/admin'
        if (isRootPortal) {
          CapApp.minimizeApp().catch(() => {})
        } else if (canGoBack) {
          window.history.back()
        } else {
          navigate(-1)
        }
      }).then((sub) => {
        backListener = sub
      })

      return () => {
        window.removeEventListener('app:notification-nav', handleNotificationNav)
        if (backListener) backListener.remove()
      }
    }

    return () => {
      window.removeEventListener('app:notification-nav', handleNotificationNav)
    }
  }, [navigate])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <NativeBridgeListener />
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#FFFFFF',
              color: '#111827',
              border: '1px solid #E5E7EB',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.06)',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 500,
            },
            success: { iconTheme: { primary: '#16a34a', secondary: '#FFFFFF' } },
            error:   { iconTheme: { primary: '#dc2626', secondary: '#FFFFFF' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  )
}
