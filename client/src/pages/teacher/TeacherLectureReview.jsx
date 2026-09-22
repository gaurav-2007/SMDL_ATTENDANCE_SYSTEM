import { useEffect, useState } from 'react'
import {
  Plus, RefreshCw, UserCheck, XCircle, Camera, MapPin,
  Edit3, X, CheckCircle2, AlertTriangle, Loader2, Users,
  ClipboardList, BookOpen, ChevronDown, Search, Smartphone, Zap
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        onClick={e => e.stopPropagation()}
        className={`relative glass rounded-2xl border border-white/10 shadow-2xl w-full ${wide ? 'max-w-4xl' : 'max-w-md'} max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-white font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="btn-icon btn-ghost !w-8 !h-8" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-6 flex-1">{children}</div>
      </div>
    </div>
  )
}

export default function TeacherLectureReview() {
  const [lectures, setLectures] = useState([])
  const [selectedLecture, setSelectedLecture] = useState('')
  const [loadingLectures, setLoadingLectures] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [subjects, setSubjects] = useState([])
  const [divisions, setDivisions] = useState([])
  const [showStartModal, setShowStartModal] = useState(false)
  const [startForm, setStartForm] = useState({ subject_id: '', division_id: '', topic: '' })
  const [starting, setStarting] = useState(false)

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

  useEffect(() => { loadLectures(); loadFilters() }, [])

  useEffect(() => {
    if (selectedLecture) loadRoster(selectedLecture)
    else { setRoster([]); setSummary({ total: 0, present: 0, absent: 0 }); setLectureMeta(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLecture])

  async function loadLectures() {
    try {
      setLoadingLectures(true)
      const { data } = await api.get('/lectures/active')
      const list = data?.data?.lectures || []
      setLectures(list)
      if (list.length === 1 && !selectedLecture) setSelectedLecture(list[0].id)
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to load lectures')
    } finally { setLoadingLectures(false) }
  }

  async function loadFilters() {
    try {
      const [sRes, dRes] = await Promise.allSettled([
        api.get('/academic/subjects'),
        api.get('/academic/divisions'),
      ])
      if (sRes.status === 'fulfilled') setSubjects(sRes.value?.data?.data?.subjects || [])
      if (dRes.status === 'fulfilled') setDivisions(dRes.value?.data?.data?.divisions || [])
    } catch (e) { /* noop */ }
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
    } finally { setLoadingRoster(false) }
  }

  async function refresh() {
    try { setRefreshing(true); if (selectedLecture) await loadRoster(selectedLecture); await loadLectures() }
    finally { setRefreshing(false) }
  }

  async function handleStartLecture() {
    if (!startForm.subject_id || !startForm.division_id) { toast.error('Subject and Division are required'); return }
    try {
      setStarting(true)
      const { data } = await api.post('/lectures', startForm)
      const newLec = data?.data?.lecture
      toast.success(`✅ ${newLec?.subject?.name || 'Lecture'} started successfully!`)
      setShowStartModal(false)
      setStartForm({ subject_id: '', division_id: '', topic: '' })
      await loadLectures()
      if (newLec?.id) {
        setSelectedLecture(newLec.id)
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to start lecture')
    } finally { setStarting(false) }
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
    if (overrideReason.trim().length < 5) { toast.error('Please enter a reason (min 5 characters)'); return }
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
    } finally { setSubmittingOverride(false) }
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
    <div className="animate-fade-in">
      <div className="page-header flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="page-title">Attendance Review</h2>
          <p className="page-subtitle">Live roster with selfie photo verification & teacher manual override</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="btn-secondary" disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
          <button id="start-lecture-btn" onClick={() => setShowStartModal(true)} className="btn-primary">
            <Plus size={16} /> Start New Lecture
          </button>
        </div>
      </div>

      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div>
            <label className="label">Select Active Lecture (Today)</label>
            {loadingLectures ? (
              <div className="input flex items-center gap-2"><Loader2 className="animate-spin w-4 h-4" /> Loading…</div>
            ) : lectures.length === 0 ? (
              <div className="input !py-6 text-center text-brand-muted text-sm">
                No active lectures today. Click <span className="text-brand-accent font-semibold">Start New Lecture</span> above.
              </div>
            ) : (
              <div className="relative">
                <select
                  id="lecture-select-teacher"
                  className="input appearance-none pr-10"
                  value={selectedLecture}
                  onChange={e => setSelectedLecture(e.target.value)}
                >
                  <option value="">— Select a lecture to view roster —</option>
                  {lectures.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.subject?.name || 'Subject'} · {l.division?.name} Div{l.division?.division_name || ''} · {l.start_time || ''} · {l.topic || ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none" />
              </div>
            )}
          </div>
          {lectureMeta && (
            <div className="md:col-span-2 card-sm !p-4 !bg-brand-dark/70">
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <div><span className="text-brand-muted">Subject: </span><span className="text-white font-semibold">{lectureMeta.subject?.name}</span> <span className="text-brand-muted text-xs">({lectureMeta.subject?.code})</span></div>
                <div><span className="text-brand-muted">Division: </span><span className="text-white font-semibold">{lectureMeta.division?.name} Div{lectureMeta.division?.division_name || ''}</span></div>
                <div><span className="text-brand-muted">Topic: </span><span className="text-white">{lectureMeta.topic || '—'}</span></div>
                <div><span className="text-brand-muted">Date: </span><span className="text-white">{lectureMeta.lecture_date ? new Date(lectureMeta.lecture_date).toLocaleDateString() : '—'}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedLecture && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="card flex items-center gap-4">
            <div className="stat-icon bg-blue-500/20 text-blue-400"><Users size={22} /></div>
            <div>
              <p className="text-brand-muted text-xs">Total Students</p>
              <p className="text-white text-2xl font-bold">{summary.total}</p>
            </div>
          </div>
          <div className="card flex items-center gap-4">
            <div className="stat-icon bg-green-500/20 text-green-400"><CheckCircle2 size={22} /></div>
            <div>
              <p className="text-brand-muted text-xs">Present</p>
              <p className="text-white text-2xl font-bold">{summary.present}</p>
            </div>
          </div>
          <div className="card flex items-center gap-4">
            <div className="stat-icon bg-red-500/20 text-red-400"><XCircle size={22} /></div>
            <div>
              <p className="text-brand-muted text-xs">Absent</p>
              <p className="text-white text-2xl font-bold">{summary.absent}</p>
            </div>
          </div>
          <div className="card flex items-center gap-4">
            <div className={`stat-icon ${pctSafe ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}><ClipboardList size={22} /></div>
            <div>
              <p className="text-brand-muted text-xs">Attendance %</p>
              <div className="flex items-center gap-2">
                <p className="text-white text-2xl font-bold">{pct}%</p>
                <span className={`badge text-[10px] ${pctSafe ? 'badge-active' : 'badge-rejected'}`}>{pctSafe ? '✓ OK' : '⚠️ Low'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card !p-0 overflow-hidden">
        <div className="p-6 pb-4 border-b border-brand-border/40">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                <Users size={20} className="text-brand-accent" />
                Live Class Roster {selectedLecture ? '' : '(Select a lecture above)'}
              </h3>
              <p className="text-brand-muted text-xs mt-0.5">
                Students can verify attendance via phone, or teachers can directly mark phone-less students present.
              </p>
            </div>
            {selectedLecture && (
              <span className="text-brand-muted text-xs font-mono">
                Updated {loadingRoster ? '…' : new Date().toLocaleTimeString()}
              </span>
            )}
          </div>

          {selectedLecture && (
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pt-1">
              {/* Direct Search Bar */}
              <div className="relative w-full sm:w-80">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-muted" />
                <input
                  type="text"
                  className="form-input !pl-10 !py-2 text-sm w-full"
                  placeholder="Search Name or Roll No..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-white text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5 w-full sm:w-auto justify-center sm:justify-start">
                <button
                  type="button"
                  onClick={() => setFilterTab('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filterTab === 'ALL'
                      ? 'bg-brand-accent text-white shadow-sm'
                      : 'text-brand-muted hover:text-white'
                  }`}
                >
                  All ({roster.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('PRESENT')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filterTab === 'PRESENT'
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'text-brand-muted hover:text-green-400'
                  }`}
                >
                  Present ({summary.present})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('ABSENT')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filterTab === 'ABSENT'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-brand-muted hover:text-red-400'
                  }`}
                >
                  Absent ({summary.absent})
                </button>
              </div>
            </div>
          )}
        </div>

        {!selectedLecture ? (
          <div className="text-center py-20 px-6">
            <BookOpen size={44} className="mx-auto text-brand-muted mb-4" />
            <p className="text-white font-semibold text-lg">No lecture selected</p>
            <p className="text-brand-muted text-sm mt-1">
              Pick a lecture from the dropdown or start a new one to view the class roster.
            </p>
          </div>
        ) : loadingRoster ? (
          <div className="text-center py-20 text-brand-muted">
            <Loader2 className="animate-spin w-8 h-8 mx-auto mb-2 text-brand-accent" /> Loading roster…
          </div>
        ) : filteredRoster.length === 0 ? (
          <div className="text-center py-16 px-6">
            <Users size={36} className="mx-auto text-brand-muted mb-3" />
            <p className="text-white font-semibold">
              {searchQuery ? `No students found matching "${searchQuery}"` : 'No students found'}
            </p>
            <p className="text-brand-muted text-xs mt-1">
              {searchQuery
                ? 'Check spelling or clear the search filter.'
                : 'Students must be enrolled in this division to appear here.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="btn-secondary btn-sm mt-3"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student</th>
                  <th>Roll No</th>
                  <th>Status</th>
                  <th>Marked At</th>
                  <th>📍 GPS</th>
                  <th>📸 Selfie</th>
                  <th>Source</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoster.map((r, idx) => {
                  const distanceColor =
                    r.distance_meters == null
                      ? ''
                      : r.distance_meters <= 500
                      ? 'text-green-400'
                      : 'text-yellow-400'
                  return (
                    <tr key={r.student_pk} className="hover:bg-white/[0.02]">
                      <td className="text-brand-muted">{idx + 1}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                            {r.full_name?.charAt(0) || 'S'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate">{r.full_name}</p>
                            <p className="text-brand-muted text-[11px] truncate">{r.email || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="font-mono text-brand-muted font-medium">{r.roll_number}</td>
                      <td>
                        <span
                          className={`badge ${
                            r.status === 'PRESENT' ? 'badge-active' : 'badge-rejected'
                          }`}
                        >
                          {r.status === 'PRESENT' ? <UserCheck size={12} /> : <XCircle size={12} />}
                          <span className="ml-1">{r.status}</span>
                        </span>
                      </td>
                      <td className="text-xs text-brand-muted">
                        {r.marked_at
                          ? new Date(r.marked_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className={`text-xs ${distanceColor}`}>
                        {r.distance_meters != null ? `${r.distance_meters}m` : '—'}
                      </td>
                      <td>
                        {r.selfie_url ? (
                          <button
                            onClick={() =>
                              setSelfieModal({ open: true, url: r.selfie_url, name: r.full_name })
                            }
                            className="w-10 h-10 rounded-lg overflow-hidden border border-brand-border hover:border-brand-accent transition-colors block"
                            title="Click to view full selfie"
                          >
                            <img
                              src={r.selfie_url}
                              alt={`${r.full_name} selfie`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ) : (
                          <Camera size={18} className="text-brand-muted/40" />
                        )}
                      </td>
                      <td>
                        {r.is_teacher_override ? (
                          <span
                            className="badge badge-info flex items-center gap-1 text-[11px]"
                            title={r.override_notes || 'Marked by teacher directly in classroom'}
                          >
                            <Smartphone size={11} /> No Phone (Teacher)
                          </span>
                        ) : r.source === 'AUTO_VERIFIED' ? (
                          <span className="badge badge-active flex items-center gap-1 text-[11px]">
                            <Camera size={11} /> Selfie + GPS
                          </span>
                        ) : r.status === 'ABSENT' ? (
                          <span className="text-brand-muted text-xs">—</span>
                        ) : (
                          <span className="badge badge-pending">{r.source || 'Unknown'}</span>
                        )}
                      </td>
                      <td className="text-right">
                        {r.status === 'ABSENT' ? (
                          <div className="flex items-center justify-end gap-2">
                            {/* Direct phone-less mark present button */}
                            <button
                              onClick={() => directMarkPresent(r)}
                              disabled={directMarkingId === r.student_pk}
                              className="btn-primary !bg-emerald-600 hover:!bg-emerald-500 !text-white !py-1.5 !px-3 text-xs flex items-center gap-1.5 shadow-sm"
                              title="Student has no phone: Direct mark PRESENT in classroom without selfie/GPS"
                            >
                              <Zap size={13} className={directMarkingId === r.student_pk ? 'animate-spin' : ''} />
                              <span>{directMarkingId === r.student_pk ? 'Marking…' : 'Mark (No Phone)'}</span>
                            </button>
                            <button
                              onClick={() => openOverride(r)}
                              className="btn-secondary btn-sm !p-1.5"
                              title="Custom status override"
                            >
                              <Edit3 size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => openOverride(r)}
                            className="btn-secondary btn-sm"
                            title="Teacher override or correction"
                          >
                            <Edit3 size={13} />
                            <span>Override</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ──────────────── Start New Lecture Modal ──────────────── */}
      <Modal open={showStartModal} onClose={() => setShowStartModal(false)} title="Start New Lecture">
        <div className="space-y-4">
          <div>
            <label className="label">Subject</label>
            <select
              className="input"
              value={startForm.subject_id}
              onChange={e => setStartForm(s => ({ ...s, subject_id: e.target.value }))}
            >
              <option value="">— Choose subject —</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code}) · {s.divisions?.name || ''} Div{s.divisions?.division_name || ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Division / Class</label>
            <select
              className="input"
              value={startForm.division_id}
              onChange={e => setStartForm(s => ({ ...s, division_id: e.target.value }))}
            >
              <option value="">— Choose division —</option>
              {divisions.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} Div {d.division_name} · {d.courses?.code || d.courses?.name || ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Topic (optional)</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Introduction to Python Functions"
              value={startForm.topic}
              onChange={e => setStartForm(s => ({ ...s, topic: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button className="btn-secondary flex-1" onClick={() => setShowStartModal(false)}>Cancel</button>
            <button className="btn-primary flex-1" onClick={handleStartLecture} disabled={starting}>
              {starting ? <Loader2 className="animate-spin" /> : <Plus size={16} />}
              {starting ? 'Starting…' : 'Start Lecture Now'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ──────────────── Selfie Preview Modal ──────────────── */}
      <Modal open={selfieModal.open} onClose={() => setSelfieModal({ ...selfieModal, open: false })} wide title={`Selfie — ${selfieModal.name}`}>
        {selfieModal.url ? (
          <div className="rounded-xl overflow-hidden bg-black/60 border border-brand-border">
            <img src={selfieModal.url} alt={`${selfieModal.name} live selfie`} className="w-full h-auto max-h-[70vh] object-contain mx-auto" />
          </div>
        ) : (
          <div className="text-center py-16 text-brand-muted"><Camera size={44} className="mx-auto mb-3" /> No selfie captured.</div>
        )}
      </Modal>

      {/* ──────────────── Teacher Override Modal ──────────────── */}
      <Modal
        open={overrideModal.open}
        onClose={() => !submittingOverride && setOverrideModal({ open: false, student: null })}
        title={`Override Attendance — ${overrideModal.student?.full_name || ''}`}
      >
        {overrideModal.student && (
          <div className="space-y-5">
            <div className="card-sm !p-4 !bg-brand-dark/70">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-brand-muted">Roll No</span><p className="text-white font-semibold font-mono">{overrideModal.student.roll_number}</p></div>
                <div><span className="text-brand-muted">Current Status</span><p className={`font-semibold ${overrideModal.student.status === 'PRESENT' ? 'text-green-400' : 'text-red-400'}`}>{overrideModal.student.status}</p></div>
                <div><span className="text-brand-muted">Marked At</span><p className="text-white">{overrideModal.student.marked_at ? new Date(overrideModal.student.marked_at).toLocaleString() : '—'}</p></div>
                <div><span className="text-brand-muted">Current Source</span><p className="text-white">{overrideModal.student.is_teacher_override ? 'Teacher override' : overrideModal.student.source || (overrideModal.student.status === 'ABSENT' ? 'Not marked' : 'Student')}</p></div>
              </div>
            </div>

            <div>
              <label className="label">Mark this student as</label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${overrideStatus === 'PRESENT' ? 'border-green-500/60 bg-green-500/10' : 'border-brand-border hover:border-white/20'}`}>
                  <input type="radio" className="hidden" checked={overrideStatus === 'PRESENT'} onChange={() => setOverrideStatus('PRESENT')} />
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center"><UserCheck size={20} /></div>
                    <div>
                      <p className="text-white font-semibold">PRESENT</p>
                      <p className="text-brand-muted text-[11px]">Physically present in class</p>
                    </div>
                  </div>
                </label>
                <label className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${overrideStatus === 'ABSENT' ? 'border-red-500/60 bg-red-500/10' : 'border-brand-border hover:border-white/20'}`}>
                  <input type="radio" className="hidden" checked={overrideStatus === 'ABSENT'} onChange={() => setOverrideStatus('ABSENT')} />
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center"><XCircle size={20} /></div>
                    <div>
                      <p className="text-white font-semibold">ABSENT</p>
                      <p className="text-brand-muted text-[11px]">Not present in class</p>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="label">Reason / Notes <span className="text-red-400">*</span></label>
              <textarea
                className="input min-h-[100px] resize-none"
                placeholder="Required (min 5 chars) — e.g. Student has no smartphone, Present physically; or Suspicious proxy attendance, Selfie does not match; etc. This will be recorded in audit logs."
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
              />
              <div className="flex justify-between mt-2 text-[11px] text-brand-muted">
                <span><AlertTriangle size={12} className="inline mr-1" />Changes are audited with your teacher ID and timestamp.</span>
                <span className={overrideReason.trim().length < 5 ? 'text-red-400' : 'text-green-400'}>{overrideReason.trim().length} chars (min 5)</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                className="btn-secondary flex-1"
                onClick={() => setOverrideModal({ open: false, student: null })}
                disabled={submittingOverride}
              >
                Cancel
              </button>
              <button
                className="btn-primary flex-1"
                onClick={submitOverride}
                disabled={submittingOverride || overrideReason.trim().length < 5}
                style={{ opacity: overrideReason.trim().length < 5 ? 0.5 : 1 }}
              >
                {submittingOverride ? <Loader2 className="animate-spin" /> : <Edit3 size={16} />}
                {submittingOverride ? 'Submitting…' : `Confirm ${overrideStatus}`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
