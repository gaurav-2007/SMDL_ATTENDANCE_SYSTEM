import { useEffect, useState, memo, lazy, Suspense, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import api from '../../lib/api'
import {
  ClipboardList, UserCheck, FileText, MessageSquare,
  ClipboardCheck, BookOpen, AlertTriangle, TrendingUp,
  CalendarDays, ChevronRight, Loader2, Bell, Megaphone, Clock, RefreshCw,
  Download, Image as ImageIcon, CheckCircle, XCircle, ArrowRight, Sparkles, MapPin,
  User
} from 'lucide-react'
import toast from 'react-hot-toast'
import { openAttachment, downloadAttachment, shareAttachmentWhatsApp } from '../../utils/attachmentHelper'
import { Eye } from 'lucide-react'
import UserProfileModal from '../../components/profile/UserProfileModal'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Badge, Button, ProgressRing, StatCard as UIStatCard,
  Skeleton, EmptyState, Modal
} from '../../components/ui'

// Lazy-load heavy mark attendance component to reduce initial bundle
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

// Reusable Metric Card matching academic design tokens
const MetricCard = memo(function MetricCard({ label, value, subline, Icon, variant = 'neutral', safeFlag, navigateTo, onClick }) {
  const navigate = useNavigate()
  const handleClick = onClick || (navigateTo ? () => navigate(navigateTo) : undefined)
  const cursorClass = handleClick ? 'cursor-pointer hover:border-brand/40 group' : ''

  return (
    <Card hoverable={!!handleClick} onClick={handleClick} className={`p-4 sm:p-5 flex items-center gap-4 ${cursorClass}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
        variant === 'present'
          ? 'bg-present/10 text-present border-present/20'
          : variant === 'absent'
          ? 'bg-absent/10 text-absent border-absent/20'
          : variant === 'grace'
          ? 'bg-grace/10 text-grace border-grace/20'
          : variant === 'brand'
          ? 'bg-brand/10 text-brand border-brand/20'
          : 'bg-bg text-muted border-line'
      }`}>
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted truncate">{label}</p>
        <div className="flex items-baseline gap-2 mt-0.5">
          <p className="text-xl sm:text-2xl font-bold font-display text-ink tabular-nums">{value}</p>
          {safeFlag != null && (
            <Badge variant={safeFlag ? 'present' : 'absent'} size="sm">
              {safeFlag ? 'Safe' : '< 75%'}
            </Badge>
          )}
        </div>
        {subline && <p className="text-[11px] text-muted mt-0.5 truncate">{subline}</p>}
      </div>

      {navigateTo && (
        <ChevronRight className="w-4 h-4 text-muted group-hover:text-brand transition-colors shrink-0" />
      )}
    </Card>
  )
})

