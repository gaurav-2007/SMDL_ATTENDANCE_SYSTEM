import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import TeacherLectureReview from './TeacherLectureReview'
import MyClasses from './MyClasses'
import ReportsPanel from '../admin/ReportsPanel'
import AnnouncementsPanel from '../admin/AnnouncementsPanel'
import {
  BookOpen, ClipboardList, BarChart2, Users, Bell,
  ChevronRight, MessageSquare, Clock, Play, Sparkles, CheckCircle2
} from 'lucide-react'
import api from '../../lib/api'

function TeacherOverview() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [todayData, setTodayData] = useState(null)
  const [loadingSchedule, setLoadingSchedule] = useState(true)

  useEffect(() => {
    async function loadToday() {
      try {
        const { data } = await api.get('/lectures/today')
        setTodayData(data?.data || null)
      } catch (e) {
        // silent fail for overview banner
      } finally {
        setLoadingSchedule(false)
      }
    }
    loadToday()
  }, [])

  const cards = [
    { to: '/teacher/classes',    label: 'My Classes & Timetable', Icon: BookOpen,      color: 'bg-blue-500/20 text-blue-400',     desc: 'Dynamic daily schedule & official weekly timetable' },
    { to: '/teacher/attendance', label: 'Attendance Review',      Icon: ClipboardList, color: 'bg-green-500/20 text-green-400',   desc: 'Live roster, selfie review, manual override' },
    { to: '/teacher/reports',    label: 'Reports',                Icon: BarChart2,    color: 'bg-purple-500/20 text-purple-400', desc: 'Class analytics and attendance registers' },
    { to: '/teacher/announce',   label: 'Announcements',          Icon: Bell,         color: 'bg-orange-500/20 text-orange-400', desc: 'Send class notices and updates' },
  ]

  const featuredLecture = todayData?.current_lecture || todayData?.next_lecture || todayData?.my_lectures?.[0] || todayData?.all_lectures?.[0]
  const isOngoing = featuredLecture?.status === 'ONGOING'

  return (
    <div className="animate-fade-in space-y-6">
      <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <span>Welcome, {user?.name?.split(' ')[0] || 'Teacher'} 👋</span>
          </h2>
          <p className="page-subtitle">
            Teacher Dashboard — {user?.department || 'Department of Computer Science'} • SMDL College
          </p>
        </div>

        <div className="glass px-3.5 py-1.5 rounded-xl border border-white/10 text-xs flex items-center gap-2">
          <Clock size={14} className="text-brand-accent" />
          <span className="text-white font-medium">{todayData?.day_name || 'Today'}</span>
          <span className="text-brand-muted">•</span>
          <span className="text-brand-accent font-semibold">{todayData?.date || ''}</span>
        </div>
      </div>

      {/* Featured Today's Timetable Widget */}
      {featuredLecture && (
        <div className={`card transition-all p-5 border-2 ${
          isOngoing
            ? 'border-rose-500/60 bg-gradient-to-r from-rose-950/30 via-slate-900 to-rose-950/20'
            : 'border-brand-accent/40 bg-gradient-to-r from-brand-accent/5 via-slate-900 to-transparent'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                {isOngoing ? (
                  <span className="badge badge-error text-xs font-bold flex items-center gap-1.5 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    LECTURE IN PROGRESS NOW
                  </span>
                ) : (
                  <span className="badge badge-warning text-xs font-semibold flex items-center gap-1">
                    <Clock size={11} /> UPCOMING TIMETABLE SLOT
                  </span>
                )}
                <span className="text-xs font-mono text-brand-muted">
                  {featuredLecture.start_time?.slice(0, 5)} - {featuredLecture.end_time?.slice(0, 5)}
                </span>
              </div>

              <h3 className="text-xl font-bold text-white">
                {featuredLecture.subject?.code}: {featuredLecture.subject?.name}
              </h3>

              <p className="text-xs text-brand-muted">
                F.Y.BSc (Computer Science) • Faculty: <strong className="text-white">{featuredLecture.teacher?.full_name}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => navigate('/teacher/attendance', { state: { lectureId: featuredLecture.id } })}
                className="btn-primary !py-2 !px-4 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-brand-accent/20"
              >
                <Play size={13} className="fill-current" />
                <span>{isOngoing ? 'Live Roster' : 'Open Attendance'}</span>
              </button>

              <button
                onClick={() => navigate('/teacher/classes')}
                className="btn-secondary !py-2 !px-3 text-xs text-brand-muted hover:text-white"
              >
                Full Timetable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Quick Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Quick Tips */}
      <div className="card">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Users size={18} className="text-brand-accent" /> Quick Tips & Workflow
        </h3>
        <ul className="space-y-3 text-sm">
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
            <p className="text-brand-muted"><span className="text-white font-medium">Daily Lecture Planner:</span> Go to <span className="text-brand-accent font-semibold cursor-pointer" onClick={() => navigate('/teacher/classes')}>My Classes</span> to view your scheduled teaching slots for today or view the full 6-day official SMDL College Timetable.</p>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
            <p className="text-brand-muted"><span className="text-white font-medium">Review Student Attendance:</span> Click <strong>"Live Roster"</strong> or visit <span className="text-brand-accent font-semibold cursor-pointer" onClick={() => navigate('/teacher/attendance')}>Attendance Review</span> to verify live student selfie proofs and GPS markers.</p>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
            <p className="text-brand-muted"><span className="text-white font-medium">Students Without Smartphones:</span> Teachers can directly check-in students who don't have a smartphone using the <strong>"Mark (No Phone)"</strong> direct override button.</p>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default function TeacherDashboard() {
  return (
    <DashboardLayout>
      <Routes>
        <Route index element={<TeacherOverview />} />
        <Route path="classes" element={<MyClasses />} />
        <Route path="attendance" element={<TeacherLectureReview />} />
        <Route path="reports" element={<ReportsPanel />} />
        <Route path="announce" element={<AnnouncementsPanel />} />
        <Route path="*" element={<Navigate to="/teacher" replace />} />
      </Routes>
    </DashboardLayout>
  )
}
