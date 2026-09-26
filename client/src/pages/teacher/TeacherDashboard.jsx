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
  const [profileData, setProfileData] = useState(null)
  const [loadingSchedule, setLoadingSchedule] = useState(true)

  useEffect(() => {
    async function loadToday() {
      try {
        const [todayRes, meRes] = await Promise.allSettled([
          api.get('/lectures/today'),
          api.get('/auth/me'),
        ])
        if (todayRes.status === 'fulfilled') {
          setTodayData(todayRes.value?.data?.data || null)
        }
        if (meRes.status === 'fulfilled') {
          setProfileData(meRes.value?.data?.data || null)
        }
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

  // Teacher profile details (fallback to user from auth context)
  const teacherProfile = profileData?.profile || user?.profile || {}
  const empId = teacherProfile.employee_id || user?.employee_id || 'TCH-1001'
  const dept = teacherProfile.department || user?.department || 'Computer Science'
  const designation = teacherProfile.designation || user?.designation || 'Faculty Member'
  const status = profileData?.status || user?.status || user?.account_status || 'ACTIVE'
  const assignedSubjects = teacherProfile.assigned_subjects || user?.assigned_subjects || []
  const assignedClasses = teacherProfile.assigned_classes || user?.assigned_classes || []

  return (
    <div className="animate-fade-in space-y-6">
      {/* Page Header */}
      <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <span>Welcome, {user?.name?.split(' ')[0] || user?.full_name?.split(' ')[0] || 'Teacher'} 👋</span>
          </h2>
          <p className="page-subtitle">
            Teacher Dashboard — Department of {dept} • SMDL College
          </p>
        </div>

        <div className="glass px-3.5 py-1.5 rounded-xl border border-white/10 text-xs flex items-center gap-2">
          <Clock size={14} className="text-brand-accent" />
          <span className="text-white font-medium">{todayData?.day_name || 'Today'}</span>
          <span className="text-brand-muted">•</span>
          <span className="text-brand-accent font-semibold">{todayData?.date || ''}</span>
        </div>
      </div>

      {/* Teacher Profile & Official Academic Assignments Card */}
      <div className="card bg-gradient-to-br from-slate-900 via-slate-800/90 to-slate-900 border-white/10 p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-accent/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 relative z-10">
          {/* Identity Info */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-brand flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-brand-accent/20 flex-shrink-0">
              {(user?.name || user?.full_name || 'T')[0]}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-xl font-bold text-white">
                  {user?.name || user?.full_name || 'Faculty Member'}
                </h3>

                {status === 'ACTIVE' ? (
                  <span className="badge badge-active text-xs font-semibold flex items-center gap-1.5 py-0.5 px-2.5">
                    <CheckCircle2 size={13} className="text-emerald-400" />
                    <span>APPROVED & ACTIVE</span>
                  </span>
                ) : (
                  <span className="badge badge-pending text-xs font-semibold flex items-center gap-1.5 py-0.5 px-2.5">
                    <Clock size={13} className="text-amber-400" />
                    <span>PENDING APPROVAL</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-brand-muted flex flex-wrap items-center gap-2">
                <span className="font-mono text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded border border-brand-accent/20 font-bold">
                  ID: {empId}
                </span>
                <span>•</span>
                <span className="text-slate-200 font-medium">{designation}</span>
                <span>•</span>
                <span className="text-slate-300">Department of {dept}</span>
              </p>
            </div>
          </div>

          {/* Quick Stats / Class & Division Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-black/30 border border-white/10 rounded-xl px-3.5 py-2">
              <p className="text-[10px] uppercase tracking-wider text-brand-muted font-mono">Assigned Classes</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {assignedClasses.length > 0 ? (
                  assignedClasses.map((cls, i) => (
                    <span key={i} className="badge badge-info text-xs font-semibold">
                      {cls}
                    </span>
                  ))
                ) : (
                  <span className="badge badge-info text-xs font-semibold">
                    FYBSc CS - Div A
                  </span>
                )}
              </div>
            </div>

            <div className="bg-black/30 border border-white/10 rounded-xl px-3.5 py-2">
              <p className="text-[10px] uppercase tracking-wider text-brand-muted font-mono">Total Subjects</p>
              <p className="text-base font-bold text-white mt-0.5 font-mono">
                {assignedSubjects.length > 0 ? assignedSubjects.length : '3'} Assigned
              </p>
            </div>
          </div>
        </div>

        {/* Assigned Subjects Badges */}
        <div className="mt-4 pt-4 border-t border-white/5">
          <p className="text-[11px] font-mono uppercase text-brand-muted tracking-wider mb-2 flex items-center gap-1.5">
            <BookOpen size={13} className="text-brand-accent" />
            <span>Official Timetable Subjects Assigned to You:</span>
          </p>

          <div className="flex flex-wrap gap-2">
            {assignedSubjects.length > 0 ? (
              assignedSubjects.map((subj, idx) => (
                <div
                  key={subj.id || idx}
                  className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-brand-accent/40 transition-colors flex items-center gap-2 text-xs"
                >
                  <span className="font-mono font-bold text-brand-accent">
                    {subj.code}
                  </span>
                  <span className="text-slate-200">
                    {subj.name}
                  </span>
                  {subj.code?.includes('(P)') && (
                    <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">
                      Lab
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-brand-muted italic">
                Subject mappings will appear dynamically according to the FY B.Sc CS Timetable.
              </p>
            )}
          </div>
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
