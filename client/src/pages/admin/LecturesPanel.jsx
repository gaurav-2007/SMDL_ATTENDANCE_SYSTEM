import { useEffect, useState, useCallback } from 'react'
import {
  BookOpen, Plus, X, Clock, Calendar, Users,
  Trash2, RefreshCw, ChevronDown, Edit3, CheckCircle
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  SCHEDULED:   'badge badge-info',
  UPCOMING:    'badge badge-info',
  ONGOING:   'badge badge-active',
  COMPLETED: 'badge badge-muted',
  CANCELLED:   'badge badge-danger',
  RESCHEDULED: 'badge badge-warning',
}

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

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Lecture Scheduling</h2>
          <p className="page-subtitle">Schedule and manage all lectures</p>
        </div>
        <div className="flex items-center gap-2">
          {liveDateTime && (
            <div className="glass px-3 py-1.5 rounded-xl border border-white/10 text-xs flex items-center gap-2">
              <Clock size={14} className="text-brand-accent" />
              <span className="text-white font-medium">{liveDateTime}</span>
            </div>
          )}
          <button onClick={fetchAll} className="btn btn-ghost btn-sm flex items-center gap-2">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            id="add-lecture-btn"
            onClick={() => setShowForm(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> Schedule Lecture
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: lectures.length, color: 'text-blue-400',   bg: 'bg-blue-500/10' },
          { label: 'Scheduled', value: lectures.filter(l=>l.status==='SCHEDULED').length, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { label: 'Ongoing',   value: lectures.filter(l=>l.status==='ONGOING').length,   color: 'text-green-400',  bg: 'bg-green-500/10' },
          { label: 'Completed', value: lectures.filter(l=>l.status==='COMPLETED').length, color: 'text-brand-muted', bg: 'bg-white/5' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="stat-card">
            <div className={`stat-icon ${bg} ${color}`}><BookOpen size={18} /></div>
            <div>
              <p className={`text-2xl font-bold ${color}`}>{loading ? '—' : value}</p>
              <p className="text-brand-muted text-xs">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Lectures Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-white/10 border-t-brand-accent rounded-full animate-spin" />
          </div>
        ) : lectures.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen size={40} className="mx-auto text-brand-muted mb-3" />
            <p className="text-white font-semibold">No lectures scheduled</p>
            <p className="text-brand-muted text-sm mt-1">Click "Schedule Lecture" to add one</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Teacher</th>
                  <th>Division</th>
                  <th>Date & Time</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {lectures.map(l => (
                  <LectureRow
                    key={l.id}
                    lecture={l}
                    onRefresh={fetchAll}
                    onEdit={(lec) => setEditingLecture(lec)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

function LectureRow({ lecture: l, onRefresh, onEdit }) {
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
    <tr className={updating ? 'opacity-50' : ''}>
      <td>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-accent/20 flex items-center justify-center">
            <BookOpen size={13} className="text-brand-accent" />
          </div>
          <div>
            <p className="text-white text-sm font-medium">{l.subjects?.name || '—'}</p>
            <p className="text-brand-muted text-xs">{l.subjects?.code}</p>
          </div>
        </div>
      </td>
      <td>
        <p className="text-sm text-brand-text">{l.teachers?.full_name || l.teacher?.full_name || '—'}</p>
      </td>
      <td>
        <span className="text-sm text-brand-text">{l.divisions?.name || '—'}</span>
      </td>
      <td>
        <div className="flex items-center gap-1.5">
          <Calendar size={12} className="text-brand-muted" />
          <span className="text-xs text-brand-text">
            {formatDisplayDate(l.lecture_date)}
          </span>
          <Clock size={12} className="text-brand-muted ml-1" />
          <span className="text-xs text-brand-text">{l.start_time?.slice(0, 5)} – {l.end_time?.slice(0, 5)}</span>
        </div>
      </td>
      <td>
        <span className={STATUS_COLORS[l.status] || 'badge badge-muted'}>{l.status}</span>
      </td>
      <td>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(l)}
            className="btn btn-ghost btn-sm text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 flex items-center gap-1"
            title="Edit Lecture / Change Faculty (Proxy)"
          >
            <Edit3 size={13} /> Edit / Proxy
          </button>
          {l.status === 'SCHEDULED' && (
            <button
              onClick={() => updateStatus('ONGOING')}
              className="btn btn-success btn-sm text-xs"
              title="Start lecture"
            >
              Start
            </button>
          )}
          {l.status === 'ONGOING' && (
            <button
              onClick={() => updateStatus('COMPLETED')}
              className="btn btn-ghost btn-sm text-xs"
              title="Mark complete"
            >
              <CheckCircle size={13} /> Done
            </button>
          )}
          <button
            onClick={deleteLecture}
            className="btn btn-danger btn-sm"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="card w-full max-w-lg relative max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700/80 shadow-2xl rounded-2xl p-6">
        <button onClick={onClose} className="absolute top-4 right-4 btn-icon btn-ghost">
          <X size={16} />
        </button>

        <h3 className="text-white font-bold text-lg mb-5 flex items-center gap-2">
          <BookOpen size={18} className="text-brand-accent" />
          Schedule New Lecture
        </h3>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group sm:col-span-2">
              <label className="form-label">Academic Division *</label>
              <select
                id="lecture-division"
                className="form-input"
                value={form.division_id}
                onChange={e => {
                  const divId = e.target.value
                  setForm(p => ({
                    ...p,
                    division_id: divId,
                    subject_id: '' // reset subject when division changes
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
              <p className="text-[11px] text-slate-500 mt-1">Select class division first to filter associated subjects</p>
            </div>

            <div className="form-group sm:col-span-2">
              <label className="form-label">Subject *</label>
              <select
                id="lecture-subject"
                className="form-input"
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
              {form.division_id && filteredSubjects.length === 0 && (
                <p className="text-[11px] text-amber-400 mt-1">No subjects found for this division. Add subjects in Academics tab.</p>
              )}
            </div>

            <div className="form-group sm:col-span-2">
              <label className="form-label">Teacher *</label>
              <select
                id="lecture-teacher"
                className="form-input"
                value={form.teacher_id}
                onChange={e => set('teacher_id', e.target.value)}
                required
              >
                <option value="">-- Select Teacher --</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.profile?.id || t.teacher_profile_id || t.id}>{t.full_name} ({t.department || 'Faculty'})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Date *</label>
              <input
                id="lecture-date"
                type="date"
                className="form-input"
                value={form.lecture_date}
                onChange={e => set('lecture_date', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Start Time *</label>
              <select
                id="lecture-start"
                className="form-input"
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

            <div className="form-group">
              <label className="form-label">End Time *</label>
              <select
                id="lecture-end"
                className="form-input"
                value={form.end_time}
                onChange={e => set('end_time', e.target.value)}
              >
                {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Room / Location</label>
            <input
              id="lecture-room"
              type="text"
              className="form-input"
              placeholder="e.g. Room 101, Lab A"
              value={form.room}
              onChange={e => set('room', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Topic / Description</label>
            <textarea
              id="lecture-topic"
              className="form-input"
              rows={2}
              placeholder="Optional: lecture topic or notes"
              value={form.topic}
              onChange={e => set('topic', e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
              Cancel
            </button>
            <button
              id="save-lecture-btn"
              type="submit"
              disabled={saving}
              className="btn btn-primary flex-1"
            >
              {saving ? 'Scheduling...' : 'Schedule Lecture'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const SLOTS_USED = SLOTS

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="card w-full max-w-lg relative max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700/80 shadow-2xl rounded-2xl p-6">
        <button onClick={onClose} className="absolute top-4 right-4 btn-icon btn-ghost">
          <X size={16} />
        </button>

        <h3 className="text-white font-bold text-lg mb-1 flex items-center gap-2">
          <Edit3 size={18} className="text-amber-400" />
          Edit Lecture & Change Faculty (Proxy)
        </h3>
        <p className="text-brand-muted text-xs mb-4">
          Update the assigned faculty (proxy), change subject, or reschedule. All enrolled students will receive a push notification immediately.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group sm:col-span-2">
              <label className="form-label">Academic Division *</label>
              <select
                id="edit-lecture-division"
                className="form-input"
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

            <div className="form-group sm:col-span-2">
              <label className="form-label">Subject *</label>
              <select
                id="edit-lecture-subject"
                className="form-input"
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

            <div className="form-group sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="form-label !mb-0">Faculty / Substitute Teacher *</label>
                <span className="text-[11px] text-amber-400 font-medium">Select here for Proxy</span>
              </div>
              <select
                id="edit-lecture-teacher"
                className="form-input border-amber-500/50 focus:border-amber-400"
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

            <div className="form-group">
              <label className="form-label">Date *</label>
              <input
                id="edit-lecture-date"
                type="date"
                className="form-input"
                value={form.lecture_date}
                onChange={e => set('lecture_date', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Start Time *</label>
              <select
                id="edit-lecture-start"
                className="form-input"
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

            <div className="form-group sm:col-span-2">
              <label className="form-label">End Time *</label>
              <select
                id="edit-lecture-end"
                className="form-input"
                value={form.end_time}
                onChange={e => set('end_time', e.target.value)}
              >
                {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Topic / Description</label>
            <input
              id="edit-lecture-topic"
              type="text"
              className="form-input"
              placeholder="e.g. Unit 3 Discussion, Proxy Lecture"
              value={form.topic}
              onChange={e => set('topic', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Update Reason / Note for Students (Optional)</label>
            <input
              id="edit-lecture-reason"
              type="text"
              className="form-input placeholder:text-slate-600"
              placeholder="e.g. Regular faculty on medical leave, Proxy assigned"
              value={form.reason}
              onChange={e => set('reason', e.target.value)}
            />
            <p className="text-[11px] text-slate-500 mt-1">This note will be included in the push notification sent to all students.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
              Cancel
            </button>
            <button
              id="save-edit-lecture-btn"
              type="submit"
              disabled={saving}
              className="btn bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold flex-1"
            >
              {saving ? 'Updating & Notifying...' : 'Save & Notify Students'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
