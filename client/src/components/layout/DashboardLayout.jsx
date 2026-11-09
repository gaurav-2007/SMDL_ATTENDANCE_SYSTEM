import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  GraduationCap, LayoutDashboard, Users, BookOpen,
  ClipboardList, FileText, Bell, LogOut, Menu, X,
  ChevronRight, UserCheck, BarChart2, MessageSquare,
  User, CheckCircle2
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import NotificationCenter from '../notifications/NotificationCenter'
import UserProfileModal from '../profile/UserProfileModal'
import PermissionSetupModal from '../permissions/PermissionSetupModal'
import { Badge } from '../ui'

// Navigation configuration per role
const NAV_CONFIG = {
  admin: [
    { to: '/admin', label: 'Dashboard', shortLabel: 'Home', Icon: LayoutDashboard },
    { to: '/admin/teachers', label: 'Teachers', shortLabel: 'Teachers', Icon: UserCheck },
    { to: '/admin/students', label: 'Students', shortLabel: 'Students', Icon: Users },
    { to: '/admin/academic', label: 'Academics', shortLabel: 'Academic', Icon: GraduationCap },
    { to: '/admin/lectures', label: 'Lectures', shortLabel: 'Lectures', Icon: BookOpen },
    { to: '/admin/reports', label: 'Reports', shortLabel: 'Reports', Icon: BarChart2 },
    { to: '/admin/announce', label: 'Announcements', shortLabel: 'Notices', Icon: Bell },
  ],
  teacher: [
    { to: '/teacher', label: 'Dashboard', shortLabel: 'Home', Icon: LayoutDashboard },
    { to: '/teacher/classes', label: 'My Classes', shortLabel: 'Classes', Icon: BookOpen },
    { to: '/teacher/attendance', label: 'Attendance', shortLabel: 'Attd', Icon: ClipboardList },
    { to: '/teacher/reports', label: 'Reports', shortLabel: 'Reports', Icon: BarChart2 },
    { to: '/teacher/announce', label: 'Announcements', shortLabel: 'Notices', Icon: Bell },
  ],
  student: [
    { to: '/student', label: 'Dashboard', shortLabel: 'Home', Icon: LayoutDashboard },
    { to: '/student/attendance', label: 'My Attendance', shortLabel: 'Attd', Icon: ClipboardList },
    { to: '/student/mark', label: 'Mark Present', shortLabel: 'Mark', Icon: UserCheck },
    { to: '/student/reports', label: 'Reports', shortLabel: 'Reports', Icon: FileText },
    { to: '/student/announce', label: 'Announcements', shortLabel: 'Notices', Icon: MessageSquare },
  ],
}

const ROLE_LABELS = {
  admin: 'Administrator',
  teacher: 'Teacher',
  student: 'Student',
}

const ROLE_BADGE_VARIANTS = {
  admin: 'absent',   // Soft red/rose badge
  teacher: 'brand',  // Soft indigo badge
  student: 'present',// Soft green badge
}

