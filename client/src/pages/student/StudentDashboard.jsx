import { useEffect, useState, memo, lazy, Suspense, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import api from '../../lib/api'
import {
  ClipboardList, UserCheck, FileText, MessageSquare,
  ClipboardCheck, BookOpen, AlertTriangle, TrendingUp,
  CalendarDays, ChevronRight, Loader2, Bell, Megaphone, Clock, RefreshCw,
  Download, Image as ImageIcon, CheckCircle, XCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

// Lazy-load heavy components to reduce initial bundle size
const StudentMarkAttendance = lazy(() => import('./StudentMarkAttendance'))

// Module-level cache — avoids duplicate API calls across sub-components
let statsCache = { data: null, promise: null }

function useMyStats() {
  const [data, setData] = useState(statsCache.data?.stats ?? null)
  const [loading, setLoading] = useState(!statsCache.data)
  const [subjectCount, setSubjectCount] = useState(statsCache.data?.subjectCount ?? 0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    if (statsCache.data) return // cache hit — skip fetch

    if (!statsCache.promise) {
      statsCache.promise = Promise.allSettled([
        api.get('/attendance/my-stats'),
        api.get('/academic/subjects'),
      ])
    }

    statsCache.promise.then(([statsRes, subjRes]) => {
      if (!mounted.current) return
      const statsData = statsRes.status === 'fulfilled' ? statsRes.value?.data?.data : null
      const count = subjRes.status === 'fulfilled'
        ? (subjRes.value?.data?.data?.subjects?.length || 0)
        : 0
      statsCache.data = { stats: statsData, subjectCount: count }
      setData(statsData)
      setSubjectCount(count)
      setLoading(false)
    }).catch(e => {
      if (!mounted.current) return
      toast.error(e?.response?.data?.message || 'Failed to load stats')
      setLoading(false)
    })

    return () => { mounted.current = false }
  }, [])

  return { data, loading, subjectCount }
}

// memo prevents re-renders when parent state changes unrelated to this card
const StatCard = memo(function StatCard({ label, value, subline, Icon, color, safeFlag, navigateTo, onClick }) {
  const navigate = useNavigate()
  const handleClick = onClick || (navigateTo ? () => navigate(navigateTo) : undefined)
  const cursorClass = handleClick ? 'cursor-pointer hover:border-brand-accent group' : ''
  return (
    <div className={`card flex items-center gap-4 ${cursorClass} transition-colors`} onClick={handleClick}>
      <div className={`stat-icon ${color}`}><Icon size={22} /></div>
      <div className="flex-1 min-w-0">
        <p className="text-brand-muted text-xs">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-white text-2xl font-bold">{value}</p>
          {safeFlag != null && (
            <span className={`badge text-[10px] ${safeFlag ? 'badge-active' : 'badge-rejected'}`}>
              {safeFlag ? '✓ Safe' : '⚠️ Below 75%'}
            </span>
          )}
        </div>
        {subline && <p className="text-brand-muted text-[11px] mt-0.5">{subline}</p>}
      </div>
      {navigateTo && <ChevronRight size={18} className="text-brand-muted group-hover:text-brand-accent transition-colors" />}
    </div>
  )
})

function StudentOverview() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, loading: statsLoading, subjectCount } = useMyStats()
  const stats = data?.stats || {}
  const info = data?.student_info || {}

  const [todaySchedule, setTodaySchedule] = useState({ loading: true, classes: [], dayName: '', date: '', isHoliday: false })

  const fetchTodaySchedule = async () => {
    setTodaySchedule(prev => ({ ...prev, loading: true }))
    try {
      const res = await api.get('/student/today-classes')
      const payload = res.data?.data || {}
      setTodaySchedule({
        loading: false,
        classes: payload.classes || [],
        dayName: payload.day_name || '',
        date: payload.date || '',
        isHoliday: !!payload.is_holiday,
      })
    } catch (_err) {
      setTodaySchedule(prev => ({ ...prev, loading: false }))
    }
  }

  useEffect(() => {
    fetchTodaySchedule()
  }, [])

  const quickActions = [
    { label: 'Mark Present Now',   Icon: UserCheck,     color: 'bg-green-500/20 text-green-400',   to: '/student/mark',       desc: 'GPS + Selfie check-in' },
    { label: 'My Attendance',      Icon: ClipboardList, color: 'bg-blue-500/20 text-blue-400',     to: '/student/attendance', desc: 'History & percentage' },
    { label: 'Reports & Analytics',Icon: FileText,      color: 'bg-purple-500/20 text-purple-400', to: '/student/reports',    desc: 'Subject-wise metrics' },
    { label: 'Announcements',      Icon: MessageSquare, color: 'bg-orange-500/20 text-orange-400', to: '/student/announce',   desc: 'College notices' },
  ]

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h2 className="page-title">Welcome, {user?.name?.split(' ')[0] || 'Student'} 👋</h2>
        <p className="page-subtitle">
          Roll No: {info.roll_number || user?.roll_number || '—'} · {info.course || user?.class || ''} {info.division || user?.division || ''}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Attendance %"
          value={statsLoading ? '—' : `${stats.percentage ?? 0}%`}
          subline={`${stats.attended ?? 0} of ${stats.total_lectures ?? 0} lectures`}
          Icon={TrendingUp}
          color={(stats.percentage ?? 0) >= 75 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}
          safeFlag={stats.is_safe}
          navigateTo="/student/attendance"
        />
        <StatCard
          label="Lectures Attended"
          value={statsLoading ? '—' : `${stats.attended ?? 0}/${stats.total_lectures ?? 0}`}
          subline="This semester"
          Icon={ClipboardCheck}
          color="bg-blue-500/20 text-blue-400"
          navigateTo="/student/attendance"
        />
        <StatCard
          label="Subjects"
          value={subjectCount || '—'}
          subline="Enrolled subjects"
          Icon={BookOpen}
          color="bg-purple-500/20 text-purple-400"
        />
        <StatCard
          label="Announcements"
          value="0"
          subline="Unread notices"
          Icon={MessageSquare}
          color="bg-orange-500/20 text-orange-400"
          navigateTo="/student/announce"
        />
      </div>

      {(stats.percentage ?? 0) < 75 && !statsLoading && (
        <div className="card !p-4 !bg-red-500/10 !border-red-500/30 flex items-start gap-3 mb-6">
          <AlertTriangle size={22} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-semibold">⚠️ Attendance Below 75% Threshold</p>
            <p className="text-brand-muted text-sm mt-1">
              Your current attendance is {stats.percentage}%. Minimum 75% is required to appear for examinations.
              Attend all upcoming lectures to improve.
            </p>
          </div>
        </div>
      )}

      {/* Today's Live Schedule Card */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-brand-accent" />
            <h3 className="text-white font-semibold">
              Today's Class Schedule {todaySchedule.dayName ? `(${todaySchedule.dayName})` : ''}
            </h3>
            {todaySchedule.classes.length > 0 && (
              <span className="badge badge-active text-xs">
                {todaySchedule.classes.length} {todaySchedule.classes.length === 1 ? 'Lecture' : 'Lectures'}
              </span>
            )}
            {todaySchedule.isHoliday && (
              <span className="badge badge-pending text-xs">Weekly Off</span>
            )}
          </div>
          <button
            onClick={fetchTodaySchedule}
            className="btn-ghost btn-sm text-xs flex items-center gap-1.5"
            title="Refresh schedule"
          >
            <RefreshCw size={13} className={todaySchedule.loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {todaySchedule.loading ? (
          <div className="text-center py-8 text-brand-muted">
            <Loader2 className="animate-spin w-7 h-7 mx-auto mb-2 text-brand-accent" />
            <p className="text-xs">Fetching today's live classes…</p>
          </div>
        ) : todaySchedule.classes.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-brand-border/60 rounded-xl bg-brand-dark/40">
            <Clock size={32} className="mx-auto text-brand-muted mb-2 opacity-60" />
            <p className="text-white text-sm font-medium">No Lectures Scheduled Today</p>
            <p className="text-brand-muted text-xs mt-1">
              {todaySchedule.isHoliday ? 'Sunday is a weekly off.' : 'Check back later or view your weekly timetable.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {todaySchedule.classes.map((cls) => {
              const isOngoing = cls.status === 'ONGOING'
              const isAttended = cls.is_attended || cls.attendance_status === 'PRESENT'
              return (
                <div
                  key={cls.id || cls.timetable_id}
                  className={`p-4 rounded-xl border transition-all ${
                    isOngoing
                      ? 'border-green-500/60 bg-green-500/10 shadow-lg shadow-green-500/5 ring-1 ring-green-500/30'
                      : 'border-brand-border/70 bg-brand-dark/50 hover:border-brand-accent/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-mono font-bold text-brand-accent bg-brand-accent/15 px-2 py-0.5 rounded">
                      {cls.start_time?.slice(0, 5)} - {cls.end_time?.slice(0, 5)}
                    </span>
                    {isAttended ? (
                      <span className="badge badge-active text-[10px] flex items-center gap-1">
                        <CheckCircle size={10} /> Present
                      </span>
                    ) : isOngoing ? (
                      <span className="badge bg-green-500/20 text-green-400 border border-green-500/40 text-[10px] animate-pulse font-bold">
                        ● LIVE NOW
                      </span>
                    ) : (
                      <span className="badge badge-pending text-[10px]">
                        {cls.status || 'Upcoming'}
                      </span>
                    )}
                  </div>

                  <p className="text-white font-semibold text-sm line-clamp-1">
                    {cls.subject_name}
                  </p>
                  <p className="text-brand-muted text-xs mt-0.5">
                    {cls.subject_code ? `${cls.subject_code} · ` : ''}{cls.teacher_name || 'Assigned Faculty'}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-brand-border/40 text-xs">
                    <span className="text-brand-muted flex items-center gap-1">
                      📍 {cls.room_number || 'Room 101'} {cls.is_lab ? '(Lab)' : ''}
                    </span>
                    {isOngoing && !isAttended ? (
                      <button
                        onClick={() => navigate('/student/mark', { state: { lectureId: cls.id } })}
                        className="btn-primary !py-1 !px-2.5 !text-xs !bg-green-600 hover:!bg-green-500"
                      >
                        Check-In →
                      </button>
                    ) : isAttended ? (
                      <span className="text-green-400 text-xs font-medium">✓ Attended</span>
                    ) : (
                      <span className="text-brand-muted text-[11px]">Scheduled</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {quickActions.map(({ label, Icon, color, to, desc }) => (
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
            <ChevronRight size={18} className="text-brand-muted group-hover:text-brand-accent transition-colors mt-2" />
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <CalendarDays size={18} className="text-brand-accent" /> Recent Attendance
          </h3>
          <button
            onClick={() => navigate('/student/attendance')}
            className="btn-ghost btn-sm text-xs"
          >
            View all <ChevronRight size={14} />
          </button>
        </div>
        {statsLoading ? (
          <div className="text-center py-10 text-brand-muted"><Loader2 className="animate-spin w-8 h-8 mx-auto mb-2" /> Loading history…</div>
        ) : (data?.history?.length ?? 0) === 0 ? (
          <div className="text-center py-10">
            <CalendarDays size={36} className="mx-auto text-brand-muted mb-3" />
            <p className="text-white font-semibold">No lectures held yet</p>
            <p className="text-brand-muted text-sm mt-1">Lectures will appear here once your teacher starts them.</p>
          </div>
        ) : (
          <div className="divide-y divide-brand-border/60 max-h-80 overflow-y-auto">
            {(data.history || []).slice(0, 6).map(h => (
              <div key={h.lecture_id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  h.status === 'PRESENT' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                }`}>
                  {h.status === 'PRESENT' ? <ClipboardCheck size={18} /> : <AlertTriangle size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{h.subject} — {h.topic || 'Regular lecture'}</p>
                  <p className="text-brand-muted text-xs">
                    {h.date ? new Date(h.date).toLocaleDateString() : '—'} · {h.time || '—'} · {h.subject_code || ''}
                  </p>
                </div>
                <span className={`badge ${h.status === 'PRESENT' ? 'badge-active' : 'badge-rejected'}`}>{h.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MyAttendanceHistory() {
  const { data, loading } = useMyStats()
  const stats = data?.stats || {}
  const history = data?.history || []

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h2 className="page-title">My Attendance</h2>
        <p className="page-subtitle">Full history and percentage breakdown</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Overall %" value={`${stats.percentage ?? 0}%`} Icon={TrendingUp}
          color={(stats.percentage ?? 0) >= 75 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}
          safeFlag={stats.is_safe} />
        <StatCard label="Total Lectures" value={stats.total_lectures ?? 0} Icon={CalendarDays} color="bg-blue-500/20 text-blue-400" />
        <StatCard label="Present" value={stats.attended ?? 0} Icon={ClipboardCheck} color="bg-green-500/20 text-green-400" />
        <StatCard label="Absent" value={(stats.total_lectures ?? 0) - (stats.attended ?? 0)} Icon={AlertTriangle} color="bg-red-500/20 text-red-400" />
      </div>

      <div className="card">
        <h3 className="text-white font-semibold mb-4">Attendance History</h3>
        {loading ? (
          <div className="text-center py-16 text-brand-muted"><Loader2 className="animate-spin w-8 h-8 mx-auto mb-2" /> Loading…</div>
        ) : history.length === 0 ? (
          <div className="text-center py-16">
            <CalendarDays size={40} className="mx-auto text-brand-muted mb-3" />
            <p className="text-white font-semibold">No lectures yet</p>
            <p className="text-brand-muted text-sm mt-1">Check back after your teacher starts a lecture session.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Subject</th>
                  <th>Code</th>
                  <th>Topic</th>
                  <th className="text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.lecture_id}>
                    <td>{h.date ? new Date(h.date).toLocaleDateString() : '—'}</td>
                    <td>{h.time || '—'}</td>
                    <td className="font-medium text-white">{h.subject}</td>
                    <td className="text-brand-muted">{h.subject_code || '—'}</td>
                    <td className="max-w-xs truncate" title={h.topic || ''}>{h.topic || '—'}</td>
                    <td className="text-right">
                      <span className={`badge ${h.status === 'PRESENT' ? 'badge-active' : 'badge-rejected'}`}>{h.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StudentSubjectReports() {
  const [statsData, setStatsData] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    try {
      const { data } = await api.get('/attendance/my-stats')
      setStatsData(data?.data || null)
    } catch {
      toast.error('Failed to load attendance metrics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // Group lectures by subject
  const subjectMap = {}
  if (statsData?.history) {
    statsData.history.forEach((l) => {
      const key = l.subject || 'General'
      if (!subjectMap[key]) {
        subjectMap[key] = {
          subject: key,
          code: l.subject_code || '',
          total: 0,
          attended: 0,
        }
      }
      subjectMap[key].total++
      if (l.status === 'PRESENT') subjectMap[key].attended++
    })
  }

  const subjects = Object.values(subjectMap).map((s) => {
    const pct = s.total > 0 ? Math.round((s.attended / s.total) * 100) : 100
    const needed = pct < 75 ? Math.ceil((0.75 * s.total - s.attended) / 0.25) : 0
    return { ...s, pct, needed }
  })

  return (
    <div className="animate-fade-in">
      <div className="page-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Subject-Wise Attendance Reports</h2>
          <p className="page-subtitle">Track your attendance threshold (Minimum 75% required by college)</p>
        </div>
        <button onClick={loadData} className="btn btn-ghost btn-sm flex items-center gap-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin w-8 h-8 text-brand-accent" />
        </div>
      ) : subjects.length === 0 ? (
        <div className="card text-center py-16">
          <BookOpen size={40} className="mx-auto text-brand-muted mb-3" />
          <p className="text-white font-semibold">No subject lectures recorded yet</p>
          <p className="text-brand-muted text-sm mt-1">
            Once lectures are conducted and attendance is marked, subject analytics will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map((sub) => {
              const isSafe = sub.pct >= 75
              return (
                <div
                  key={sub.subject}
                  className="card flex flex-col justify-between hover:border-brand-accent/40 transition-colors"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-white font-semibold text-base leading-tight">{sub.subject}</h4>
                      {sub.code && <span className="badge badge-info text-[10px] font-mono">{sub.code}</span>}
                    </div>
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-2xl font-bold text-white">{sub.pct}%</span>
                      <span className={`badge text-[10px] ${isSafe ? 'badge-active' : 'badge-rejected'}`}>
                        {isSafe ? '✓ Safe' : '⚠️ Defaulter (<75%)'}
                      </span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-3">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isSafe ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(100, sub.pct)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-brand-muted">
                      <span>Attended: <strong className="text-white">{sub.attended}</strong></span>
                      <span>Total Lectures: <strong className="text-white">{sub.total}</strong></span>
                    </div>
                  </div>
                  {!isSafe && sub.needed > 0 && (
                    <div className="mt-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-300 flex items-start gap-1.5">
                      <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                      <span>
                        Attend next <strong>{sub.needed}</strong> consecutive lectures to reach 75% safe attendance.
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function StudentAnnouncements() {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchAnnouncements() {
    setLoading(true)
    try {
      const { data } = await api.get('/announcements')
      setAnnouncements(data?.data?.announcements || [])
    } catch {
      toast.error('Failed to load notices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">College Notices & Announcements</h2>
          <p className="page-subtitle">Official announcements from college administration and faculty</p>
        </div>
        <button onClick={fetchAnnouncements} className="btn btn-ghost btn-sm flex items-center gap-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin w-8 h-8 text-brand-accent" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="card text-center py-16">
          <Megaphone size={40} className="mx-auto text-brand-muted mb-3" />
          <p className="text-white font-semibold">No announcements currently</p>
          <p className="text-brand-muted text-sm mt-1">Check back later for exam dates, timetables, and college notices.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="card hover:border-brand-accent/40 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-brand-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bell size={18} className="text-brand-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="text-white font-semibold text-base">{a.title}</h4>
                    <span className="badge badge-info text-xs">{a.target_type}</span>
                  </div>
                  <p className="text-brand-muted text-sm whitespace-pre-line leading-relaxed">{a.content}</p>

                  {/* Document & Image Attachments */}
                  {a.attachments && a.attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {a.attachments.map((att, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl max-w-sm hover:border-brand-accent/40 transition-colors"
                        >
                          {att.file_type === 'IMAGE' ? (
                            <ImageIcon size={16} className="text-emerald-400 flex-shrink-0" />
                          ) : (
                            <FileText size={16} className="text-blue-400 flex-shrink-0" />
                          )}
                          <span className="text-xs text-white font-medium truncate flex-1" title={att.file_name}>
                            {att.file_name}
                          </span>
                          <a
                            href={att.file_url}
                            download={att.file_name}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary !py-1 !px-2.5 text-[11px] flex items-center gap-1 text-brand-accent hover:text-white"
                            title="Download document / image"
                          >
                            <Download size={12} />
                            <span>Download</span>
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-3 text-xs text-brand-muted">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(a.created_at).toLocaleString('en-IN')}
                    </span>
                    {a.sent_by_user?.name && (
                      <span>by {a.sent_by_user.name}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const SubPageLoader = () => (
  <div className="flex justify-center items-center py-24">
    <Loader2 className="animate-spin w-8 h-8 text-brand-accent" />
  </div>
)

export default function StudentDashboard() {
  return (
    <DashboardLayout>
      <Suspense fallback={<SubPageLoader />}>
        <Routes>
          <Route index element={<StudentOverview />} />
          <Route path="mark" element={<StudentMarkAttendance />} />
          <Route path="attendance" element={<MyAttendanceHistory />} />
          <Route path="reports" element={<StudentSubjectReports />} />
          <Route path="announce" element={<StudentAnnouncements />} />
          <Route path="*" element={<Navigate to="/student" replace />} />
        </Routes>
      </Suspense>
    </DashboardLayout>
  )
}
