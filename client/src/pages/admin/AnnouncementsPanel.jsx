import { useEffect, useState, useCallback } from 'react'
import {
  Bell, Plus, X, Send, Users, BookOpen,
  Megaphone, Clock, Trash2, RefreshCw,
  Paperclip, FileText, Image as ImageIcon, Download
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
                    <p className="text-brand-muted text-sm whitespace-pre-line leading-relaxed">{a.content}</p>

                    {/* Attachments */}
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

                    <div className="flex items-center gap-3 mt-3">
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
  const [attachment, setAttachment] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const needsTarget = form.target_type === 'DIVISION' || form.target_type === 'COURSE'

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 8 * 1024 * 1024) {
      toast.error('File size must be under 8MB')
      return
    }
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    const fileType = isPdf ? 'PDF' : isImage ? 'IMAGE' : 'DOCUMENT'

    const reader = new FileReader()
    reader.onload = () => {
      setAttachment({
        name: file.name,
        type: fileType,
        size: file.size,
        data: reader.result,
      })
      toast.success(`Attached ${file.name}`)
    }
    reader.readAsDataURL(file)
  }

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
        attachment: attachment || null,
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
      <div className="card w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
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

          {/* Attachment Selector */}
          <div className="form-group">
            <label className="form-label flex items-center gap-1.5">
              <Paperclip size={14} className="text-brand-accent" /> Attach PDF / Image (Optional, Max 8MB)
            </label>
            {attachment ? (
              <div className="flex items-center justify-between p-3 bg-white/5 border border-brand-accent/40 rounded-xl">
                <div className="flex items-center gap-2 min-w-0">
                  {attachment.type === 'IMAGE' ? (
                    <ImageIcon size={18} className="text-emerald-400 flex-shrink-0" />
                  ) : (
                    <FileText size={18} className="text-blue-400 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-white text-xs font-medium truncate">{attachment.name}</p>
                    <p className="text-brand-muted text-[10px]">{(attachment.size / 1024).toFixed(0)} KB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  className="btn btn-ghost btn-sm text-red-400 hover:text-red-300"
                >
                  <X size={14} /> Remove
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-white/10 hover:border-brand-accent/50 rounded-xl cursor-pointer transition-colors bg-white/[0.02]">
                <Paperclip size={20} className="text-brand-muted mb-1" />
                <span className="text-brand-text text-xs font-medium">Click to select PDF notes, circular, or image</span>
                <span className="text-brand-muted text-[10px] mt-0.5">Supports PDF, PNG, JPG, WebP (up to 8MB)</span>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
            )}
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