export default function DashboardLayout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const profileRef = useRef(null)

  const navItems = NAV_CONFIG[user?.role] || []

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleLogout() {
    logout()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  // Active page title helper
  const currentNav = navItems.find(item => {
    if (item.to === '/admin' || item.to === '/teacher' || item.to === '/student') {
      return location.pathname === item.to
    }
    return location.pathname.startsWith(item.to)
  })
  const pageTitle = currentNav?.label || 'Dashboard'

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col lg:flex-row antialiased">
      {/* ── DESKTOP & MOBILE DRAWER SIDEBAR ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-surface border-r border-line
          flex flex-col transform transition-transform duration-200 ease-in-out shadow-xs
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:flex
        `}
      >
        {/* Brand / Institution Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-line">
          <div className="w-9 h-9 rounded-lg bg-brand text-white flex items-center justify-center shrink-0 shadow-xs">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold font-display text-ink leading-tight truncate">SMDL College</p>
            <p className="text-[11px] text-muted tracking-tight">Attendance System</p>
          </div>
          <button
            id="close-sidebar-btn"
            className="lg:hidden p-1.5 rounded-md text-muted hover:text-ink hover:bg-bg transition-colors"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card inside Sidebar — Clickable to open Profile */}
        <div
          onClick={() => setShowProfileModal(true)}
          className="px-4 py-3.5 border-b border-line bg-bg/40 hover:bg-brand/[0.04] cursor-pointer transition-colors group"
          title="Click to view full profile details"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand/10 border border-brand/20 text-brand font-semibold text-sm flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink truncate group-hover:text-brand transition-colors">{user?.name || 'User'}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant={ROLE_BADGE_VARIANTS[user?.role] || 'neutral'} size="sm">
                  {ROLE_LABELS[user?.role] || user?.role}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin' || to === '/teacher' || to === '/student'}
              id={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-brand/10 text-brand font-semibold border border-brand/20 shadow-xs'
                  : 'text-muted hover:text-ink hover:bg-bg'
                }
              `}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{label}</span>
              <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-40 shrink-0" />
            </NavLink>
          ))}
        </nav>

        {/* Logout in Sidebar */}
        <div className="p-3 border-t border-line">
          <button
            id="logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-absent hover:bg-absent/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop for Drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Header */}
        <header className="sticky top-0 z-20 bg-surface/90 backdrop-blur-md border-b border-line px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger (Only for admin or as extra drawer toggle) */}
            <button
              id="open-sidebar-btn"
              className="lg:hidden p-2 rounded-lg text-muted hover:text-ink hover:bg-bg border border-line transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb / Title on Desktop & Mobile */}
            <div>
              <h1 className="text-base sm:text-lg font-bold font-display text-ink tracking-tight flex items-center gap-2">
                <span>{pageTitle}</span>
              </h1>
            </div>
          </div>

          {/* Right Header: Notification Center & Profile Dropdown */}
          <div className="flex items-center gap-2.5">
            <NotificationCenter />

            {/* Profile Dropdown Container */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen(prev => !prev)}
                className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full border border-line hover:border-line/80 hover:bg-bg transition-colors cursor-pointer"
                aria-expanded={profileOpen}
              >
                <div className="w-7 h-7 rounded-full bg-brand/10 text-brand font-semibold text-xs flex items-center justify-center shrink-0">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <span className="hidden sm:inline-block text-xs font-medium text-ink max-w-[120px] truncate">
                  {user?.name?.split(' ')[0] || 'Account'}
                </span>
              </button>

              {/* Profile Dropdown Menu */}
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-surface border border-line rounded-xl shadow-xl p-2 z-50 animate-fade-in text-left">
                  <div className="px-3 py-2 border-b border-line mb-1.5">
                    <p className="text-sm font-semibold text-ink truncate">{user?.name || 'User'}</p>
                    <p className="text-xs text-muted truncate">{user?.email || user?.identifier || ''}</p>
                    <div className="mt-1.5">
                      <Badge variant={ROLE_BADGE_VARIANTS[user?.role] || 'neutral'} size="sm">
                        {ROLE_LABELS[user?.role] || user?.role}
                      </Badge>
                    </div>
                  </div>

                  {/* 👤 View Full Profile Option */}
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false)
                      setShowProfileModal(true)
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-ink hover:bg-brand/10 hover:text-brand rounded-lg transition-colors cursor-pointer mb-1"
                  >
                    <User className="w-3.5 h-3.5 text-brand shrink-0" />
                    <span>View Profile Details</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false)
                      handleLogout()
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-absent hover:bg-absent/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 shrink-0" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        {/* pb-20 on mobile ensures bottom navigation doesn't hide page buttons */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Global User Profile Modal */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={user}
      />

      {/* Global Post-Login Permissions Setup Modal */}
      <PermissionSetupModal />

      {/* ── MOBILE BOTTOM NAVIGATION BAR (Height 56px + Safe-Area) ── */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface/95 backdrop-blur-md border-t border-line safe-area-bottom shadow-lg"
      >
        <div className="flex items-center justify-around h-14 max-w-md mx-auto px-2">
          {navItems.map(({ to, label, shortLabel, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin' || to === '/teacher' || to === '/student'}
              className={({ isActive }) => `
                flex-1 flex flex-col items-center justify-center py-1 px-1 min-h-[48px] rounded-lg transition-all duration-150 select-none
                ${isActive
                  ? 'text-brand font-semibold'
                  : 'text-muted hover:text-ink'
                }
              `}
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1 rounded-md transition-transform duration-150 ${isActive ? 'bg-brand/10 scale-110' : ''}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-[10px] tracking-tight mt-0.5 leading-none ${isActive ? 'font-semibold text-brand' : 'font-normal'}`}>
                    {shortLabel || label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

