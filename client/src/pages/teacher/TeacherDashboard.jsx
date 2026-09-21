import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import TeacherLectureReview from './TeacherLectureReview'
import ReportsPanel from '../admin/ReportsPanel'
import AnnouncementsPanel from '../admin/AnnouncementsPanel'
import {
  BookOpen, ClipboardList, BarChart2, Users, Bell,
  ChevronRight, MessageSquare
} from 'lucide-react'

function TeacherOverview() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const cards = [
    { to: '/teacher/classes',    label: 'My Classes',         Icon: BookOpen,      color: 'bg-blue-500/20 text-blue-400',     desc: 'Manage your assigned subjects and divisions' },
    { to: '/teacher/attendance', label: 'Attendance Review', Icon: ClipboardList, color: 'bg-green-500/20 text-green-400',   desc: 'Live roster, selfie review, manual override' },
    { to: '/teacher/reports',    label: 'Reports',           Icon: BarChart2,    color: 'bg-purple-500/20 text-purple-400', desc: 'Class analytics and attendance reports' },
    { to: '/teacher/announce',   label: 'Announcements',     Icon: Bell,         color: 'bg-orange-500/20 text-orange-400', desc: 'Send class notices and announcements' },
  ]

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h2 className="page-title">Welcome, {user?.name?.split(' ')[0] || 'Teacher'} 👋</h2>
        <p className="page-subtitle">Teacher Dashboard — {user?.department || 'Academic Department'}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map(({ to, label, Icon, color, desc }) => (
          <div
            key={label}
            onClick={() => navigate(to)}
            className="card hover:border-brand-accent transition-colors cursor-pointer group flex items-start gap-4"
          >
            <div className={`stat-icon ${color} w-12 h-12 flex-shrink-0`}><Icon size={22} /></div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold group-hover:text-brand-accent transition-colors">{label}</p>
              <p className="text-brand-muted text-xs mt-1">{desc}</p>
            </div>
            <ChevronRight size={18} className="text-brand-muted group-hover:text-brand-accent transition-colors mt-1" />
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Users size={18} className="text-brand-accent" /> Quick Tips
        </h3>
        <ul className="space-y-3 text-sm">
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
            <p className="text-brand-muted"><span className="text-white font-medium">Start a lecture:</span> Go to <span className="text-brand-accent font-semibold cursor-pointer" onClick={() => navigate('/teacher/attendance')}>Attendance</span> and click <strong>"Start New Lecture"</strong> to create an active session for your class.</p>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
            <p className="text-brand-muted"><span className="text-white font-medium">Review student markers:</span> Click any student's selfie thumbnail to open a full-size preview for identity verification.</p>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
            <p className="text-brand-muted"><span className="text-white font-medium">Manual override for phone-less students:</span> Click <strong>"Mark Present"</strong> on any absent student, enter a reason, and your change will be recorded with an audit log timestamp.</p>
          </li>
        </ul>
      </div>
    </div>
  )
}

function MyClassesPlaceholder() {
  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h2 className="page-title">My Classes</h2>
        <p className="page-subtitle">Your assigned subjects and divisions</p>
      </div>
      <div className="card text-center py-20">
        <BookOpen size={44} className="mx-auto text-brand-muted mb-4" />
        <p className="text-white font-semibold text-lg">📚 Classes Module</p>
        <p className="text-brand-muted text-sm mt-1">Detailed class/subject management coming soon.</p>
        <p className="text-brand-muted text-xs mt-2">In the meantime, use the Attendance Review page to start lectures and view rosters.</p>
      </div>
    </div>
  )
}

function ReportsPlaceholder() {
  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h2 className="page-title">Reports</h2>
        <p className="page-subtitle">Class attendance analytics</p>
      </div>
      <div className="card text-center py-20">
        <BarChart2 size={44} className="mx-auto text-brand-muted mb-4" />
        <p className="text-white font-semibold text-lg">📊 Reports & Analytics</p>
        <p className="text-brand-muted text-sm mt-1">Daily, weekly and monthly class reports coming soon.</p>
      </div>
    </div>
  )
}

function AnnouncementsPlaceholder() {
  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h2 className="page-title">Announcements</h2>
        <p className="page-subtitle">Send notices to classes & divisions</p>
      </div>
      <div className="card text-center py-20">
        <MessageSquare size={44} className="mx-auto text-brand-muted mb-4" />
        <p className="text-white font-semibold text-lg">📢 Announcement Creator</p>
        <p className="text-brand-muted text-sm mt-1">Post class-wide notices, assignment due dates and reminders soon.</p>
      </div>
    </div>
  )
}

export default function TeacherDashboard() {
  return (
    <DashboardLayout>
      <Routes>
        <Route index element={<TeacherOverview />} />
        <Route path="classes" element={<MyClassesPlaceholder />} />
        <Route path="attendance" element={<TeacherLectureReview />} />
        <Route path="reports" element={<ReportsPanel />} />
        <Route path="announce" element={<AnnouncementsPanel />} />
        <Route path="*" element={<Navigate to="/teacher" replace />} />
      </Routes>
    </DashboardLayout>
  )
}
