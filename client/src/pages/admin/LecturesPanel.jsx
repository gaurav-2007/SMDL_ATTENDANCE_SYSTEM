import { useEffect, useState, useCallback } from 'react'
import {
  BookOpen, Plus, X, Clock, Calendar, Users,
  Trash2, RefreshCw, ChevronDown, Edit3, CheckCircle,
  AlertCircle, MapPin, UserCheck, Layers
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Badge, Button, Input, Modal, StatCard, Skeleton, EmptyState
} from '../../components/ui'

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const SLOTS = ['08:00','09:00','10:00','11:00','11:30','12:00','12:30','13:00','13:30','14:00','15:00','16:00','17:00','18:00']

function getTodayDateStr() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return '—'
  const parts = dateStr.toString().slice(0, 10).split('-')
  if (parts.length === 3) {
    const [y, m, d] = parts
    const dt = new Date(Number(y), Number(m) - 1, Number(d))
    return dt.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }
  return new Date(dateStr).toLocaleDateString('en-IN')
}

export default function LecturesPanel() {
  const [lectures, setLectures]   = useState([])
  const [teachers, setTeachers]   = useState([])
  const [subjects, setSubjects]   = useState([])
  const [divisions, setDivisions] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editingLecture, setEditingLecture] = useState(null)
  const [liveDateTime, setLiveDateTime] = useState('')

  useEffect(() => {
    function updateClock() {
      const now = new Date()
      const dStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
      const tStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      setLiveDateTime(`${dStr} • ${tStr}`)
    }
    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [lRes, tRes, sRes, dRes] = await Promise.all([
        api.get('/lectures'),
        api.get('/admin/teachers'),
        api.get('/academic/subjects'),
        api.get('/academic/divisions'),
      ])
      setLectures(lRes.data.data?.lectures || [])
      setTeachers((tRes.data.data?.teachers || []).filter(t => t.status === 'ACTIVE'))
      setSubjects(sRes.data.data?.subjects || [])
      setDivisions(dRes.data.data?.divisions || [])
    } catch (err) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const stats = {
    total: lectures.length,
    scheduled: lectures.filter(l => l.status === 'SCHEDULED' || l.status === 'UPCOMING').length,
    ongoing: lectures.filter(l => l.status === 'ONGOING').length,
    completed: lectures.filter(l => l.status === 'COMPLETED').length,
  }

  function renderStatusBadge(status) {
    switch (status) {
      case 'ONGOING':
        return <Badge variant="live" pulseDot>Ongoing</Badge>
      case 'SCHEDULED':
      case 'UPCOMING':
        return <Badge variant="brand" dot>Scheduled</Badge>
      case 'COMPLETED':
        return <Badge variant="neutral">Completed</Badge>
      case 'RESCHEDULED':
        return <Badge variant="grace">Rescheduled</Badge>
      case 'CANCELLED':
        return <Badge variant="absent">Cancelled</Badge>
      default:
        return <Badge variant="neutral">{status || 'Unknown'}</Badge>
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-ink tracking-tight">
            Lecture Schedule & Operations
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            Monitor real-time classrooms, assign faculty proxies, and manage session status
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {liveDateTime && (
            <div className="px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-mono font-medium text-ink flex items-center gap-2 shadow-2xs">
              <Clock size={13} className="text-brand shrink-0" />
              <span>{liveDateTime}</span>
            </div>
          )}
          <Button onClick={fetchAll} variant="outline" size="sm" className="gap-1.5">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button
            id="add-lecture-btn"
            onClick={() => setShowForm(true)}
            variant="primary"
            size="sm"
            className="gap-1.5"
          >
            <Plus size={15} /> Schedule Lecture
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Scheduled"
          label="Total Scheduled"
          value={loading ? '—' : stats.total}
          subtitle="All academic lectures"
          sub="All academic lectures"
          icon={BookOpen}
        />
        <StatCard
          title="Upcoming / Scheduled"
          label="Upcoming / Scheduled"
          value={loading ? '—' : stats.scheduled}
          subtitle="Scheduled sessions"
          sub="Scheduled sessions"
          icon={Calendar}
        />
        <StatCard
          title="Currently Live"
          label="Currently Live"
          value={loading ? '—' : stats.ongoing}
          subtitle="Active lecture right now"
          sub="Active lecture right now"
          icon={Clock}
        />
        <StatCard
          title="Completed Today"
          label="Completed Today"
          value={loading ? '—' : stats.completed}
          subtitle="Successfully conducted"
          sub="Successfully conducted"
          icon={CheckCircle}
        />
      </div>

      {/* Lectures Content Container */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : lectures.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No lectures scheduled"
            description="There are currently no active or upcoming classroom lectures configured."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowForm(true)}
                className="gap-1.5"
              >
                <Plus size={14} /> Schedule First Lecture
              </Button>
            }
          />
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-line bg-bg/50 text-xs font-semibold text-muted uppercase tracking-wider">
                    <th className="py-3 px-4">Curriculum Subject</th>
                    <th className="py-3 px-4">Assigned Faculty</th>
                    <th className="py-3 px-4">Division</th>
                    <th className="py-3 px-4">Scheduled Date & Time</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {lectures.map(l => (
                    <LectureRow
                      key={l.id}
                      lecture={l}
                      onRefresh={fetchAll}
                      onEdit={(lec) => setEditingLecture(lec)}
                      renderStatusBadge={renderStatusBadge}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Responsive Cards */}
            <div className="lg:hidden divide-y divide-line">
              {lectures.map(l => (
                <MobileLectureCard
                  key={l.id}
                  lecture={l}
                  onRefresh={fetchAll}
                  onEdit={(lec) => setEditingLecture(lec)}
                  renderStatusBadge={renderStatusBadge}
                />
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Add Lecture Modal */}
      {showForm && (
        <AddLectureModal
          teachers={teachers}
          subjects={subjects}
          divisions={divisions}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); fetchAll() }}
        />
      )}

      {/* Edit Lecture & Proxy Assignment Modal */}
      {editingLecture && (
        <EditLectureModal
          lecture={editingLecture}
          teachers={teachers}
          subjects={subjects}
          divisions={divisions}
          onClose={() => setEditingLecture(null)}
          onSuccess={() => { setEditingLecture(null); fetchAll() }}
        />
      )}
    </div>
  )
}

function LectureRow({ lecture: l, onRefresh, onEdit, renderStatusBadge }) {
  const [updating, setUpdating] = useState(false)

  async function updateStatus(status) {
    setUpdating(true)
    try {
      await api.patch(`/lectures/${l.id}/status`, { status })
      toast.success(`Lecture marked as ${status}`)
      onRefresh()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed')
    } finally {
      setUpdating(false)
    }
  }

  async function deleteLecture() {
    if (!confirm('Delete this lecture?')) return
    setUpdating(true)
    try {
      await api.delete(`/lectures/${l.id}`)
      toast.success('Lecture deleted')
      onRefresh()
    } catch (err) {
      toast.error('Delete failed')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <tr className={`hover:bg-bg/40 transition-colors ${updating ? 'opacity-50' : ''}`}>
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0">
            <BookOpen size={14} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-ink leading-tight text-sm truncate max-w-[200px]">
              {l.subjects?.name || '—'}
            </p>
            <p className="text-xs text-muted font-mono truncate mt-0.5">{l.subjects?.code}</p>
          </div>
        </div>
      </td>
      <td className="py-3.5 px-4">
        <p className="text-sm font-medium text-ink truncate max-w-[180px]">
          {l.teachers?.full_name || l.teacher?.full_name || '—'}
        </p>
      </td>
      <td className="py-3.5 px-4">
        <span className="text-xs font-medium text-ink bg-bg px-2 py-0.5 rounded border border-line">
          {l.divisions?.name || '—'}
        </span>
      </td>
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-1.5 text-xs text-ink">
          <Calendar size={13} className="text-muted shrink-0" />
          <span className="font-medium">{formatDisplayDate(l.lecture_date)}</span>
          <span className="text-muted">•</span>
          <Clock size={13} className="text-muted shrink-0" />
          <span className="font-mono text-muted">{l.start_time?.slice(0, 5)} – {l.end_time?.slice(0, 5)}</span>
        </div>
      </td>
      <td className="py-3.5 px-4">
        {renderStatusBadge(l.status)}
      </td>
      <td className="py-3.5 px-4 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(l)}
            className="gap-1 text-xs text-amber-700 hover:bg-amber-50 border-amber-200"
            title="Edit Lecture / Change Faculty (Proxy)"
          >
            <Edit3 size={12} /> Edit / Proxy
          </Button>

          {l.status === 'SCHEDULED' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => updateStatus('ONGOING')}
              className="bg-green-600 hover:bg-green-700 text-white text-xs py-1 px-2.5"
              title="Start lecture"
            >
              Start
            </Button>
          )}

          {l.status === 'ONGOING' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateStatus('COMPLETED')}
              className="gap-1 text-xs text-green-700 border-green-200 hover:bg-green-50"
              title="Mark complete"
            >
              <CheckCircle size={13} /> Done
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={deleteLecture}
            className="text-muted hover:text-red-600 p-1.5"
            title="Delete lecture"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </td>
    </tr>
  )
}

