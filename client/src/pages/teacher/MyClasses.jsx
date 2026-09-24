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
    <div className="animate-fade-in space-y-6">
      {/* Top Banner & Header */}
      <div className="card bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-accent/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-info text-xs tracking-wider uppercase font-mono">
                SMDL College • Department of Computer Science
              </span>
              <span className="badge badge-active text-xs">
                NEP 2026-27
              </span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>My Classes & Lecture Planner</span>
              <Sparkles size={22} className="text-amber-400 animate-pulse" />
            </h2>
            <p className="text-brand-muted text-sm mt-1 flex items-center gap-2">
              <span>F.Y.BSc (Computer Science) - Semester I</span>
              <span>•</span>
              <span className="text-white font-medium">{user?.name || 'Faculty Member'}</span>
            </p>
          </div>

          {/* Real-time Clock Card */}
          <div className="flex items-center gap-3">
            <div className="glass px-4 py-2.5 rounded-xl border border-white/10 text-right">
              <p className="text-xs text-brand-muted font-medium flex items-center justify-end gap-1.5">
                <Clock size={13} className="text-brand-accent" />
                <span>Indian Standard Time</span>
              </p>
              <p className="text-xl font-mono font-bold text-white tracking-wider mt-0.5">
                {currentTimeStr || '--:--:--'}
              </p>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="btn btn-secondary !p-2.5 rounded-xl"
              title="Refresh schedule"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin text-brand-accent' : ''} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-5 border-t border-white/10">
          <div className="flex items-center gap-1.5 p-1 bg-black/40 rounded-xl border border-white/5">
            <button
              onClick={() => setActiveTab('today')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'today'
                  ? 'bg-brand-accent text-slate-950 shadow-md font-bold'
                  : 'text-brand-muted hover:text-white'
              }`}
            >
              <Calendar size={15} />
              <span>Today's Schedule</span>
              {currentOngoing && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('timetable')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'timetable'
                  ? 'bg-brand-accent text-slate-950 shadow-md font-bold'
                  : 'text-brand-muted hover:text-white'
              }`}
            >
              <Table size={15} />
              <span>Weekly Timetable Matrix</span>
            </button>

            <button
              onClick={() => setActiveTab('subjects')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'subjects'
                  ? 'bg-brand-accent text-slate-950 shadow-md font-bold'
                  : 'text-brand-muted hover:text-white'
              }`}
            >
              <Layers size={15} />
              <span>Curriculum & Subjects</span>
              <span className="badge badge-info text-[10px] !py-0 !px-1.5">{subjects.length}</span>
            </button>
          </div>

          {/* Teacher Scope Filter */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterMyOnly(!filterMyOnly)}
              className={`btn btn-sm text-xs flex items-center gap-1.5 rounded-lg border ${
                filterMyOnly
                  ? 'border-brand-accent/50 bg-brand-accent/10 text-brand-accent'
                  : 'border-white/10 bg-white/5 text-brand-muted hover:text-white'
              }`}
            >
              <Filter size={13} />
              <span>{filterMyOnly ? 'Showing: My Classes Only' : 'Showing: All CS Classes'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="stat-icon bg-blue-500/20 text-blue-400">
            <Calendar size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">
              {todayActualDay === 'Sunday' ? 'Off' : `${todayData?.my_lectures?.length || 0} Lectures`}
            </p>
            <p className="text-brand-muted text-xs mt-0.5">Today's Load ({todayActualDay})</p>
          </div>
        </div>

        <div className="stat-card">
          <div className={`stat-icon ${currentOngoing ? 'bg-rose-500/20 text-rose-400 animate-pulse' : 'bg-emerald-500/20 text-emerald-400'}`}>
            <Flame size={20} />
          </div>
          <div>
            <p className="text-lg font-bold text-white truncate max-w-[150px]">
              {currentOngoing ? currentOngoing.subject?.code || 'In Session' : 'No Active Slot'}
            </p>
            <p className="text-brand-muted text-xs mt-0.5">
              {currentOngoing ? 'Session In Progress' : 'Current Status'}
            </p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon bg-purple-500/20 text-purple-400">
            <Award size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">NEP Sem-I</p>
            <p className="text-brand-muted text-xs mt-0.5">FY.BSc Computer Science</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon bg-amber-500/20 text-amber-400">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">08:00 - 13:30</p>
            <p className="text-brand-muted text-xs mt-0.5">College Operating Hours</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card flex flex-col items-center justify-center py-24">
          <Loader2 className="animate-spin w-10 h-10 text-brand-accent mb-3" />
          <p className="text-white font-medium">Synchronizing SMDL Timetable Engine...</p>
          <p className="text-brand-muted text-xs mt-1">Fetching live session statuses and faculty assignments</p>
        </div>
      ) : (
        <>
          {/* ============================================================== */}
          {/* TAB 1: TODAY'S SCHEDULE (LIVE PLANNER) */}
          {/* ============================================================== */}
          {activeTab === 'today' && (
            <div className="space-y-6">
              {/* Day Selector Chips */}
              <div className="card p-3 flex flex-wrap items-center justify-between gap-3 bg-slate-900/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-brand-muted font-medium ml-1">Select Day:</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {DAY_KEYS.filter((d) => d !== 'Sunday').map((day) => {
                      const isToday = day === todayActualDay
                      const isSelected = day === selectedDay
                      return (
                        <button
                          key={day}
                          onClick={() => setSelectedDay(day)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-brand-accent text-slate-950 font-bold shadow'
                              : isToday
                              ? 'bg-brand-accent/20 text-brand-accent border border-brand-accent/40'
                              : 'bg-white/5 text-brand-muted hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <span>{day.slice(0, 3)}</span>
                          {isToday && (
                            <span className="text-[10px] px-1 py-0.2 rounded bg-brand-accent/30 text-brand-accent uppercase font-mono">
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
                    className="text-xs text-brand-accent hover:underline flex items-center gap-1"
                  >
                    <span>Back to Today ({todayActualDay})</span>
                  </button>
                )}
              </div>

              {/* Ongoing Lecture Spotlight Banner */}
              {isViewingToday && currentOngoing && (
                <div className="card border-2 border-rose-500/50 bg-gradient-to-r from-rose-950/40 via-slate-900 to-rose-950/30 relative overflow-hidden p-6 animate-pulse-subtle">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                        </span>
                        <span className="badge badge-error text-xs font-bold uppercase tracking-wider">
                          LIVE LECTURE IN PROGRESS NOW
                        </span>
                        <span className="text-brand-muted text-xs font-mono">
                          {currentOngoing.start_time?.slice(0, 5)} - {currentOngoing.end_time?.slice(0, 5)}
                        </span>
                      </div>
                      <h3 className="text-2xl font-bold text-white">
                        {currentOngoing.subject?.code}: {currentOngoing.subject?.name}
                      </h3>
                      <p className="text-brand-muted text-sm flex items-center gap-3">
                        <span className="flex items-center gap-1 text-white">
                          <GraduationCap size={15} className="text-brand-accent" />
                          <span>F.Y.BSc CS (NEP)</span>
                        </span>
                        <span>•</span>
                        <span>Faculty: <strong className="text-white">{currentOngoing.teacher?.full_name}</strong></span>
                      </p>
                    </div>

                    <button
                      onClick={() => navigate('/teacher/attendance', { state: { lectureId: currentOngoing.id } })}
                      className="btn-primary !py-3 !px-6 text-sm font-bold flex items-center justify-center gap-2 shadow-xl shadow-brand-accent/20"
                    >
                      <Play size={16} className="fill-current" />
                      <span>Take Attendance & Live Roster</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Lecture Timeline List */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-bold text-lg flex items-center gap-2">
                    <Clock size={18} className="text-brand-accent" />
                    <span>
                      {selectedDay} Schedule{' '}
                      {isViewingToday ? `(Today • ${todayData?.date || ''})` : `(Timetable Preview)`}
                    </span>
                  </h3>
                  <span className="text-xs text-brand-muted">
                    {effectiveDayLectures.length} {effectiveDayLectures.length === 1 ? 'Class' : 'Classes'} Scheduled
                  </span>
                </div>

                {selectedDay === 'Sunday' ? (
                  <div className="card text-center py-16">
                    <Calendar size={48} className="mx-auto text-brand-muted mb-3 opacity-50" />
                    <h4 className="text-white font-semibold text-lg">Sunday — Weekly Off / Holiday</h4>
                    <p className="text-brand-muted text-sm mt-1 max-w-md mx-auto">
                      No academic lectures are scheduled on Sunday as per SMDL College academic calendar.
                    </p>
                  </div>
                ) : effectiveDayLectures.length === 0 ? (
                  <div className="card text-center py-16">
                    <BookOpen size={48} className="mx-auto text-brand-muted mb-3 opacity-50" />
                    <h4 className="text-white font-semibold text-lg">No Classes Scheduled For You on {selectedDay}</h4>
                    <p className="text-brand-muted text-sm mt-1 max-w-md mx-auto">
                      You do not have any teaching slots assigned on this day, or switch the filter to{' '}
                      <button
                        onClick={() => setFilterMyOnly(false)}
                        className="text-brand-accent underline ml-1 font-semibold"
                      >
                        "All CS Classes"
                      </button>{' '}
                      to view full department schedule.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {effectiveDayLectures.map((lec, idx) => {
                      const isOngoing = lec.status === 'ONGOING'
                      const isUpcoming = lec.status === 'UPCOMING'
                      const isCompleted = lec.status === 'COMPLETED'
                      const isPractical = lec.subject?.code?.includes('(P)') || lec.topic?.toLowerCase().includes('lab')

                      return (
                        <div
                          key={lec.id || idx}
                          className={`card transition-all p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                            isOngoing
                              ? 'border-brand-accent bg-brand-accent/5 shadow-lg shadow-brand-accent/10'
                              : 'hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            {/* Time Badge */}
                            <div className="flex-shrink-0 text-center px-3 py-2 rounded-xl bg-black/40 border border-white/10 min-w-[100px]">
                              <p className="text-xs font-mono font-bold text-white">
                                {lec.start_time?.slice(0, 5)}
                              </p>
                              <p className="text-[10px] text-brand-muted font-mono">
                                to {lec.end_time?.slice(0, 5)}
                              </p>
                              <span className={`inline-block mt-1 text-[9px] uppercase px-1.5 py-0.5 rounded font-mono font-bold ${
                                isPractical ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'
                              }`}>
                                {isPractical ? 'Lab (P)' : 'Theory'}
                              </span>
                            </div>

                            {/* Details */}
                            <div>
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="badge badge-info text-xs font-mono font-bold">
                                  {lec.subject?.code || 'CS-SUBJ'}
                                </span>
                                {isOngoing && (
                                  <span className="badge badge-error text-[10px] flex items-center gap-1 font-bold animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                    ONGOING NOW
                                  </span>
                                )}
                                {isUpcoming && (
                                  <span className="badge badge-warning text-[10px] flex items-center gap-1">
                                    <Clock size={11} /> UPCOMING
                                  </span>
                                )}
                                {isCompleted && (
                                  <span className="badge badge-neutral text-[10px] flex items-center gap-1 opacity-70">
                                    <CheckCircle2 size={11} /> COMPLETED
                                  </span>
                                )}
                              </div>

                              <h4 className="text-white font-bold text-base md:text-lg">
                                {lec.subject?.name || lec.topic || 'Subject'}
                              </h4>

                              <p className="text-brand-muted text-xs mt-1 flex flex-wrap items-center gap-2">
                                <span className="flex items-center gap-1">
                                  <GraduationCap size={13} className="text-brand-accent" />
                                  <span>F.Y.BSc (Computer Science) Div A</span>
                                </span>
                                <span>•</span>
                                <span>
                                  Teacher: <strong className="text-slate-200">{lec.teacher?.full_name || 'Assigned Faculty'}</strong>
                                </span>
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-white/5 justify-end">
                            <button
                              onClick={() => {
                                if (lec.is_simulated) {
                                  toast('Preview mode: lecture session will be active on ' + selectedDay, { icon: 'ℹ️' })
                                  return
                                }
                                navigate('/teacher/attendance', { state: { lectureId: lec.id } })
                              }}
                              className={`btn-sm text-xs flex items-center gap-1.5 rounded-lg font-semibold px-4 py-2 ${
                                isOngoing
                                  ? 'btn-primary'
                                  : 'btn-secondary text-brand-muted hover:text-white'
                              }`}
                            >
                              <Play size={13} />
                              <span>{isOngoing ? 'Live Roster' : 'Open Attendance'}</span>
                            </button>

                            <button
                              onClick={() => navigate('/teacher/announce')}
                              className="btn btn-ghost btn-sm text-xs text-brand-muted hover:text-white p-2"
                              title="Send class announcement"
                            >
                              <Bell size={14} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: WEEKLY TIMETABLE MATRIX (OFFICIAL SMDL NOTICE BOARD) */}
          {/* ============================================================== */}
          {activeTab === 'timetable' && (
            <div className="space-y-6">
              <div className="card bg-slate-900/60 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-white font-bold text-base flex items-center gap-2">
                    <Table size={18} className="text-brand-accent" />
                    <span>Official College Timetable Matrix (2026-27)</span>
                  </h3>
                  <p className="text-brand-muted text-xs mt-0.5">
                    SES's S. M. Dadasaheb Limaye College, Kalamboli — Department of Computer Science
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-brand-accent/30 border border-brand-accent" />
                    <span className="text-brand-muted">Your Lectures</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-white/5 border border-white/10" />
                    <span className="text-brand-muted">Other Faculty</span>
                  </div>
                </div>
              </div>

              {/* Interactive Matrix Table */}
              <div className="card overflow-x-auto p-0 border border-white/10">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-white/10">
                      <th className="p-3.5 font-bold text-brand-muted uppercase tracking-wider text-[11px] w-28 sticky left-0 bg-slate-950 z-10">
                        TIME
                      </th>
                      {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].map((day) => {
                        const isDayToday = day.toLowerCase() === todayActualDay.toLowerCase()
                        return (
                          <th
                            key={day}
                            className={`p-3.5 font-bold uppercase tracking-wider text-[11px] text-center min-w-[140px] ${
                              isDayToday
                                ? 'bg-brand-accent/15 text-brand-accent border-b-2 border-brand-accent'
                                : 'text-slate-300'
                            }`}
                          >
                            <span>{day}</span>
                            {isDayToday && (
                              <span className="block text-[9px] font-normal tracking-normal text-brand-accent/80 font-mono">
                                (Today)
                              </span>
                            )}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/5">
                    {timetableMatrix?.time_slots?.map((slot) => {
                      if (slot.is_recess) {
                        return (
                          <tr key="recess" className="bg-amber-500/5 text-center">
                            <td className="p-3 font-mono text-[11px] font-semibold text-amber-300/80 sticky left-0 bg-slate-950/90 z-10 border-y border-amber-500/20">
                              {slot.label.split(' - ')[0]}
                            </td>
                            <td
                              colSpan={6}
                              className="p-3 font-bold text-amber-400/90 tracking-widest text-xs border-y border-amber-500/20 uppercase"
                            >
                              ✦ R E C E S S &nbsp; (11:00 AM - 11:30 AM) ✦
                            </td>
                          </tr>
                        )
                      }

                      return (
                        <tr key={slot.slot_id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-3 font-mono text-[11px] font-semibold text-slate-300 sticky left-0 bg-slate-950 z-10 border-r border-white/5">
                            <div>{slot.label.split(' - ')[0]}</div>
                            <div className="text-[10px] text-brand-muted">to {slot.label.split(' - ')[1]}</div>
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
                                  className={`p-3 text-center text-brand-muted/40 font-mono text-xs ${
                                    isDayToday ? 'bg-brand-accent/[0.02]' : ''
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
                                    ? 'bg-brand-accent/15 border-2 border-brand-accent/50 rounded-lg shadow-sm'
                                    : isDayToday
                                    ? 'bg-brand-accent/[0.04]'
                                    : ''
                                }`}
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center justify-center gap-1">
                                    <span className={`font-bold font-mono text-xs px-2 py-0.5 rounded ${
                                      isPractical
                                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    }`}>
                                      {item.code}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-white font-medium truncate max-w-[130px] mx-auto" title={item.name}>
                                    {item.name}
                                  </p>
                                  <p className={`text-[10px] truncate max-w-[130px] mx-auto ${
                                    isMine ? 'text-brand-accent font-semibold' : 'text-brand-muted'
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
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: ASSIGNED SUBJECTS & MODULES */}
          {/* ============================================================== */}
          {activeTab === 'subjects' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-bold text-base flex items-center gap-2">
                    <BookOpen size={18} className="text-brand-accent" />
                    <span>NEP SEM-I Subject Modules (FY.BSc CS)</span>
                  </h3>
                  <p className="text-brand-muted text-xs mt-0.5">
                    Course syllabus modules and assigned faculty for academic year 2026-27
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subjects
                  .filter((s) => s.divisions?.name === 'FYBSc CS' || !s.divisions)
                  .map((sub) => {
                    const isPractical = sub.code?.includes('(P)')
                    return (
                      <div
                        key={sub.id}
                        className="card flex flex-col justify-between hover:border-brand-accent/50 transition-all group"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <span className="badge badge-info text-xs font-mono font-bold">{sub.code || 'SUBJ'}</span>
                            <span className={`badge text-[10px] ${isPractical ? 'badge-warning' : 'badge-active'}`}>
                              {isPractical ? 'Lab Course' : 'Theory Course'}
                            </span>
                          </div>
                          <h4 className="text-white font-bold text-lg group-hover:text-brand-accent transition-colors leading-snug">
                            {sub.name}
                          </h4>
                          <p className="text-brand-muted text-xs mt-2 flex items-center gap-1.5">
                            <GraduationCap size={14} className="text-brand-accent" />
                            <span>F.Y.BSc Computer Science • Div A</span>
                          </p>
                        </div>

                        <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between gap-2">
                          <button
                            onClick={() => navigate('/teacher/attendance')}
                            className="btn-primary !py-1.5 !px-3 text-xs flex items-center gap-1.5 flex-1 justify-center"
                          >
                            <Play size={13} />
                            <span>Start Lecture</span>
                          </button>
                          <button
                            onClick={() => navigate('/teacher/announce')}
                            className="btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1.5 text-brand-muted hover:text-white"
                          >
                            <Bell size={13} />
                            <span>Notice</span>
                          </button>
                        </div>
                      </div>
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
