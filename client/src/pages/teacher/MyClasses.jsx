import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  BookOpen, Users, Play, Bell, RefreshCw,
  GraduationCap, Clock, ChevronRight, Loader2,
  Calendar, CheckCircle2, AlertCircle, Sparkles,
  Layers, Table, Filter, Award, ArrowUpRight, Flame
} from 'lucide-react'
import api from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Badge, Button, StatCard, Skeleton, EmptyState
} from '../../components/ui'

const DAY_KEYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function MyClasses() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState('today') // 'today' | 'timetable' | 'subjects'
  const [selectedDay, setSelectedDay] = useState(DAY_KEYS[new Date().getDay()])
  const [filterMyOnly, setFilterMyOnly] = useState(true)

  const [todayData, setTodayData] = useState(null)
  const [timetableMatrix, setTimetableMatrix] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [divisions, setDivisions] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentTimeStr, setCurrentTimeStr] = useState('')

  // Live Clock (IST)
  useEffect(() => {
    function updateClock() {
      const now = new Date()
      setCurrentTimeStr(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }))
    }
    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [])

  // Load all data
  async function loadData() {
    setLoading(true)
    try {
      const [todayRes, ttRes, sRes, dRes] = await Promise.allSettled([
        api.get('/lectures/today'),
        api.get('/lectures/timetable'),
        api.get('/academic/subjects'),
        api.get('/academic/divisions'),
      ])

      if (todayRes.status === 'fulfilled') {
        setTodayData(todayRes.value?.data?.data || null)
      }
      if (ttRes.status === 'fulfilled') {
        setTimetableMatrix(ttRes.value?.data?.data?.matrix || null)
      }
      if (sRes.status === 'fulfilled') {
        setSubjects(sRes.value?.data?.data?.subjects || [])
      }
      if (dRes.status === 'fulfilled') {
        setDivisions(dRes.value?.data?.data?.divisions || [])
      }
    } catch {
      toast.error('Failed to load classes and schedule')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const todayActualDay = DAY_KEYS[new Date().getDay()]
  const isViewingToday = selectedDay === todayActualDay

  // Filter lectures for the selected day from the timetable matrix
  const daySchedule = timetableMatrix?.weekly_schedule?.[selectedDay] || []

  // Check if a timetable item belongs to current teacher
  const isTeacherLecture = (item) => {
    if (!user?.name) return false
    const uName = user.name.toLowerCase()
    const tName = (item.teacher || '').toLowerCase()
    const coName = (item.co_teacher || '').toLowerCase()
    return tName.includes(uName) || uName.includes(tName.split(' ')[0]) || coName.includes(uName)
  }

  // Filtered day schedule
  const displayedSchedule = filterMyOnly
    ? daySchedule.filter(isTeacherLecture)
    : daySchedule

  // If viewing today, use real DB lectures with live statuses
  const todayLectures = (filterMyOnly ? todayData?.my_lectures : todayData?.all_lectures) || []
  // If viewing a simulated/different day, generate simulated slots from timetable matrix
  const effectiveDayLectures = isViewingToday
    ? todayLectures
    : displayedSchedule.map((item) => {
        const slot = timetableMatrix?.time_slots?.find((s) => s.slot_id === item.slot_id)
        return {
          id: `sim-${item.code}-${slot?.slot_id}`,
          start_time: slot?.start_time || '08:00:00',
          end_time: slot?.end_time || '09:00:00',
          topic: `${item.name} (${item.type})`,
          status: 'SCHEDULED',
          subject: { code: item.code, name: item.name },
          teacher: { full_name: item.teacher },
          is_simulated: true,
        }
      })

  const currentOngoing = todayLectures.find((l) => l.status === 'ONGOING')

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Banner & Header */}
      <Card className="p-5 sm:p-6 border-line bg-surface shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge variant="brand" size="sm">
                SMDL College • Department of Computer Science
              </Badge>
              <Badge variant="neutral" size="sm">
                NEP 2026-27
              </Badge>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-ink tracking-tight flex items-center gap-2">
              <span>Classroom Schedule & Lecture Planner</span>
              <Sparkles size={20} className="text-amber-500 shrink-0" />
            </h1>
            <p className="text-xs sm:text-sm text-muted mt-1 flex items-center gap-2">
              <span>F.Y.BSc (Computer Science) - Semester I</span>
              <span>•</span>
              <span className="text-ink font-semibold">{user?.name || 'Faculty Member'}</span>
            </p>
          </div>

          {/* Real-time Clock Card */}
          <div className="flex items-center gap-2.5">
            <div className="px-3.5 py-2 rounded-xl border border-line bg-bg text-right shadow-2xs">
              <p className="text-[11px] text-muted font-medium flex items-center justify-end gap-1">
                <Clock size={12} className="text-brand shrink-0" />
                <span>IST Clock</span>
              </p>
              <p className="text-lg font-mono font-bold text-ink tracking-tight mt-0.5">
                {currentTimeStr || '--:--:--'}
              </p>
            </div>
            <Button
              onClick={loadData}
              disabled={loading}
              variant="outline"
              size="sm"
              className="p-2.5"
              title="Refresh schedule"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>

        {/* Tab Navigation & Scope Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-5 border-t border-line">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-bg rounded-lg border border-line">
            <button
              onClick={() => setActiveTab('today')}
              type="button"
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'today'
                  ? 'bg-surface text-ink font-semibold shadow-xs border border-line'
                  : 'text-muted hover:text-ink hover:bg-surface/50'
              }`}
            >
              <Calendar size={14} />
              <span>Today's Schedule</span>
              {currentOngoing && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('timetable')}
              type="button"
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'timetable'
                  ? 'bg-surface text-ink font-semibold shadow-xs border border-line'
                  : 'text-muted hover:text-ink hover:bg-surface/50'
              }`}
            >
              <Table size={14} />
              <span>Weekly Timetable Matrix</span>
            </button>

            <button
              onClick={() => setActiveTab('subjects')}
              type="button"
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'subjects'
                  ? 'bg-surface text-ink font-semibold shadow-xs border border-line'
                  : 'text-muted hover:text-ink hover:bg-surface/50'
              }`}
            >
              <Layers size={14} />
              <span>Curriculum & Subjects</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-brand/10 text-brand font-semibold">
                {subjects.length}
              </span>
            </button>
          </div>

          {/* Teacher Scope Filter */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterMyOnly(!filterMyOnly)}
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border cursor-pointer ${
                filterMyOnly
                  ? 'border-brand/30 bg-brand/10 text-brand font-semibold'
                  : 'border-line bg-surface text-muted hover:text-ink'
              }`}
            >
              <Filter size={13} />
              <span>{filterMyOnly ? 'Showing: My Classes Only' : 'Showing: All CS Classes'}</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title={`Today's Load (${todayActualDay})`}
          label={`Today's Load (${todayActualDay})`}
          value={todayActualDay === 'Sunday' ? 'Off' : `${todayData?.my_lectures?.length || 0} Lectures`}
          subtitle="Scheduled for you"
          sub="Scheduled for you"
          icon={Calendar}
        />
        <StatCard
          title={currentOngoing ? 'Session In Progress' : 'Current Session Status'}
          label={currentOngoing ? 'Session In Progress' : 'Current Session Status'}
          value={currentOngoing ? (currentOngoing.subject?.code || 'Live Session') : 'No Active Slot'}
          subtitle={currentOngoing ? 'Active now' : 'Standby'}
          sub={currentOngoing ? 'Active now' : 'Standby'}
          icon={Flame}
        />
        <StatCard
          title="Cohort Degree Program"
          label="Cohort Degree Program"
          value="NEP Sem-I"
          subtitle="FY.BSc Computer Science"
          sub="FY.BSc Computer Science"
          icon={Award}
        />
        <StatCard
          title="College Operating Hours"
          label="College Operating Hours"
          value="08:00 – 13:30"
          subtitle="Regular timetable window"
          sub="Regular timetable window"
          icon={Clock}
        />
      </div>

      {loading ? (
        <Card className="p-8 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </Card>
      ) : (
        <>
          {/* ============================================================== */}
          {/* TAB 1: TODAY'S SCHEDULE (LIVE PLANNER) */}
          {/* ============================================================== */}
          {activeTab === 'today' && (
            <div className="space-y-6">
              {/* Day Selector Chips */}
              <Card className="p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted font-semibold">Select Day:</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {DAY_KEYS.filter((d) => d !== 'Sunday').map((day) => {
                        const isToday = day === todayActualDay
                        const isSelected = day === selectedDay
                        return (
                          <button
                            key={day}
                            onClick={() => setSelectedDay(day)}
                            type="button"
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer border ${
                              isSelected
                                ? 'bg-brand text-white border-brand font-semibold shadow-2xs'
                                : isToday
                                ? 'bg-brand/10 text-brand border-brand/30 font-semibold'
                                : 'bg-surface text-muted border-line hover:text-ink hover:bg-bg'
                            }`}
                          >
                            <span>{day.slice(0, 3)}</span>
                            {isToday && (
                              <span className="text-[10px] px-1 py-0.2 rounded bg-brand/20 text-brand uppercase font-mono font-bold">
                                Today
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {!isViewingToday && (
                    <button
                      onClick={() => setSelectedDay(todayActualDay)}
                      type="button"
                      className="text-xs text-brand hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <span>Back to Today ({todayActualDay})</span>
                    </button>
                  )}
                </div>
              </Card>

              {/* Ongoing Lecture Spotlight Banner */}
              {isViewingToday && currentOngoing && (
                <Card className="p-5 sm:p-6 border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-800 shadow-sm">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <Badge variant="live" pulseDot>
                          LIVE LECTURE IN PROGRESS NOW
                        </Badge>
                        <span className="text-muted text-xs font-mono font-medium">
                          {currentOngoing.start_time?.slice(0, 5)} – {currentOngoing.end_time?.slice(0, 5)}
                        </span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold font-display text-ink">
                        {currentOngoing.subject?.code}: {currentOngoing.subject?.name}
                      </h2>
                      <p className="text-xs sm:text-sm text-muted flex items-center gap-2.5">
                        <span className="flex items-center gap-1 text-ink font-medium">
                          <GraduationCap size={15} className="text-brand" />
                          <span>F.Y.BSc CS (NEP)</span>
                        </span>
                        <span>•</span>
                        <span>Faculty: <strong className="text-ink">{currentOngoing.teacher?.full_name}</strong></span>
                      </p>
                    </div>

                    <Button
                      onClick={() => navigate('/teacher/attendance', { state: { lectureId: currentOngoing.id } })}
                      variant="primary"
                      size="lg"
                      className="gap-2 font-semibold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Play size={16} className="fill-current" />
                      <span>Take Attendance & Live Roster</span>
                    </Button>
                  </div>
                </Card>
              )}

              {/* Lecture Timeline List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-ink text-base sm:text-lg flex items-center gap-2">
                    <Clock size={18} className="text-brand shrink-0" />
                    <span>
                      {selectedDay} Schedule{' '}
                      {isViewingToday ? `(Today • ${todayData?.date || ''})` : `(Timetable Preview)`}
                    </span>
                  </h3>
                  <span className="text-xs text-muted font-mono">
                    {effectiveDayLectures.length} {effectiveDayLectures.length === 1 ? 'Class' : 'Classes'} Scheduled
                  </span>
                </div>

                {selectedDay === 'Sunday' ? (
                  <EmptyState
                    icon={Calendar}
                    title="Sunday — Weekly Off / Holiday"
                    description="No academic lectures are scheduled on Sunday as per the college calendar."
                  />
                ) : effectiveDayLectures.length === 0 ? (
                  <EmptyState
                    icon={BookOpen}
                    title={`No Classes Scheduled For You on ${selectedDay}`}
                    description="You do not have any teaching slots assigned on this day, or switch the filter to 'All CS Classes' to view the full department schedule."
                    action={
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFilterMyOnly(false)}
                      >
                        View All CS Classes
                      </Button>
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {effectiveDayLectures.map((lec, idx) => {
                      const isOngoing = lec.status === 'ONGOING'
                      const isUpcoming = lec.status === 'UPCOMING'
                      const isCompleted = lec.status === 'COMPLETED'
                      const isPractical = lec.subject?.code?.includes('(P)') || lec.topic?.toLowerCase().includes('lab')

                      return (
                        <Card
                          key={lec.id || idx}
                          className={`p-4 sm:p-5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                            isOngoing ? 'border-brand bg-brand-50/20 dark:bg-brand-950/10 shadow-xs' : ''
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            {/* Time Badge */}
                            <div className="shrink-0 text-center px-3 py-2 rounded-xl bg-bg border border-line min-w-[95px]">
                              <p className="text-xs font-mono font-bold text-ink">
                                {lec.start_time?.slice(0, 5)}
                              </p>
                              <p className="text-[10px] text-muted font-mono">
                                to {lec.end_time?.slice(0, 5)}
                              </p>
                              <span className={`inline-block mt-1 text-[9px] uppercase px-1.5 py-0.2 rounded font-mono font-semibold ${
                                isPractical ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {isPractical ? 'Lab (P)' : 'Theory'}
                              </span>
                            </div>

                            {/* Details */}
                            <div>
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <Badge variant="brand" size="sm">
                                  {lec.subject?.code || 'CS-SUBJ'}
                                </Badge>
                                {isOngoing && (
                                  <Badge variant="live" pulseDot>
                                    ONGOING NOW
                                  </Badge>
                                )}
                                {isUpcoming && (
                                  <Badge variant="grace">
                                    UPCOMING
                                  </Badge>
                                )}
                                {isCompleted && (
                                  <Badge variant="neutral">
                                    COMPLETED
                                  </Badge>
                                )}
                              </div>

                              <h4 className="font-semibold text-ink text-base">
                                {lec.subject?.name || lec.topic || 'Subject'}
                              </h4>

                              <p className="text-muted text-xs mt-1 flex flex-wrap items-center gap-2">
                                <span className="flex items-center gap-1 font-medium text-ink">
                                  <GraduationCap size={13} className="text-brand shrink-0" />
                                  <span>F.Y.BSc (Computer Science) Div A</span>
                                </span>
                                <span>•</span>
                                <span>
                                  Teacher: <strong className="text-ink">{lec.teacher?.full_name || 'Assigned Faculty'}</strong>
                                </span>
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-line justify-end">
                            <Button
                              onClick={() => {
                                if (lec.is_simulated) {
                                  toast('Preview mode: lecture session will be active on ' + selectedDay, { icon: 'ℹ️' })
                                  return
                                }
                                navigate('/teacher/attendance', { state: { lectureId: lec.id } })
                              }}
                              variant={isOngoing ? 'primary' : 'outline'}
                              size="sm"
                              className="gap-1.5 text-xs font-semibold"
                            >
                              <Play size={13} />
                              <span>{isOngoing ? 'Live Roster' : 'Open Attendance'}</span>
                            </Button>

                            <Button
                              onClick={() => navigate('/teacher/announce')}
                              variant="ghost"
                              size="sm"
                              className="text-muted hover:text-ink p-2"
                              title="Send class announcement"
                            >
                              <Bell size={14} />
                            </Button>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: WEEKLY TIMETABLE MATRIX */}
          {/* ============================================================== */}
          {activeTab === 'timetable' && (
            <div className="space-y-4">
              <Card className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-ink text-base flex items-center gap-2">
                    <Table size={18} className="text-brand shrink-0" />
                    <span>Official College Timetable Matrix (2026-27)</span>
                  </h3>
                  <p className="text-muted text-xs mt-0.5">
                    SES's S. M. Dadasaheb Limaye College, Kalamboli — Department of Computer Science
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-brand/20 border border-brand" />
                    <span className="text-muted">Your Lectures</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-bg border border-line" />
                    <span className="text-muted">Other Faculty</span>
                  </div>
                </div>
              </Card>

              {/* Interactive Matrix Table */}
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-bg/60 border-b border-line">
                      <th className="p-3.5 font-bold text-muted uppercase tracking-wider text-[11px] w-28 sticky left-0 bg-surface z-10">
                        TIME
                      </th>
                      {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].map((day) => {
                        const isDayToday = day.toLowerCase() === todayActualDay.toLowerCase()
                        return (
                          <th
                            key={day}
                            className={`p-3.5 font-bold uppercase tracking-wider text-[11px] text-center min-w-[140px] ${
                              isDayToday
                                ? 'bg-brand/10 text-brand border-b-2 border-brand font-bold'
                                : 'text-ink'
                            }`}
                          >
                            <span>{day}</span>
                            {isDayToday && (
                              <span className="block text-[9px] font-normal tracking-normal text-brand font-mono">
                                (Today)
                              </span>
                            )}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-line">
                    {timetableMatrix?.time_slots?.map((slot) => {
                      if (slot.is_recess) {
                        return (
                          <tr key="recess" className="bg-amber-50/50 dark:bg-amber-950/20 text-center">
                            <td className="p-3 font-mono text-[11px] font-semibold text-amber-700 sticky left-0 bg-surface z-10 border-y border-amber-200">
                              {slot.label.split(' - ')[0]}
                            </td>
                            <td
                              colSpan={6}
                              className="p-3 font-bold text-amber-700 tracking-wider text-xs border-y border-amber-200 uppercase"
                            >
                              ✦ R E C E S S &nbsp; (11:00 AM – 11:30 AM) ✦
                            </td>
                          </tr>
                        )
                      }

                      return (
                        <tr key={slot.slot_id} className="hover:bg-bg/40 transition-colors">
                          <td className="p-3 font-mono text-[11px] font-semibold text-ink sticky left-0 bg-surface z-10 border-r border-line">
                            <div>{slot.label.split(' - ')[0]}</div>
                            <div className="text-[10px] text-muted font-normal">to {slot.label.split(' - ')[1]}</div>
                          </td>

                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => {
                            const dayItems = timetableMatrix?.weekly_schedule?.[day] || []
                            const item = dayItems.find((x) => x.slot_id === slot.slot_id)
                            const isMine = item && isTeacherLecture(item)
                            const isDayToday = day.toLowerCase() === todayActualDay.toLowerCase()

                            if (!item) {
                              return (
                                <td
                                  key={day}
                                  className={`p-3 text-center text-muted/40 font-mono text-xs ${
                                    isDayToday ? 'bg-brand/5' : ''
                                  }`}
                                >
                                  —
                                </td>
                              )
                            }

                            const isPractical = item.code.includes('(P)')

                            return (
                              <td
                                key={day}
                                className={`p-2.5 text-center transition-all ${
                                  isMine
                                    ? 'bg-brand/10 border-2 border-brand/50 rounded-lg shadow-2xs'
                                    : isDayToday
                                    ? 'bg-brand/5'
                                    : ''
                                }`}
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center justify-center gap-1">
                                    <span className={`font-bold font-mono text-xs px-2 py-0.5 rounded ${
                                      isPractical
                                        ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                        : 'bg-blue-100 text-blue-700 border border-blue-200'
                                    }`}>
                                      {item.code}
                                    </span>
                                  </div>
                                  <p className="text-[11px] font-semibold text-ink truncate max-w-[130px] mx-auto" title={item.name}>
                                    {item.name}
                                  </p>
                                  <p className={`text-[10px] truncate max-w-[130px] mx-auto ${
                                    isMine ? 'text-brand font-bold' : 'text-muted'
                                  }`} title={item.teacher}>
                                    {item.teacher}
                                    {item.co_teacher ? ` & ${item.co_teacher}` : ''}
                                  </p>
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: ASSIGNED SUBJECTS & MODULES */}
          {/* ============================================================== */}
          {activeTab === 'subjects' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-ink text-base flex items-center gap-2">
                  <BookOpen size={18} className="text-brand shrink-0" />
                  <span>NEP SEM-I Subject Modules (FY.BSc CS)</span>
                </h3>
                <p className="text-muted text-xs mt-0.5">
                  Course syllabus modules and assigned faculty for academic year 2026-27
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subjects
                  .filter((s) => s.divisions?.name === 'FYBSc CS' || !s.divisions)
                  .map((sub) => {
                    const isPractical = sub.code?.includes('(P)')
                    return (
                      <Card
                        key={sub.id}
                        className="p-5 flex flex-col justify-between hover:border-brand/40 transition-colors shadow-xs"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-brand/10 text-brand border border-brand/20">
                              {sub.code || 'SUBJ'}
                            </span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                              isPractical ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {isPractical ? 'Lab Course' : 'Theory Course'}
                            </span>
                          </div>
                          <h4 className="font-bold text-ink text-base leading-snug">
                            {sub.name}
                          </h4>
                          <p className="text-muted text-xs mt-2 flex items-center gap-1.5">
                            <GraduationCap size={14} className="text-brand shrink-0" />
                            <span>F.Y.BSc Computer Science • Div A</span>
                          </p>
                        </div>

                        <div className="mt-5 pt-3.5 border-t border-line flex items-center justify-between gap-2">
                          <Button
                            onClick={() => navigate('/teacher/attendance')}
                            variant="primary"
                            size="sm"
                            className="gap-1.5 flex-1 justify-center text-xs"
                          >
                            <Play size={13} />
                            <span>Start Lecture</span>
                          </Button>
                          <Button
                            onClick={() => navigate('/teacher/announce')}
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs text-muted hover:text-ink"
                          >
                            <Bell size={13} />
                            <span>Notice</span>
                          </Button>
                        </div>
                      </Card>
                    )
                  })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