function MobileLectureCard({ lecture: l, onRefresh, onEdit, renderStatusBadge }) {
  const [updating, setUpdating] = useState(false)

  async function updateStatus(status) {
    setUpdating(true)
    try {
      await api.patch(`/lectures/${l.id}/status`, { status })
      toast.success(`Lecture marked as ${status}`)
      onRefresh()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed')
    } finally {
      setUpdating(false)
    }
  }

  async function deleteLecture() {
    if (!confirm('Delete this lecture?')) return
    setUpdating(true)
    try {
      await api.delete(`/lectures/${l.id}`)
      toast.success('Lecture deleted')
      onRefresh()
    } catch (err) {
      toast.error('Delete failed')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className={`p-4 space-y-3 ${updating ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0">
            <BookOpen size={16} />
          </div>
          <div>
            <h4 className="font-semibold text-ink text-sm leading-tight">{l.subjects?.name || '—'}</h4>
            <p className="text-xs text-muted font-mono mt-0.5">{l.subjects?.code}</p>
          </div>
        </div>
        <div>
          {renderStatusBadge(l.status)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs bg-bg/50 p-2.5 rounded-lg border border-line">
        <div>
          <span className="text-muted block text-[11px]">Faculty</span>
          <span className="font-medium text-ink truncate block">
            {l.teachers?.full_name || l.teacher?.full_name || '—'}
          </span>
        </div>
        <div>
          <span className="text-muted block text-[11px]">Division</span>
          <span className="font-medium text-ink">{l.divisions?.name || '—'}</span>
        </div>
        <div className="col-span-2">
          <span className="text-muted block text-[11px]">Date & Time</span>
          <div className="flex items-center gap-1.5 font-medium text-ink mt-0.5">
            <Calendar size={12} className="text-muted" />
            <span>{formatDisplayDate(l.lecture_date)}</span>
            <span className="text-muted">•</span>
            <Clock size={12} className="text-muted" />
            <span className="font-mono text-muted">{l.start_time?.slice(0, 5)} – {l.end_time?.slice(0, 5)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-line/60">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(l)}
          className="flex-1 text-xs text-amber-700 border-amber-200"
        >
          <Edit3 size={13} /> Edit / Proxy
        </Button>

        {l.status === 'SCHEDULED' && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => updateStatus('ONGOING')}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs"
          >
            Start
          </Button>
        )}

        {l.status === 'ONGOING' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateStatus('COMPLETED')}
            className="flex-1 text-xs text-green-700 border-green-200"
          >
            <CheckCircle size={13} /> Complete
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={deleteLecture}
          className="text-muted hover:text-red-600 p-2"
          title="Delete"
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  )
}

function AddLectureModal({ teachers, subjects, divisions, onClose, onSuccess }) {
  const [form, setForm] = useState({
    subject_id: '',
    teacher_id: '',
    division_id: '',
    lecture_date: getTodayDateStr(),
    start_time: '09:00',
    end_time: '10:00',
    room: '',
    topic: '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const filteredSubjects = form.division_id
    ? subjects.filter(s => !s.division_id || s.division_id === form.division_id)
    : subjects

  async function submit(e) {
    e.preventDefault()
    if (!form.subject_id || !form.teacher_id || !form.division_id) {
      return toast.error('Please fill all required fields')
    }
    setSaving(true)
    try {
      await api.post('/lectures', form)
      toast.success('Lecture scheduled!')
      onSuccess()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to schedule')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Schedule New Lecture"
      description="Create a classroom session and announce to division students"
      maxWidth="max-w-lg"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs font-semibold text-ink">Academic Division *</label>
            <select
              id="lecture-division"
              className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
              value={form.division_id}
              onChange={e => {
                const divId = e.target.value
                setForm(p => ({
                  ...p,
                  division_id: divId,
                  subject_id: ''
                }))
              }}
              required
            >
              <option value="">-- Select Class Division --</option>
              {divisions.map(d => (
                <option key={d.id} value={d.id}>
                  {d.courses?.code ? `[${d.courses.code}] ` : ''}{d.name} - Division {d.division_name} ({d.courses?.name || 'General'})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted">Select division first to filter associated curriculum subjects</p>
          </div>

          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs font-semibold text-ink">Subject *</label>
            <select
              id="lecture-subject"
              className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
              value={form.subject_id}
              onChange={e => set('subject_id', e.target.value)}
              required
            >
              <option value="">
                {form.division_id ? '-- Select Subject for this Division --' : '-- Select Division First --'}
              </option>
              {filteredSubjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code}) {s.divisions ? `· ${s.divisions.name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs font-semibold text-ink">Teacher *</label>
            <select
              id="lecture-teacher"
              className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
              value={form.teacher_id}
              onChange={e => set('teacher_id', e.target.value)}
              required
            >
              <option value="">-- Select Teacher --</option>
              {teachers.map(t => (
                <option key={t.id} value={t.profile?.id || t.teacher_profile_id || t.id}>
                  {t.full_name} ({t.department || 'Faculty'})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink">Date *</label>
            <input
              id="lecture-date"
              type="date"
              className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none"
              value={form.lecture_date}
              onChange={e => set('lecture_date', e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink">Start Time *</label>
            <select
              id="lecture-start"
              className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
              value={form.start_time}
              onChange={e => {
                const val = e.target.value
                setForm(p => {
                  const idx = SLOTS.indexOf(val)
                  const nextSlot = idx >= 0 && idx + 1 < SLOTS.length ? SLOTS[idx + 1] : p.end_time
                  return { ...p, start_time: val, end_time: nextSlot }
                })
              }}
            >
              {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-semibold text-ink">End Time *</label>
            <select
              id="lecture-end"
              className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
              value={form.end_time}
              onChange={e => set('end_time', e.target.value)}
            >
              {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink">Room / Location</label>
          <input
            id="lecture-room"
            type="text"
            className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none"
            placeholder="e.g. Room 101, Lab A"
            value={form.room}
            onChange={e => set('room', e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink">Topic / Description</label>
          <textarea
            id="lecture-topic"
            className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none resize-none"
            rows={2}
            placeholder="Optional: lecture topic or notes"
            value={form.topic}
            onChange={e => set('topic', e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            id="save-lecture-btn"
            type="submit"
            variant="primary"
            size="sm"
            disabled={saving}
          >
            {saving ? 'Scheduling...' : 'Schedule Lecture'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function EditLectureModal({ lecture: l, teachers, subjects, divisions, onClose, onSuccess }) {
  const [form, setForm] = useState({
    division_id: l.division_id || l.divisions?.id || '',
    subject_id: l.subject_id || l.subjects?.id || l.subject?.id || '',
    teacher_id: l.teachers?.id || l.teacher?.id || l.teacher_id || '',
    lecture_date: l.lecture_date ? l.lecture_date.slice(0, 10) : getTodayDateStr(),
    start_time: l.start_time?.slice(0, 5) || '09:00',
    end_time: l.end_time?.slice(0, 5) || '10:00',
    room: l.room || '',
    topic: l.topic || '',
    reason: '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const filteredSubjects = form.division_id
    ? subjects.filter(s => !s.division_id || s.division_id === form.division_id)
    : subjects

  async function submit(e) {
    e.preventDefault()
    if (!form.subject_id || !form.teacher_id || !form.division_id) {
      return toast.error('Please select division, subject and faculty')
    }
    setSaving(true)
    try {
      const res = await api.put(`/lectures/${l.id}`, form)
      toast.success(res.data?.message || 'Lecture updated & students notified!')
      onSuccess()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update lecture')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Edit Lecture & Change Faculty (Proxy)"
      description="Update assigned faculty, reschedule, and trigger push alerts to students"
      maxWidth="max-w-lg"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs font-semibold text-ink">Academic Division *</label>
            <select
              id="edit-lecture-division"
              className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
              value={form.division_id}
              onChange={e => {
                const divId = e.target.value
                setForm(p => ({
                  ...p,
                  division_id: divId,
                  subject_id: ''
                }))
              }}
              required
            >
              <option value="">-- Select Class Division --</option>
              {divisions.map(d => (
                <option key={d.id} value={d.id}>
                  {d.courses?.code ? `[${d.courses.code}] ` : ''}{d.name} - Division {d.division_name} ({d.courses?.name || 'General'})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs font-semibold text-ink">Subject *</label>
            <select
              id="edit-lecture-subject"
              className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
              value={form.subject_id}
              onChange={e => set('subject_id', e.target.value)}
              required
            >
              <option value="">-- Select Subject --</option>
              {filteredSubjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code}) {s.divisions ? `· ${s.divisions.name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 space-y-1">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-ink">Faculty / Substitute Teacher *</label>
              <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Proxy Assignment
              </span>
            </div>
            <select
              id="edit-lecture-teacher"
              className="w-full text-xs p-2.5 rounded-lg border border-amber-300 bg-amber-50/20 text-ink font-medium focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 outline-none cursor-pointer"
              value={form.teacher_id}
              onChange={e => set('teacher_id', e.target.value)}
              required
            >
              <option value="">-- Select Substitute / Regular Faculty --</option>
              {teachers.map(t => (
                <option key={t.id} value={t.profile?.id || t.teacher_profile_id || t.id}>
                  {t.full_name} ({t.department || 'Faculty'})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink">Date *</label>
            <input
              id="edit-lecture-date"
              type="date"
              className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none"
              value={form.lecture_date}
              onChange={e => set('lecture_date', e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink">Start Time *</label>
            <select
              id="edit-lecture-start"
              className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
              value={form.start_time}
              onChange={e => {
                const val = e.target.value
                setForm(p => {
                  const idx = SLOTS.indexOf(val)
                  const nextSlot = idx >= 0 && idx + 1 < SLOTS.length ? SLOTS[idx + 1] : p.end_time
                  return { ...p, start_time: val, end_time: nextSlot }
                })
              }}
            >
              {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-semibold text-ink">End Time *</label>
            <select
              id="edit-lecture-end"
              className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
              value={form.end_time}
              onChange={e => set('end_time', e.target.value)}
            >
              {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink">Topic / Description</label>
          <input
            id="edit-lecture-topic"
            type="text"
            className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none"
            placeholder="e.g. Unit 3 Discussion, Proxy Lecture"
            value={form.topic}
            onChange={e => set('topic', e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink">Update Reason / Note for Students (Optional)</label>
          <input
            id="edit-lecture-reason"
            type="text"
            className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none"
            placeholder="e.g. Regular faculty on leave, Proxy assigned"
            value={form.reason}
            onChange={e => set('reason', e.target.value)}
          />
          <p className="text-[11px] text-muted">This note will be included in the instant notification broadcast.</p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            id="save-edit-lecture-btn"
            type="submit"
            variant="primary"
            size="sm"
            disabled={saving}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {saving ? 'Updating & Notifying...' : 'Save & Broadcast'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
