import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  GraduationCap, LayoutDashboard, Users, BookOpen,
  ClipboardList, FileText, Bell, LogOut, Menu, X,
  ChevronRight, UserCheck, BarChart2, MessageSquare
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

// Nav items per role
const NAV_CONFIG = {
  admin: [
    { to: '/admin',          label: 'Dashboard',   Icon: LayoutDashboard },
    { to: '/admin/teachers', label: 'Teachers',    Icon: UserCheck },
    { to: '/admin/students', label: 'Students',    Icon: Users },
    { to: '/admin/academic', label: 'Academics',   Icon: GraduationCap },
    { to: '/admin/lectures', label: 'Lectures',    Icon: BookOpen },
    { to: '/admin/reports',  label: 'Reports',     Icon: BarChart2 },
    { to: '/admin/announce', label: 'Announcements', Icon: Bell },
  ],
  teacher: [
    { to: '/teacher',             label: 'Dashboard',   Icon: LayoutDashboard },
    { to: '/teacher/classes',     label: 'My Classes',  Icon: BookOpen },
    { to: '/teacher/attendance',  label: 'Attendance',  Icon: ClipboardList },
    { to: '/teacher/reports',     label: 'Reports',     Icon: BarChart2 },
    { to: '/teacher/announce',    label: 'Announcements', Icon: Bell },
  ],
  student: [
    { to: '/student',            label: 'Dashboard',   Icon: LayoutDashboard },
    { to: '/student/attendance', label: 'My Attendance', Icon: ClipboardList },
    { to: '/student/mark',       label: 'Mark Present', Icon: UserCheck },
    { to: '/student/reports',    label: 'Reports',     Icon: FileText },
    { to: '/student/announce',   label: 'Announcements', Icon: MessageSquare },
  ],
}

const ROLE_LABELS = { admin: 'Administrator', teacher: 'Teacher', student: 'Student' }
const ROLE_COLORS = { admin: 'badge-danger', teacher: 'badge-info', student: 'badge-active' }

export default function DashboardLayout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navItems = NAV_CONFIG[user?.role] || []

  function handleLogout() {
    logout()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  const Sidebar = () => (
    <aside className={`
      fixed inset-y-0 left-0 z-40 w-64 bg-brand-card border-r border-brand-border
      flex flex-col transform transition-transform duration-300 ease-in-out
      ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      lg:translate-x-0 lg:static lg:flex
    `}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-brand-border">
        <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center shadow-lg flex-shrink-0">
          <GraduationCap size={20} className="text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-none">SMDL College</p>
          <p className="text-brand-muted text-xs mt-0.5">Attendance System</p>
        </div>
        <button
          id="close-sidebar-btn"
          className="ml-auto lg:hidden text-brand-muted hover:text-white"
          onClick={() => setSidebarOpen(false)}
        >
          <X size={18} />
        </button>
      </div>

      {/* User info */}
      <div className="px-4 py-4 border-b border-brand-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{user?.name || 'User'}</p>
            <span className={`badge mt-0.5 ${ROLE_COLORS[user?.role]}`}>
              {ROLE_LABELS[user?.role]}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/admin' || to === '/teacher' || to === '/student'}
            id={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <Icon size={18} />
            <span>{label}</span>
            <ChevronRight size={14} className="ml-auto opacity-50" />
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-brand-border">
        <button
          id="logout-btn"
          onClick={handleLogout}
          className="nav-link w-full text-brand-danger hover:bg-brand-danger/10 hover:text-brand-danger"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen bg-brand-dark flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-brand-card/80 backdrop-blur border-b border-brand-border px-4 py-3 flex items-center gap-3">
          <button
            id="open-sidebar-btn"
            className="lg:hidden btn-icon btn-ghost"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          <div className="flex-1" />

          {/* Notifications placeholder */}
          <button id="notifications-btn" className="btn-icon btn-ghost relative">
            <Bell size={18} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-brand-accent rounded-full" />
          </button>

          {/* Avatar */}
          <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center text-white font-bold text-xs">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
