import { useEffect, useState, useCallback } from 'react'
import {
  Bell, Plus, X, Send, Users, BookOpen,
  Megaphone, Clock, Trash2, RefreshCw
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'

const TARGET_TYPES = [
  { value: 'ALL',      label: 'Everyone (All roles)',  icon: '🌐' },
  { value: 'TEACHER',  label: 'All Teachers',          icon: '👨‍🏫' },
  { value: 'STUDENT',  label: 'All Students',          icon: '🎓' },
  { value: 'DIVISION', label: 'Specific Division',     icon: '📋' },
  { value: 'COURSE',   label: 'Specific Course',       icon: '📚' },
]

export default function AnnouncementsPanel() {
  const [announcements, setAnnouncements] = useState([])
  const [divisions, setDivisions]         = useState([])
  const [courses, setCourses]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [showForm, setShowForm]           = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [aRes, dRes, cRes] = await Promise.all([
        api.get('/announcements').catch(() => ({ data: { data: { announcements: [] } } })),
        api.get('/academic/divisions').catch(() => ({ data: { data: { divisions: [] } } })),
        api.get('/academic/courses').catch(() => ({ data: { data: { courses: [] } } })),
      ])
      setAnnouncements(aRes.data.data?.announcements || [])
      setDivisions(dRes.data.data?.divisions || [])
      setCourses(cRes.data.data?.courses || [])
    } catch {
      toast.error('Failed to load announcements')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function deleteAnn(id) {
    if (!confirm('Delete this announcement?')) return
    try {
      await api.delete(`/announcements/${id}`)
      toast.success('Announcement deleted')
      fetchAll()
    } catch {
      toast.error('Delete failed')
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Announcements</h2>
          <p className="page-subtitle">Send and manage college-wide announcements</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAll} className="btn btn-ghost btn-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            id="add-announcement-btn"
            onClick={() => setShowForm(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> New Announcement
          </button>
        </div>
      </div>

      {/* Announcement list */}
      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-4 border-white/10 border-t-brand-accent rounded-full animate-spin" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="card text-center py-16">
          <Megaphone size={40} className="mx-auto text-brand-muted mb-3" />
          <p className="text-white font-semibold">No announcements yet</p>
          <p className="text-brand-muted text-sm mt-1">Click "New Announcement" to send one</p>
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary mt-4 mx-auto"
          >
            <Plus size={15} /> Create First Announcement
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <div key={a.id} className="card group hover:border-brand-accent/30 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-brand-accent/20 flex items-center justify-center flex-shrink-0">
                    <Bell size={18} className="text-brand-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="text-white font-semibold">{a.title}</h4>
                      <span className="badge badge-info text-xs">
                        {TARGET_TYPES.find(t => t.value === a.target_type)?.label || a.target_type}
                      </span>
                    </div>
                    <p className="text-brand-muted text-sm line-clamp-2">{a.content}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-brand-muted text-xs flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(a.created_at).toLocaleString('en-IN')}
                      </span>
                      {a.sent_by_user?.name && (
                        <span className="text-brand-muted text-xs">
                          by {a.sent_by_user.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteAnn(a.id)}
                  className="btn btn-danger btn-sm opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <NewAnnouncementModal
          divisions={divisions}
          courses={courses}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); fetchAll() }}
        />
      )}
    </div>
  )
}

function NewAnnouncementModal({ divisions, courses, onClose, onSuccess }) {
  const [form, setForm] = useState({
    title: '',
    content: '',
    target_type: 'ALL',
    target_id: '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const needsTarget = form.target_type === 'DIVISION' || form.target_type === 'COURSE'

  async function submit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) {
      return toast.error('Title and content are required')
    }
    if (needsTarget && !form.target_id) {
      return toast.error('Please select a specific target')
    }
    setSaving(true)
    try {
      await api.post('/announcements', {
        ...form,
        target_id: needsTarget ? form.target_id : null,
      })
      toast.success('Announcement sent!')
      onSuccess()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-lg relative">
        <button onClick={onClose} className="absolute top-4 right-4 btn-icon btn-ghost">
          <X size={16} />
        </button>

        <h3 className="text-white font-bold text-lg mb-5 flex items-center gap-2">
          <Megaphone size={18} className="text-brand-accent" />
          New Announcement
        </h3>

        <form onSubmit={submit} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input
              id="ann-title"
              type="text"
              className="form-input"
              placeholder="Announcement title"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              required
              maxLength={200}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Target Audience *</label>
            <div className="grid grid-cols-1 gap-2">
              {TARGET_TYPES.map(t => (
                <label key={t.value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="target_type"
                    value={t.value}
                    checked={form.target_type === t.value}
                    onChange={() => set('target_type', t.value)}
                    className="sr-only"
                  />
                  <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    form.target_type === t.value
                      ? 'border-brand-accent bg-brand-accent/10'
                      : 'border-brand-border hover:border-white/30'
                  }`}>
                    <span className="text-lg">{t.icon}</span>
                    <span className={`text-sm font-medium ${form.target_type === t.value ? 'text-white' : 'text-brand-text'}`}>
                      {t.label}
                    </span>
                    {form.target_type === t.value && (
                      <div className="ml-auto w-4 h-4 rounded-full bg-brand-accent flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {needsTarget && (
            <div className="form-group">
              <label className="form-label">
                Select {form.target_type === 'DIVISION' ? 'Division' : 'Course'} *
              </label>
              <select
                id="ann-target-id"
                className="form-input"
                value={form.target_id}
                onChange={e => set('target_id', e.target.value)}
                required
              >
                <option value="">-- Select --</option>
                {(form.target_type === 'DIVISION' ? divisions : courses).map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Message *</label>
            <textarea
              id="ann-content"
              className="form-input"
              rows={4}
              placeholder="Type your announcement message here..."
              value={form.content}
              onChange={e => set('content', e.target.value)}
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
              Cancel
            </button>
            <button
              id="send-announcement-btn"
              type="submit"
              disabled={saving}
              className="btn btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <Send size={15} />
              {saving ? 'Sending...' : 'Send Announcement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
