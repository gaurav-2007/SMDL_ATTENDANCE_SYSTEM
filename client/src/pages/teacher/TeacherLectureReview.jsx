import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Plus, RefreshCw, UserCheck, XCircle, Camera, MapPin,
  Edit3, X, CheckCircle2, AlertTriangle, Loader2, Users,
  ClipboardList, BookOpen, ChevronDown, Search, Smartphone, Zap,
  Check, ArrowRight, Clock, Maximize2, Eye
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Badge, Button, Input, Select, Modal, EmptyState, Skeleton
} from '../../components/ui'

export default function TeacherLectureReview() {
  const location = useLocation()
  const [lectures, setLectures] = useState([])
  const [selectedLecture, setSelectedLecture] = useState(location.state?.lectureId || '')
  const [loadingLectures, setLoadingLectures] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [subjects, setSubjects] = useState([])
  const [divisions, setDivisions] = useState([])
  const [showStartModal, setShowStartModal] = useState(false)
  const [startForm, setStartForm] = useState({ subject_id: '', division_id: '', semester: '', topic: '', duration_minutes: 60 })
  const [starting, setStarting] = useState(false)

  const [yearFilter, setYearFilter] = useState('ALL')
  const [semesterFilter, setSemesterFilter] = useState('ALL')

  const [roster, setRoster] = useState([])
  const [summary, setSummary] = useState({ total: 0, present: 0, absent: 0 })
  const [lectureMeta, setLectureMeta] = useState(null)
  const [loadingRoster, setLoadingRoster] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState('ALL')
  const [directMarkingId, setDirectMarkingId] = useState(null)

  const [selfieModal, setSelfieModal] = useState({ open: false, url: '', name: '' })
  const [overrideModal, setOverrideModal] = useState({ open: false, student: null })
  const [overrideStatus, setOverrideStatus] = useState('PRESENT')
  const [overrideReason, setOverrideReason] = useState('')
  const [submittingOverride, setSubmittingOverride] = useState(false)

  useEffect(() => {
    loadLectures()
    loadFilters()
  }, [])

  useEffect(() => {
    if (selectedLecture) {
      loadRoster(selectedLecture)
    } else {
      setRoster([])
      setSummary({ total: 0, present: 0, absent: 0 })
      setLectureMeta(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLecture])

  async function loadLectures() {
    try {
      setLoadingLectures(true)
      const { data } = await api.get('/lectures/active')
      const list = data?.data?.lectures || []
      setLectures(list)
      const requestedId = location.state?.lectureId
      const targetId = (requestedId && list.some(l => l.id === requestedId))
        ? requestedId
        : (selectedLecture && list.some(l => l.id === selectedLecture))
          ? selectedLecture
          : (list.length >= 1 ? list[0].id : '')
      setSelectedLecture(targetId)
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to load lectures')
    } finally {
      setLoadingLectures(false)
    }
  }

  async function loadFilters() {
    try {
      const [sRes, dRes, meRes] = await Promise.allSettled([
        api.get('/academic/subjects'),
        api.get('/academic/divisions'),
        api.get('/auth/me'),
      ])
      let allSubs = sRes.status === 'fulfilled' ? (sRes.value?.data?.data?.subjects || []) : []
      if (meRes.status === 'fulfilled') {
        const assigned = meRes.value?.data?.data?.profile?.assigned_subjects || []
        if (assigned.length > 0) {
          const assignedIds = new Set(assigned.map(a => a.id))
          allSubs = allSubs.filter(s => assignedIds.has(s.id))
        }
      }
      setSubjects(allSubs)
      if (dRes.status === 'fulfilled') {
        setDivisions(dRes.value?.data?.data?.divisions || [])
      }
    } catch (e) {
      // noop
    }
  }

  async function loadRoster(lecId) {
    try {
      setLoadingRoster(true)
      const { data } = await api.get(`/attendance/lecture/${lecId}`)
      setRoster(data?.data?.roster || [])
      setSummary(data?.data?.summary || { total: 0, present: 0, absent: 0 })
      setLectureMeta(data?.data?.lecture || null)
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to load attendance')
    } finally {
      setLoadingRoster(false)
    }
  }

  async function refresh() {
    try {
      setRefreshing(true)
      if (selectedLecture) await loadRoster(selectedLecture)
      await loadLectures()
    } finally {
      setRefreshing(false)
    }
  }

  function getAcademicYearFromSemester(sem) {
    const s = Number(sem)
    if (s <= 2) return 'FY'
    if (s <= 4) return 'SY'
    if (s <= 6) return 'TY'
    return 'FY'
  }

  function getSemestersForDivision(div) {
    if (!div) return [1, 2]
    const name = (div.name || '').toUpperCase()
    if (name.includes('FY') || (div.current_semester && div.current_semester <= 2)) return [1, 2]
    if (name.includes('SY') || (div.current_semester && div.current_semester <= 4)) return [3, 4]
    if (name.includes('TY') || (div.current_semester && div.current_semester <= 6)) return [5, 6]
    return [1, 2]
  }

  const displayedLectures = lectures.filter((l) => {
    const sem = l.semester || l.subject?.semester || l.division?.current_semester || 1
    const yr = getAcademicYearFromSemester(sem)
    if (yearFilter !== 'ALL' && yr !== yearFilter) return false
    if (semesterFilter !== 'ALL' && String(sem) !== String(semesterFilter)) return false
    return true
  })

  const filteredSubjectsForStart = subjects.filter(s => {
    if (!startForm.division_id) return false
    const sDivId = s.division_id || s.division?.id
    const matchDiv = !sDivId || sDivId === startForm.division_id
    const matchSem = !startForm.semester || Number(s.semester) === Number(startForm.semester)
    return matchDiv && matchSem
  })

  async function handleStartLecture() {
    if (!startForm.subject_id || !startForm.division_id) {
      toast.error('Subject and Division are required')
      return
    }
    try {
      setStarting(true)
      const { data } = await api.post('/lectures', startForm)
      const newLec = data?.data?.lecture
      toast.success(`✅ ${newLec?.subject?.name || 'Lecture'} (Sem ${newLec?.semester || startForm.semester}) started successfully!`)
      setShowStartModal(false)
      setStartForm({ subject_id: '', division_id: '', semester: '', topic: '', duration_minutes: 60 })
      await loadLectures()
      if (newLec?.id) {
        setSelectedLecture(newLec.id)
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to start lecture')
    } finally {
      setStarting(false)
    }
  }

  const [closingWindow, setClosingWindow] = useState(false)

  async function handleCloseWindow() {
    if (!selectedLecture) return
    if (!confirm('Close the attendance window for this lecture session now? Students will no longer be able to mark attendance.')) return
    try {
      setClosingWindow(true)
      await api.patch(`/lectures/${selectedLecture}/status`, { status: 'COMPLETED' })
      toast.success('Attendance window closed successfully')
      await loadRoster(selectedLecture)
      await loadLectures()
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to close attendance window')
    } finally {
      setClosingWindow(false)
    }
  }

  function openOverride(student) {
    setOverrideModal({ open: true, student })
    setOverrideStatus(student?.status === 'PRESENT' ? 'ABSENT' : 'PRESENT')
    setOverrideReason(student?.override_notes || '')
  }

  // Direct 1-click check-in for students without a smartphone present in classroom
  async function directMarkPresent(student) {
    if (!student || !selectedLecture) return
    try {
      setDirectMarkingId(student.student_pk)
      await api.post('/attendance/override', {
        lecture_id: selectedLecture,
        student_pk: student.student_pk,
        status: 'PRESENT',
        reason: 'Student present in classroom (No smartphone)',
      })
      toast.success(`✅ ${student.full_name} (${student.roll_number}) marked PRESENT without phone verification!`)
      await loadRoster(selectedLecture)
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Direct mark failed')
    } finally {
      setDirectMarkingId(null)
    }
  }

  async function submitOverride() {
    const { student } = overrideModal
    if (!student || !selectedLecture) return
    if (overrideReason.trim().length < 5) {
      toast.error('Please enter a reason (min 5 characters)')
      return
    }
    try {
      setSubmittingOverride(true)
      await api.post('/attendance/override', {
        lecture_id: selectedLecture,
        student_pk: student.student_pk,
        status: overrideStatus,
        reason: overrideReason.trim(),
      })
      toast.success(`✅ ${student.full_name} attendance marked ${overrideStatus}`)
      setOverrideModal({ open: false, student: null })
      await loadRoster(selectedLecture)
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Override failed')
    } finally {
      setSubmittingOverride(false)
    }
  }

  const filteredRoster = roster.filter((r) => {
    const q = searchQuery.toLowerCase().trim()
    const matchesSearch =
      !q ||
      r.full_name?.toLowerCase().includes(q) ||
      r.roll_number?.toString().toLowerCase().includes(q)
    const matchesTab =
      filterTab === 'ALL' ||
      (filterTab === 'PRESENT' && r.status === 'PRESENT') ||
      (filterTab === 'ABSENT' && r.status === 'ABSENT')
    return matchesSearch && matchesTab
  })

  const pct = summary.total > 0 ? ((summary.present / summary.total) * 100).toFixed(1) : 0
  const pctSafe = Number(pct) >= 75

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── PAGE HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-line">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-ink tracking-tight">
            Class Attendance Review
          </h2>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            Real-time classroom roster with facial photo verification & 1-click manual override
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={refreshing}
            loading={refreshing}
            className="h-9"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            <span>Refresh</span>
          </Button>

          <Button
            id="start-lecture-btn"
            variant="primary"
            size="sm"
            onClick={() => setShowStartModal(true)}
            className="h-9 shadow-xs font-semibold"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Start New Lecture</span>
          </Button>
        </div>
      </div>

      {/* ── LECTURE SELECTOR & INFO BAR ── */}
      <Card className="p-4 sm:p-5">
        {/* Academic Year & Semester Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-line">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted mr-1">Class / Year:</span>
            {['ALL', 'FY', 'SY', 'TY'].map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => {
                  setYearFilter(yr)
                  setSemesterFilter('ALL')
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  yearFilter === yr
                    ? 'bg-brand text-white shadow-2xs'
                    : 'bg-surface border border-line text-ink hover:bg-bg'
                }`}
              >
                {yr === 'ALL' ? 'All Classes' : yr === 'FY' ? 'FY (Sem 1 & 2)' : yr === 'SY' ? 'SY (Sem 3 & 4)' : 'TY (Sem 5 & 6)'}
              </button>
            ))}
          </div>

          {yearFilter !== 'ALL' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted mr-1">Semester:</span>
              {(yearFilter === 'FY' ? ['ALL', '1', '2'] : yearFilter === 'SY' ? ['ALL', '3', '4'] : ['ALL', '5', '6']).map((sem) => (
                <button
                  key={sem}
                  type="button"
                  onClick={() => setSemesterFilter(sem)}
                  className={`px-2 py-0.5 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
                    semesterFilter === sem
                      ? 'bg-brand text-white font-bold'
                      : 'bg-surface border border-line text-muted hover:text-ink'
                  }`}
                >
                  {sem === 'ALL' ? 'All Sem' : `Sem ${sem}`}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
          <div>
            <label htmlFor="lecture-select-teacher" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Active Lecture Session
            </label>
            {loadingLectures ? (
              <div className="p-2.5 bg-bg border border-line rounded-lg text-xs text-muted flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-brand" />
                <span>Loading active sessions...</span>
              </div>
            ) : displayedLectures.length === 0 ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-lg text-xs text-muted">
                {lectures.length === 0
                  ? 'No active lectures today.'
                  : `No lectures found for ${yearFilter !== 'ALL' ? yearFilter : ''} ${semesterFilter !== 'ALL' ? `Sem ${semesterFilter}` : ''}.`}{' '}
                Click <strong className="text-brand font-semibold cursor-pointer" onClick={() => setShowStartModal(true)}>Start New Lecture</strong>.
              </div>
            ) : (
              <div className="relative">
                <select
                  id="lecture-select-teacher"
                  value={selectedLecture}
                  onChange={e => setSelectedLecture(e.target.value)}
                  className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink pr-8 focus:outline-none focus:ring-2 focus:ring-brand/30 shadow-xs cursor-pointer appearance-none"
                >
                  <option value="">— Select a lecture to review roster —</option>
                  {displayedLectures.map(l => {
                    const startFmt = l.start_time?.slice(0, 5) || 'Session'
                    const endFmt = l.end_time?.slice(0, 5) || ''
                    const timeLabel = endFmt ? `${startFmt} - ${endFmt}` : startFmt
                    const statusTag = l.is_attendance_open ? '🟢 Open' : '⚪ Closed'
                    const semLabel = l.semester || l.subject?.semester || l.division?.current_semester || '?'
                    return (
                      <option key={l.id} value={l.id}>
                        {statusTag} · [Sem {semLabel}] {l.subject?.name || 'Subject'} · {l.division?.name} Div {l.division?.division_name || ''} ({timeLabel})
                      </option>
                    )
                  })}
                </select>
                <ChevronDown className="w-4 h-4 text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
          </div>

          {lectureMeta && (
            <div className="lg:col-span-2 bg-bg/70 border border-line rounded-lg p-3 sm:p-3.5 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <span className="text-muted block">Subject & Semester:</span>
                  <span className="font-semibold text-ink">{lectureMeta.subject?.name}</span>
                  <span className="text-brand font-mono text-[11px] block font-semibold">
                    [Sem {lectureMeta.semester || lectureMeta.subject?.semester || 1}] {lectureMeta.subject?.code}
                  </span>
                </div>
                <div>
                  <span className="text-muted block">Division:</span>
                  <span className="font-semibold text-ink">{lectureMeta.division?.name} Div {lectureMeta.division?.division_name || ''}</span>
                </div>
                <div>
                  <span className="text-muted block">Timing:</span>
                  <span className="font-semibold font-mono text-ink">
                    {lectureMeta.start_time?.slice(0, 5)} - {lectureMeta.end_time?.slice(0, 5)}
                  </span>
                </div>
                <div>
                  <span className="text-muted block">Conducted Date:</span>
                  <span className="font-semibold text-ink">{lectureMeta.lecture_date ? new Date(lectureMeta.lecture_date).toLocaleDateString('en-IN') : 'Today'}</span>
                </div>
                <div>
                  <span className="text-muted block">Attendance Window:</span>
                  <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {lectureMeta.is_attendance_open ? (
                      <>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-present/15 text-present border border-present/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-present animate-pulse" />
                          <span>Open until {lectureMeta.window_expires_at || 'end'}</span>
                        </span>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={handleCloseWindow}
                          disabled={closingWindow}
                          loading={closingWindow}
                          className="h-5 text-[10px] px-2 font-semibold shadow-2xs"
                          title="Manually end attendance window now"
                        >
                          End Window
                        </Button>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-absent/15 text-absent border border-absent/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-absent" />
                        <span>Closed {lectureMeta.window_expires_at ? `(${lectureMeta.window_expires_at})` : ''}</span>
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted block mt-0.5">1 hr post-class, max 2h</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ── SUMMARY STAT CARDS ── */}
      {selectedLecture && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-bg border border-line flex items-center justify-center text-muted shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium">Total Enrolled</p>
              <p className="text-xl sm:text-2xl font-bold font-display text-ink tabular-nums">{summary.total}</p>
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-present/10 border border-present/20 text-present flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium">Present</p>
              <p className="text-xl sm:text-2xl font-bold font-display text-present tabular-nums">{summary.present}</p>
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-absent/10 border border-absent/20 text-absent flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium">Absent</p>
              <p className="text-xl sm:text-2xl font-bold font-display text-absent tabular-nums">{summary.absent}</p>
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-3.5">
            <div className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${
              pctSafe
                ? 'bg-present/10 border-present/20 text-present'
                : 'bg-absent/10 border-absent/20 text-absent'
            }`}>
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium">Class Turnout</p>
              <div className="flex items-baseline gap-1.5">
                <p className="text-xl sm:text-2xl font-bold font-display text-ink tabular-nums">{pct}%</p>
                <Badge variant={pctSafe ? 'present' : 'absent'} size="sm">
                  {pctSafe ? 'Safe' : 'Low'}
                </Badge>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── CLASS ROSTER SECTION ── */}
      <Card className="overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-line">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-brand" />
                <span>Live Student Roster {selectedLecture ? '' : '(Select lecture above)'}</span>
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Students can check-in via mobile app, or teachers can directly mark phone-less students present.
              </CardDescription>
            </div>

            {selectedLecture && (
              <span className="text-[11px] font-mono text-muted self-start sm:self-auto">
                Updated {loadingRoster ? '...' : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {selectedLecture && (
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pt-1">
              {/* Search Bar */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search student or roll no..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-surface border border-line rounded-lg pl-9 pr-8 py-2 text-xs text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/30 shadow-xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink text-xs p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter Chips */}
              <div className="flex items-center gap-1.5 p-1 bg-bg border border-line rounded-lg w-full sm:w-auto justify-center sm:justify-start">
                <button
                  type="button"
                  onClick={() => setFilterTab('ALL')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    filterTab === 'ALL'
                      ? 'bg-surface text-ink border border-line shadow-xs font-semibold'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  All ({roster.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('PRESENT')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    filterTab === 'PRESENT'
                      ? 'bg-present/10 text-present border border-present/20 shadow-xs font-semibold'
                      : 'text-muted hover:text-present'
                  }`}
                >
                  Present ({summary.present})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('ABSENT')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    filterTab === 'ABSENT'
                      ? 'bg-absent/10 text-absent border border-absent/20 shadow-xs font-semibold'
                      : 'text-muted hover:text-absent'
                  }`}
                >
                  Absent ({summary.absent})
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Empty / Loading State */}
        {!selectedLecture ? (
          <div className="p-12">
            <EmptyState
              icon={BookOpen}
              title="No Lecture Selected"
              description="Choose an active lecture from the dropdown above or start a new lecture to view the classroom roster."
            />
          </div>
        ) : loadingRoster ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : filteredRoster.length === 0 ? (
          <div className="p-10">
            <EmptyState
              icon={Users}
              title={searchQuery ? `No students found matching "${searchQuery}"` : 'No Students In Division'}
              description={searchQuery ? 'Please check spelling or reset your search query.' : 'Students enrolled in this academic division will appear here.'}
              action={
                searchQuery ? (
                  <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>
                    Clear Search
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div>
            {lectureMeta && !lectureMeta.is_attendance_open && (
              <div className="mx-4 sm:mx-6 mt-4 mb-2 p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-700 dark:text-amber-300">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    <strong>Attendance Window Closed:</strong> This lecture's window expired at <strong>{lectureMeta.window_expires_at || 'scheduled end'}</strong>. Student and direct classroom attendance marking are closed.
                  </span>
                </div>
              </div>
            )}

            {/* ── DESKTOP VIEW: CLEAN DATA TABLE (Hidden on small screens) ── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-line bg-bg/50 text-muted font-semibold text-xs">
                    <th className="py-3 px-4 w-12">#</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Roll No</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">📍 Distance</th>
                    <th className="py-3 px-4">📸 Proof</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredRoster.map((r, idx) => {
                    const isPresent = r.status === 'PRESENT'
                    const distanceColor =
                      r.distance_meters == null
                        ? 'text-muted'
                        : r.distance_meters <= 100
                        ? 'text-present font-semibold'
                        : 'text-grace'

                    return (
                      <tr key={r.student_pk} className="hover:bg-bg/40 transition-colors">
                        <td className="py-3 px-4 text-muted font-mono">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-brand/10 border border-brand/20 text-brand font-semibold text-xs flex items-center justify-center shrink-0">
                              {r.full_name?.charAt(0) || 'S'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-ink truncate">{r.full_name}</p>
                              <p className="text-[11px] text-muted truncate">{r.email || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-ink">{r.roll_number}</td>
                        <td className="py-3 px-4">
                          <Badge variant={isPresent ? 'present' : 'absent'} size="sm">
                            {isPresent ? <Check className="w-3 h-3 mr-0.5" /> : <X className="w-3 h-3 mr-0.5" />}
                            <span>{r.status}</span>
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-muted text-xs">
                          {r.marked_at
                            ? new Date(r.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </td>
                        <td className={`py-3 px-4 text-xs ${distanceColor}`}>
                          {r.distance_meters != null ? `${r.distance_meters}m` : '—'}
                        </td>
                        <td className="py-3 px-4">
                          {r.selfie_url ? (
                            <button
                              onClick={() => setSelfieModal({ open: true, url: r.selfie_url, name: r.full_name, roll: r.roll_number, time: r.marked_at, distance: r.distance_meters })}
                              className="w-8 h-8 rounded-lg overflow-hidden border border-line hover:border-brand transition-colors cursor-pointer block"
                              title="Click to view full facial photo"
                            >
                              <img src={r.selfie_url} alt={`${r.full_name} selfie`} className="w-full h-full object-cover" />
                            </button>
                          ) : (
                            <span className="text-muted text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {r.is_teacher_override ? (
                            <Badge variant="brand" size="sm" title={r.override_notes || 'Marked by teacher directly'}>
                              <Smartphone className="w-3 h-3 mr-1" /> No Phone
                            </Badge>
                          ) : r.source === 'AUTO_VERIFIED' ? (
                            <Badge variant="present" size="sm">
                              <Camera className="w-3 h-3 mr-1" /> GPS + Selfie
                            </Badge>
                          ) : r.status === 'ABSENT' ? (
                            <span className="text-muted text-xs">—</span>
                          ) : (
                            <Badge variant="neutral" size="sm">{r.source || 'Manual'}</Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {r.status === 'ABSENT' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant={lectureMeta?.is_attendance_open ? "success" : "ghost"}
                                size="sm"
                                onClick={() => directMarkPresent(r)}
                                disabled={!lectureMeta?.is_attendance_open || directMarkingId === r.student_pk}
                                loading={directMarkingId === r.student_pk}
                                className={`h-7 text-xs px-2.5 font-medium ${!lectureMeta?.is_attendance_open ? 'opacity-40 cursor-not-allowed' : ''}`}
                                title={!lectureMeta?.is_attendance_open ? 'Attendance window is closed' : 'Student has no phone: Direct mark Present in classroom'}
                              >
                                <Zap className="w-3 h-3 mr-1" />
                                <span>{directMarkingId === r.student_pk ? 'Marking...' : !lectureMeta?.is_attendance_open ? 'Window Closed' : 'Mark (No Phone)'}</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openOverride(r)}
                                disabled={!lectureMeta?.is_attendance_open}
                                className={`h-7 w-7 p-0 ${!lectureMeta?.is_attendance_open ? 'opacity-40 cursor-not-allowed' : ''}`}
                                title={!lectureMeta?.is_attendance_open ? 'Attendance window is closed' : 'Custom status override'}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openOverride(r)}
                              disabled={!lectureMeta?.is_attendance_open}
                              className={`h-7 text-xs px-2.5 ${!lectureMeta?.is_attendance_open ? 'opacity-40 cursor-not-allowed' : ''}`}
                              title={!lectureMeta?.is_attendance_open ? 'Attendance window is closed' : 'Teacher override or correction'}
                            >
                              <Edit3 className="w-3 h-3 mr-1" />
                              <span>Override</span>
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* ── MOBILE VIEW: INTERACTIVE STUDENT CARDS (No broken horizontal scrolling!) ── */}
            <div className="md:hidden divide-y divide-line">
              {filteredRoster.map((r, idx) => {
                const isPresent = r.status === 'PRESENT'
                return (
                  <div key={r.student_pk} className="p-3.5 flex flex-col gap-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-brand/10 border border-brand/20 text-brand font-semibold text-xs flex items-center justify-center shrink-0">
                          {r.full_name?.charAt(0)?.toUpperCase() || 'S'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink truncate leading-tight">{r.full_name}</p>
                          <p className="text-xs text-muted font-mono mt-0.5">Roll No: {r.roll_number}</p>
                        </div>
                      </div>

                      <Badge variant={isPresent ? 'present' : 'absent'} size="sm">
                        {isPresent ? 'Present' : 'Absent'}
                      </Badge>
                    </div>

                    {/* Metadata chips */}
                    <div className="flex items-center justify-between text-xs text-muted pt-1 border-t border-line/50">
                      <div className="flex items-center gap-3">
                        {r.selfie_url && (
                          <button
                            type="button"
                            onClick={() => setSelfieModal({ open: true, url: r.selfie_url, name: r.full_name, roll: r.roll_number, time: r.marked_at, distance: r.distance_meters })}
                            className="inline-flex items-center gap-1.5 p-1 pr-2 rounded-lg border border-brand/30 bg-brand/5 hover:bg-brand/10 active:scale-95 transition-all cursor-pointer group shadow-2xs"
                            title="Click to view full photo"
                          >
                            <div className="w-8 h-8 rounded-md overflow-hidden border border-brand/30 shrink-0 bg-neutral-200 dark:bg-neutral-800 shadow-2xs">
                              <img
                                src={r.selfie_url}
                                alt={`${r.full_name} selfie`}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                                loading="lazy"
                              />
                            </div>
                            <span className="text-xs font-semibold text-brand flex items-center gap-1">
                              <span>Photo</span>
                              <Maximize2 className="w-3 h-3 opacity-70 group-hover:opacity-100" />
                            </span>
                          </button>
                        )}
                        {r.distance_meters != null && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{r.distance_meters}m</span>
                          </span>
                        )}
                        {r.marked_at && (
                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(r.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {r.status === 'ABSENT' ? (
                          <Button
                            variant={lectureMeta?.is_attendance_open ? "success" : "ghost"}
                            size="sm"
                            onClick={() => directMarkPresent(r)}
                            disabled={!lectureMeta?.is_attendance_open || directMarkingId === r.student_pk}
                            loading={directMarkingId === r.student_pk}
                            className={`h-7 text-xs px-2.5 ${!lectureMeta?.is_attendance_open ? 'opacity-40 cursor-not-allowed' : ''}`}
                            title={!lectureMeta?.is_attendance_open ? 'Attendance window is closed' : 'Mark (No Phone)'}
                          >
                            <Zap className="w-3 h-3 mr-1" />
                            <span>{!lectureMeta?.is_attendance_open ? 'Closed' : 'No Phone'}</span>
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openOverride(r)}
                          disabled={!lectureMeta?.is_attendance_open}
                          className={`h-7 text-xs px-2.5 ${!lectureMeta?.is_attendance_open ? 'opacity-40 cursor-not-allowed' : ''}`}
                          title={!lectureMeta?.is_attendance_open ? 'Attendance window is closed' : 'Edit status'}
                        >
                          <Edit3 className="w-3 h-3 mr-1" />
                          <span>Edit</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>

      {/* ──────────────── Start New Lecture Modal ──────────────── */}
      <Modal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        title="Start New Lecture Session"
        description="Launch an attendance window for students enrolled in your assigned division."
      >
        <div className="space-y-4">
          {/* Step 1: Division / Class Batch */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              1. Class / Academic Division *
            </label>
            <select
              className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 shadow-xs cursor-pointer"
              value={startForm.division_id}
              onChange={e => {
                const divId = e.target.value
                const selectedDiv = divisions.find(d => d.id === divId)
                const semList = getSemestersForDivision(selectedDiv)
                const defaultSem = selectedDiv?.current_semester || semList[0] || 1
                setStartForm(s => ({
                  ...s,
                  division_id: divId,
                  semester: defaultSem,
                  subject_id: '',
                }))
              }}
            >
              <option value="">— Choose class / division —</option>
              {divisions.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} Div {d.division_name} (Active: Sem {d.current_semester})
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Academic Semester */}
          {startForm.division_id && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                2. Academic Semester *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {getSemestersForDivision(divisions.find(d => d.id === startForm.division_id)).map(semNum => (
                  <button
                    key={semNum}
                    type="button"
                    onClick={() => {
                      setStartForm(s => ({
                        ...s,
                        semester: semNum,
                        subject_id: '',
                      }))
                    }}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
                      Number(startForm.semester) === Number(semNum)
                        ? 'border-brand bg-brand/10 text-brand ring-2 ring-brand/20'
                        : 'border-line bg-surface text-ink hover:bg-bg'
                    }`}
                  >
                    <span>Semester {semNum}</span>
                    {Number(startForm.semester) === Number(semNum) && (
                      <Check className="w-3.5 h-3.5 text-brand" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Assigned Subject */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              3. Assigned Subject *
            </label>
            {!startForm.division_id ? (
              <div className="p-3 bg-bg border border-line rounded-lg text-xs text-muted">
                Please select a Class / Division first above.
              </div>
            ) : filteredSubjectsForStart.length === 0 ? (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-lg text-xs text-amber-800 dark:text-amber-200">
                ⚠️ No subjects assigned to you for {divisions.find(d => d.id === startForm.division_id)?.name} - Semester {startForm.semester}. Please select another semester or ask Admin to assign subjects.
              </div>
            ) : (
              <select
                className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 shadow-xs cursor-pointer"
                value={startForm.subject_id}
                onChange={e => {
                  setStartForm(s => ({
                    ...s,
                    subject_id: e.target.value,
                  }))
                }}
              >
                <option value="">— Choose assigned subject —</option>
                {filteredSubjectsForStart.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) · Sem {s.semester || startForm.semester}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5 flex items-center justify-between">
              <span>4. Lecture Duration & Attendance Window</span>
              <span className="text-[10px] text-brand font-mono font-medium lowercase">
                window: duration + 1h (max 2h)
              </span>
            </label>
            <select
              className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 shadow-xs cursor-pointer"
              value={startForm.duration_minutes || 60}
              onChange={e => setStartForm(s => ({ ...s, duration_minutes: parseInt(e.target.value, 10) }))}
            >
              <option value={30}>30 Minutes (Window: 1.5 hrs from start / 1 hr after class)</option>
              <option value={45}>45 Minutes (Window: 1 hr 45 min / 1 hr after class)</option>
              <option value={60}>60 Minutes (Standard 1 Hour / Max 2 hrs window)</option>
              <option value={90}>90 Minutes (1.5 Hours / Max 2 hrs window)</option>
              <option value={120}>120 Minutes (2 Hours Block / Max 2 hrs window)</option>
            </select>
            <p className="text-[11px] text-muted mt-1">
              {startForm.duration_minutes === 30
                ? '⏱️ 30-min lecture: Student attendance window stays open during class + 1 hour after class ends (total 90 mins from start).'
                : `⏱️ ${startForm.duration_minutes || 60}-min lecture: Student attendance window stays open during class + 1 hour after class ends (capped at max 2 hours).`}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              5. Lecture Topic (Optional)
            </label>
            <Input
              type="text"
              placeholder="e.g. Introduction to Data Structures & Arrays"
              value={startForm.topic}
              onChange={e => setStartForm(s => ({ ...s, topic: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-line">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowStartModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleStartLecture}
              loading={starting}
              disabled={starting}
            >
              <Plus className="w-4 h-4 mr-1" />
              <span>Start Lecture Now</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* ──────────────── Selfie Preview Modal ──────────────── */}
      <Modal
        isOpen={selfieModal.open}
        onClose={() => setSelfieModal({ ...selfieModal, open: false })}
        title={`Verification Photo: ${selfieModal.name}`}
        description="Captured live selfie during student attendance check-in."
        size="md"
      >
        <div className="space-y-4">
          {selfieModal.url ? (
            <div className="space-y-3">
              {(selfieModal.roll || selfieModal.time || selfieModal.distance != null) && (
                <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-bg border border-line text-xs">
                  {selfieModal.roll && (
                    <span className="font-mono font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded">
                      Roll: {selfieModal.roll}
                    </span>
                  )}
                  {selfieModal.time && (
                    <span className="text-muted flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(selfieModal.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {selfieModal.distance != null && (
                    <span className="text-muted flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {selfieModal.distance}m from geofence
                    </span>
                  )}
                </div>
              )}

              <div className="rounded-xl overflow-hidden border border-line bg-black/5 max-h-[65vh] flex items-center justify-center p-1">
                <img
                  src={selfieModal.url}
                  alt={`${selfieModal.name} selfie proof`}
                  className="w-full h-auto max-h-[60vh] object-contain rounded-lg shadow-sm"
                />
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Camera}
              title="No Photo Proof"
              description="No selfie proof was captured for this record."
            />
          )}

          <div className="flex justify-end pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelfieModal({ ...selfieModal, open: false })}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* ──────────────── Teacher Override Modal ──────────────── */}
      <Modal
        isOpen={overrideModal.open}
        onClose={() => !submittingOverride && setOverrideModal({ open: false, student: null })}
        title={`Manual Attendance Override`}
        description={overrideModal.student ? `Reviewing attendance for ${overrideModal.student.full_name} (${overrideModal.student.roll_number})` : ''}
      >
        {overrideModal.student && (
          <div className="space-y-4">
            <div className="bg-bg border border-line rounded-lg p-3 text-xs grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted block">Roll Number:</span>
                <span className="font-mono font-semibold text-ink">{overrideModal.student.roll_number}</span>
              </div>
              <div>
                <span className="text-muted block">Current Status:</span>
                <Badge variant={overrideModal.student.status === 'PRESENT' ? 'present' : 'absent'} size="sm">
                  {overrideModal.student.status}
                </Badge>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
                Set Attendance Status
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setOverrideStatus('PRESENT')}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                    overrideStatus === 'PRESENT'
                      ? 'border-present bg-present/10 ring-2 ring-present/20'
                      : 'border-line hover:border-line/80'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-present/20 text-present flex items-center justify-center shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink">PRESENT</p>
                    <p className="text-[10px] text-muted">Present in room</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOverrideStatus('ABSENT')}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                    overrideStatus === 'ABSENT'
                      ? 'border-absent bg-absent/10 ring-2 ring-absent/20'
                      : 'border-line hover:border-line/80'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-absent/20 text-absent flex items-center justify-center shrink-0">
                    <XCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ink">ABSENT</p>
                    <p className="text-[10px] text-muted">Not in classroom</p>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Audit Reason / Notes <span className="text-absent">*</span>
              </label>
              <textarea
                className="w-full bg-surface border border-line rounded-lg p-3 text-xs text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand/30 shadow-xs min-h-[90px] resize-none"
                placeholder="Required (min 5 chars) — e.g. Student present without smartphone; or Verified in-class physically; etc. Recorded in compliance logs."
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
              />
              <div className="flex justify-between items-center text-[11px] text-muted mt-1">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-muted" /> Audited with faculty ID
                </span>
                <span className={overrideReason.trim().length < 5 ? 'text-absent' : 'text-present font-semibold'}>
                  {overrideReason.trim().length} chars (min 5)
                </span>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-line">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOverrideModal({ open: false, student: null })}
                disabled={submittingOverride}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={submitOverride}
                disabled={submittingOverride || overrideReason.trim().length < 5}
                loading={submittingOverride}
              >
                <Edit3 className="w-4 h-4 mr-1" />
                <span>Confirm {overrideStatus}</span>
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