function StudentOverview() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, loading: statsLoading, subjectCount } = useMyStats()
  const stats = data?.stats || {}
  const info = data?.student_info || {}
  const [profileModalOpen, setProfileModalOpen] = useState(false)

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

  // Find active lecture if attendance window is currently open
  const activeLecture = todaySchedule.classes.find(cls => !!cls.can_mark_attendance && !cls.is_attended && cls.attendance_status !== 'PRESENT')

  const quickActions = [
    { label: 'Mark Present Now',    Icon: UserCheck,     variant: 'present', to: '/student/mark',       desc: 'GPS + Selfie check-in' },
    { label: 'My Attendance',       Icon: ClipboardList, variant: 'brand',   to: '/student/attendance', desc: 'History & percentage' },
    { label: 'Reports & Analytics', Icon: FileText,      variant: 'grace',   to: '/student/reports',    desc: 'Subject-wise breakdown' },
    { label: 'Announcements',       Icon: MessageSquare, variant: 'neutral', to: '/student/announce',   desc: 'Official college notices' },
  ]

  const overallPct = stats.percentage ?? 0
  const isSafe = overallPct >= 75

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── HEADER / GREETING ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-line">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-ink tracking-tight flex items-center gap-2">
            <span>Welcome, {user?.name?.split(' ')[0] || 'Student'}</span>
            <span className="text-lg">👋</span>
          </h2>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            Roll No: <span className="font-semibold text-ink">{info.roll_number || user?.roll_number || '—'}</span> · {info.course || user?.class || ''} {info.division || user?.division ? `(${info.division || user?.division})` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={isSafe ? 'present' : 'absent'} size="md">
            {isSafe ? 'Status: Safe (≥75%)' : 'Status: Defaulter (<75%)'}
          </Badge>
        </div>
      </div>

      {/* ── LIVE LECTURE NOW HERO CARD (Only visible when attendance window is active) ── */}
      {activeLecture && (
        <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-500/50 rounded-xl p-4 sm:p-5 shadow-sm transition-all duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge variant="live" pulseDot size="sm">
                  LIVE LECTURE OPEN
                </Badge>
                <span className="text-xs font-mono font-semibold text-emerald-800 dark:text-emerald-300">
                  {activeLecture.start_time?.slice(0, 5)} - {activeLecture.end_time?.slice(0, 5)}
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-bold font-display text-ink leading-tight">
                {activeLecture.subject_name}
              </h3>

              <p className="text-xs text-muted flex items-center gap-2 flex-wrap">
                <span>{activeLecture.teacher_name || 'Faculty'}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-muted" />
                  Room {activeLecture.room_number || '101'} {activeLecture.is_lab ? '(Lab)' : ''}
                </span>
              </p>
            </div>

            <Button
              variant="success"
              size="lg"
              onClick={() => navigate('/student/mark', { state: { lectureId: activeLecture.id } })}
              className="shrink-0 shadow-md font-semibold"
            >
              <UserCheck className="w-5 h-5 mr-1" />
              <span>Mark Attendance Now</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ── ATTENDANCE OVERVIEW & METRICS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Visual Progress Gauge Card */}
        <Card className="p-5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Overall Attendance</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-display text-ink tabular-nums">
                {statsLoading ? '—' : `${overallPct}%`}
              </span>
              <Badge variant={isSafe ? 'present' : 'absent'} size="sm">
                {isSafe ? 'Eligible for Exams' : 'Low Attendance'}
              </Badge>
            </div>
            <p className="text-xs text-muted pt-1">
              {stats.attended ?? 0} attended of {stats.total_lectures ?? 0} total sessions
            </p>
          </div>

          <div className="shrink-0">
            <ProgressRing
              percentage={overallPct}
              size={86}
              strokeWidth={7}
            />
          </div>
        </Card>

        {/* 2 Stat Cards */}
        <MetricCard
          label="Lectures Attended"
          value={statsLoading ? '—' : `${stats.attended ?? 0}/${stats.total_lectures ?? 0}`}
          subline="Current Semester"
          Icon={ClipboardCheck}
          variant="brand"
          navigateTo="/student/attendance"
        />

        <MetricCard
          label="Enrolled Subjects"
          value={subjectCount || '—'}
          subline="Active Course Curriculum"
          Icon={BookOpen}
          variant="neutral"
          navigateTo="/student/reports"
        />
      </div>

      {/* ── CRITICAL ATTENDANCE ALERT (If below 75%) ── */}
      {overallPct < 75 && !statsLoading && (
        <div className="bg-red-50/80 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-absent shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <p className="font-semibold text-absent">Attendance Below 75% Examination Threshold</p>
            <p className="text-muted mt-0.5 leading-relaxed">
              Your overall attendance is currently <strong className="text-ink">{overallPct}%</strong>. A minimum of 75% is strictly required as per college guidelines to appear for term-end semester exams. Please attend upcoming lectures to maintain compliance.
            </p>
          </div>
        </div>
      )}

      {/* ── TODAY'S CLASS SCHEDULE ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand" />
            <CardTitle className="text-base">
              Today's Classes {todaySchedule.dayName ? `(${todaySchedule.dayName})` : ''}
            </CardTitle>
            {todaySchedule.classes.length > 0 && (
              <Badge variant="neutral" size="sm">
                {todaySchedule.classes.length} {todaySchedule.classes.length === 1 ? 'Lecture' : 'Lectures'}
              </Badge>
            )}
            {todaySchedule.isHoliday && (
              <Badge variant="grace" size="sm">Weekly Off</Badge>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchTodaySchedule}
            className="text-xs h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${todaySchedule.loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </CardHeader>

        <CardContent>
          {todaySchedule.loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
          ) : todaySchedule.classes.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No Lectures Scheduled Today"
              description={todaySchedule.isHoliday ? 'Sunday is a weekly off.' : 'No active sessions scheduled for your division today.'}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {todaySchedule.classes.map((cls) => {
                const isWindowOpen = !!cls.can_mark_attendance
                const isAttended = cls.is_attended || cls.attendance_status === 'PRESENT'
                return (
                  <div
                    key={cls.id || cls.timetable_id}
                    className={`p-4 rounded-xl border transition-all text-left flex flex-col justify-between gap-3 ${
                      isWindowOpen
                        ? 'border-present/50 bg-present/5 shadow-xs'
                        : 'border-line bg-surface hover:bg-bg/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="text-xs font-mono font-semibold text-muted bg-bg border border-line px-2 py-0.5 rounded">
                          {cls.start_time?.slice(0, 5)} - {cls.end_time?.slice(0, 5)}
                        </span>
                        {isAttended ? (
                          <Badge variant="present" size="sm">
                            <CheckCircle className="w-3 h-3 mr-0.5" /> Present
                          </Badge>
                        ) : isWindowOpen ? (
                          <Badge variant="live" pulseDot size="sm">
                            LIVE
                          </Badge>
                        ) : (
                          <Badge variant="neutral" size="sm">
                            {cls.status === 'COMPLETED' ? 'Closed' : (cls.status || 'Upcoming')}
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm font-semibold text-ink leading-snug line-clamp-1">
                        {cls.subject_name}
                      </p>
                      <p className="text-xs text-muted mt-0.5 truncate">
                        {cls.subject_code ? `${cls.subject_code} · ` : ''}{cls.teacher_name || 'Assigned Faculty'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-line text-xs">
                      <span className="text-muted flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-muted" />
                        Room {cls.room_number || '101'} {cls.is_lab ? '(Lab)' : ''}
                      </span>
                      {isWindowOpen && !isAttended ? (
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => navigate('/student/mark', { state: { lectureId: cls.id } })}
                          className="h-7 text-xs px-2.5"
                        >
                          Check-In →
                        </Button>
                      ) : isAttended ? (
                        <span className="text-present font-medium text-xs">✓ Recorded</span>
                      ) : (
                        <span className="text-muted text-[11px]">{cls.status === 'COMPLETED' ? 'Session Over' : 'Scheduled'}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── QUICK NAVIGATION ACTIONS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {quickActions.map(({ label, Icon, variant, to, desc }) => (
          <Card
            key={label}
            hoverable
            onClick={() => navigate(to)}
            className="p-4 flex items-start gap-3.5 cursor-pointer group"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
              variant === 'present'
                ? 'bg-present/10 text-present border-present/20'
                : variant === 'brand'
                ? 'bg-brand/10 text-brand border-brand/20'
                : variant === 'grace'
                ? 'bg-grace/10 text-grace border-grace/20'
                : 'bg-bg text-muted border-line'
            }`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink group-hover:text-brand transition-colors truncate">
                {label}
              </p>
              <p className="text-xs text-muted mt-0.5 truncate">{desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted group-hover:text-brand transition-colors shrink-0 mt-1" />
          </Card>
        ))}
      </div>

      {/* ── RECENT ATTENDANCE HISTORY LIST ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-brand" />
            <CardTitle className="text-base">Recent Attendance History</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/student/attendance')}
            className="text-xs h-8"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </CardHeader>

        <CardContent>
          {statsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ) : (data?.history?.length ?? 0) === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No Lectures Recorded Yet"
              description="Your attendance entries will appear here as soon as lectures are conducted."
            />
          ) : (
            <div className="divide-y divide-line">
              {(data.history || []).slice(0, 5).map(h => {
                const isPresent = h.status === 'PRESENT'
                return (
                  <div key={h.lecture_id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                        isPresent
                          ? 'bg-present/10 text-present border-present/20'
                          : 'bg-absent/10 text-absent border-absent/20'
                      }`}>
                        {isPresent ? <ClipboardCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink truncate">
                          {h.subject} <span className="text-muted font-normal text-xs">— {h.topic || 'Regular session'}</span>
                        </p>
                        <p className="text-xs text-muted mt-0.5 truncate">
                          {h.date ? new Date(h.date).toLocaleDateString() : '—'} · {h.time || '—'} {h.subject_code ? `· ${h.subject_code}` : ''}
                        </p>
                      </div>
                    </div>

                    <Badge variant={isPresent ? 'present' : 'absent'} size="sm" className="shrink-0">
                      {isPresent ? 'Present' : 'Absent'}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Student Profile Modal */}
      <UserProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={user}
        stats={{ percentage: overallPct, attended: stats.attended, total_lectures: stats.total_lectures }}
      />
    </div>
  )
}

