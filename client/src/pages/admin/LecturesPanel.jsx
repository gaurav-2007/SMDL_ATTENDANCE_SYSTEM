import { useEffect, useState, useCallback } from 'react'
import {
  BookOpen, Plus, X, Clock, Calendar, Users,
  Trash2, RefreshCw, ChevronDown, Edit3, CheckCircle
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  SCHEDULED: 'badge badge-info',
  ONGOING:   'badge badge-active',
  COMPLETED: 'badge badge-muted',
  CANCELLED: 'badge badge-danger',
}

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const SLOTS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00']

export default function LecturesPanel() {
  const [lectures, setLectures]   = useState([])
  const [teachers, setTeachers]   = useState([])
  const [subjects, setSubjects]   = useState([])
  const [divisions, setDivisions] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)

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
        <div className="flex gap-2">
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
    </div>
  )
}

function LectureRow({ lecture: l, onRefresh }) {
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
        <p className="text-sm text-brand-text">{l.teachers?.full_name || '—'}</p>
      </td>
      <td>
        <span className="text-sm text-brand-text">{l.divisions?.name || '—'}</span>
      </td>
      <td>
        <div className="flex items-center gap-1.5">
          <Calendar size={12} className="text-brand-muted" />
          <span className="text-xs text-brand-text">
            {l.lecture_date ? new Date(l.lecture_date).toLocaleDateString('en-IN') : '—'}
          </span>
          <Clock size={12} className="text-brand-muted ml-1" />
          <span className="text-xs text-brand-text">{l.start_time} – {l.end_time}</span>
        </div>
      </td>
      <td>
        <span className={STATUS_COLORS[l.status] || 'badge badge-muted'}>{l.status}</span>
      </td>
      <td>
        <div className="flex items-center gap-1">
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
    lecture_date: new Date().toISOString().slice(0, 10),
    start_time: '09:00',
    end_time: '10:00',
    room: '',
    topic: '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 btn-icon btn-ghost">
          <X size={16} />
        </button>

        <h3 className="text-white font-bold text-lg mb-5 flex items-center gap-2">
          <BookOpen size={18} className="text-brand-accent" />
          Schedule New Lecture
        </h3>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Subject *</label>
              <select
                id="lecture-subject"
                className="form-input"
                value={form.subject_id}
                onChange={e => set('subject_id', e.target.value)}
                required
              >
                <option value="">Select Subject</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Teacher *</label>
              <select
                id="lecture-teacher"
                className="form-input"
                value={form.teacher_id}
                onChange={e => set('teacher_id', e.target.value)}
                required
              >
                <option value="">Select Teacher</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Division *</label>
              <select
                id="lecture-division"
                className="form-input"
                value={form.division_id}
                onChange={e => set('division_id', e.target.value)}
                required
              >
                <option value="">Select Division</option>
                {divisions.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
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
                onChange={e => set('start_time', e.target.value)}
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