function MyAttendanceHistory() {
  const { data, loading } = useMyStats()
  const stats = data?.stats || {}
  const history = data?.history || []

  const total = stats.total_lectures ?? 0
  const attended = stats.attended ?? 0
  const absent = total - attended

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="pb-2 border-b border-line">
        <h2 className="text-xl sm:text-2xl font-bold font-display text-ink tracking-tight">My Attendance History</h2>
        <p className="text-xs sm:text-sm text-muted mt-0.5">Complete record of your lecture attendance and attendance %</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          label="Overall %"
          value={`${stats.percentage ?? 0}%`}
          Icon={TrendingUp}
          variant={(stats.percentage ?? 0) >= 75 ? 'present' : 'absent'}
          safeFlag={stats.is_safe}
        />
        <MetricCard label="Total Lectures" value={total} Icon={CalendarDays} variant="brand" />
        <MetricCard label="Present" value={attended} Icon={ClipboardCheck} variant="present" />
        <MetricCard label="Absent" value={absent} Icon={AlertTriangle} variant="absent" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session Records</CardTitle>
          <CardDescription>All marked lectures in chronological sequence</CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ) : history.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={CalendarDays}
                title="No Attendance Records"
                description="Records will display here once your teachers start conducting lectures."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-line bg-bg/50 text-muted font-semibold text-xs">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4 hidden sm:table-cell">Code</th>
                    <th className="py-3 px-4 hidden md:table-cell">Topic</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {history.map(h => {
                    const isPresent = h.status === 'PRESENT'
                    return (
                      <tr key={h.lecture_id} className="hover:bg-bg/40 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-medium text-ink">{h.date ? new Date(h.date).toLocaleDateString() : '—'}</p>
                          <p className="text-xs text-muted">{h.time || '—'}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-ink">{h.subject}</p>
                          <p className="text-xs text-muted sm:hidden">{h.subject_code}</p>
                        </td>
                        <td className="py-3 px-4 text-muted font-mono hidden sm:table-cell">
                          {h.subject_code || '—'}
                        </td>
                        <td className="py-3 px-4 text-muted max-w-xs truncate hidden md:table-cell" title={h.topic || ''}>
                          {h.topic || '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Badge variant={isPresent ? 'present' : 'absent'} size="sm">
                            {isPresent ? 'Present' : 'Absent'}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
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
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-line">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-ink tracking-tight">Subject-Wise Reports</h2>
          <p className="text-xs sm:text-sm text-muted mt-0.5">Track individual subject thresholds (Minimum 75% required)</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="h-8 self-start sm:self-auto">
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>
      ) : subjects.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={BookOpen}
            title="No Subject Lectures Recorded"
            description="Once lectures are conducted and attendance is taken, your subject analytics will appear here."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((sub) => {
            const isSafe = sub.pct >= 75
            return (
              <Card
                key={sub.subject}
                className="p-5 flex flex-col justify-between hover:border-line/80 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm sm:text-base font-semibold font-display text-ink leading-tight">
                      {sub.subject}
                    </h4>
                    {sub.code && <Badge variant="neutral" size="sm">{sub.code}</Badge>}
                  </div>

                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-2xl font-bold font-display text-ink tabular-nums">{sub.pct}%</span>
                    <Badge variant={isSafe ? 'present' : 'absent'} size="sm">
                      {isSafe ? 'Safe' : 'Low (<75%)'}
                    </Badge>
                  </div>

                  {/* Clean thin progress bar */}
                  <div className="h-2 bg-bg border border-line rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isSafe ? 'bg-present' : 'bg-absent'
                      }`}
                      style={{ width: `${Math.min(100, sub.pct)}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-muted">
                    <span>Attended: <strong className="text-ink">{sub.attended}</strong></span>
                    <span>Total Sessions: <strong className="text-ink">{sub.total}</strong></span>
                  </div>
                </div>

                {!isSafe && sub.needed > 0 && (
                  <div className="mt-4 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-absent flex items-start gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Attend next <strong>{sub.needed}</strong> consecutive lectures to reach safe 75%.
                    </span>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}


function WhatsAppIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
    </svg>
  );
}

function StudentAnnouncements() {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeAttachment, setActiveAttachment] = useState(null)

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
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-line">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-ink tracking-tight">College Notices</h2>
          <p className="text-xs sm:text-sm text-muted mt-0.5">Official circulars and announcements from college administration and faculty</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAnnouncements} className="h-8 self-start sm:self-auto">
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : announcements.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={Megaphone}
            title="No Notices Currently"
            description="Official announcements, schedules, and circulars will be published here."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card key={a.id} className="p-4 sm:p-5">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-9 h-9 rounded-lg bg-brand/10 border border-brand/20 text-brand flex items-center justify-center shrink-0 mt-0.5">
                  <Bell className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="text-sm sm:text-base font-semibold font-display text-ink">{a.title}</h4>
                    {a.target_type && <Badge variant="neutral" size="sm">{a.target_type}</Badge>}
                  </div>

                  <p className="text-xs sm:text-sm text-muted whitespace-pre-line leading-relaxed">{a.content}</p>

                  {/* Attachment Downloads — Responsive & No Overflow */}
                  {a.attachments && a.attachments.length > 0 && (
                    <div className="mt-3.5 space-y-2 w-full max-w-full">
                      {a.attachments.map((att, i) => {
                        const isImg = att.file_type === 'IMAGE' || att.file_url?.startsWith('data:image/') || (att.file_name && att.file_name.match(/\.(png|jpe?g|webp|gif)$/i))
                        return (
                          <div
                            key={i}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 sm:p-3 bg-bg border border-line hover:border-brand/40 rounded-xl w-full max-w-full overflow-hidden transition-all shadow-2xs group"
                          >
                            {/* Left: Thumbnail & Name */}
                            <div
                              className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                              onClick={() => setActiveAttachment({ ...att, announcementTitle: a.title })}
                              title="Click to view full photo / document"
                            >
                              {isImg && att.file_url ? (
                                <div className="w-10 h-10 rounded-lg overflow-hidden border border-line shrink-0 bg-neutral-100 dark:bg-neutral-800 shadow-2xs group-hover:scale-105 transition-transform">
                                  <img src={att.file_url} alt={att.file_name} className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
                                  <FileText size={18} />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs sm:text-sm font-semibold text-ink group-hover:text-brand transition-colors truncate leading-tight">
                                  {att.file_name}
                                </p>
                                <p className="text-[11px] text-muted font-mono flex items-center gap-1.5 mt-0.5">
                                  <span>{att.file_type || (isImg ? 'Photo' : 'PDF')}</span>
                                  <span>•</span>
                                  <span className="text-brand font-medium">Tap to view</span>
                                </p>
                              </div>
                            </div>

                            {/* Right: Quick Action Buttons */}
                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                              <button
                                type="button"
                                onClick={() => setActiveAttachment({ ...att, announcementTitle: a.title })}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line bg-surface hover:bg-bg text-ink text-xs font-medium cursor-pointer shadow-2xs active:scale-95 transition-all"
                                title="View inside app"
                              >
                                <Eye size={12} className="text-muted" />
                                <span>View</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  shareAttachmentWhatsApp(att, a.title)
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold cursor-pointer shadow-2xs hover:bg-emerald-100 dark:hover:bg-emerald-900/40 active:scale-95 transition-all"
                                title="Share on WhatsApp"
                              >
                                <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Share</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  downloadAttachment(att.file_url, att.file_name)
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-brand/30 bg-brand/10 hover:bg-brand/20 text-brand text-xs font-semibold cursor-pointer shadow-2xs active:scale-95 transition-all"
                                title="Save to device"
                              >
                                <Download size={12} />
                                <span>Save</span>
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-3 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(a.created_at).toLocaleString('en-IN')}
                    </span>
                    {a.sent_by_user?.name && (
                      <span>by {a.sent_by_user.name}</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Notice Attachment Lightbox & Actions Modal */}
      <Modal
        isOpen={Boolean(activeAttachment)}
        onClose={() => setActiveAttachment(null)}
        title={activeAttachment?.file_name || 'Notice Attachment'}
        description="View, download, or share circular document / image"
        size="lg"
      >
        <div className="space-y-4">
          <div className="rounded-xl overflow-hidden border border-line bg-black/5 max-h-[65vh] flex items-center justify-center p-2">
            {activeAttachment?.file_url?.startsWith('data:image/') || activeAttachment?.file_type === 'IMAGE' || (activeAttachment?.file_name && activeAttachment.file_name.match(/\.(png|jpe?g|webp|gif)$/i)) ? (
              <img
                src={activeAttachment.file_url}
                alt={activeAttachment.file_name}
                className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-sm"
              />
            ) : (
              <div className="p-8 text-center space-y-2">
                <FileText className="w-12 h-12 text-brand mx-auto" />
                <p className="text-sm font-semibold text-ink">{activeAttachment?.file_name}</p>
                <p className="text-xs text-muted">Tap Save / Download below to open and save this file on your device.</p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-line">
            <span className="text-xs text-muted font-mono truncate max-w-full sm:max-w-[200px]">
              {activeAttachment?.file_name}
            </span>
            <div className="flex items-center gap-2 flex-wrap justify-end w-full sm:w-auto">
              <button
                type="button"
                onClick={() => shareAttachmentWhatsApp(activeAttachment, activeAttachment?.announcementTitle || activeAttachment?.file_name)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-xs active:scale-95 transition-all"
                title="Share on WhatsApp"
              >
                <WhatsAppIcon className="w-4 h-4 text-white" />
                <span>WhatsApp Share</span>
              </button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => downloadAttachment(activeAttachment.file_url, activeAttachment.file_name)}
                className="gap-1.5 font-semibold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save / Download</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveAttachment(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

const SubPageLoader = () => (
  <div className="flex justify-center items-center py-24">
    <Loader2 className="animate-spin w-8 h-8 text-brand" />
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
