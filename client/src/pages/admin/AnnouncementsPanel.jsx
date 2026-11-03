import { useEffect, useState, useCallback } from 'react'
import {
  Bell, Plus, X, Send, Users, BookOpen,
  Megaphone, Clock, Trash2, RefreshCw,
  Paperclip, FileText, Image as ImageIcon, Download,
  CheckCircle2, Globe, GraduationCap
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { openAttachment, downloadAttachment } from '../../utils/attachmentHelper'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Badge, Button, Input, Modal, Skeleton, EmptyState
} from '../../components/ui'

const TARGET_TYPES = [
  { value: 'ALL',      label: 'Everyone (All roles)',  icon: Globe },
  { value: 'TEACHER',  label: 'All Faculty Members',   icon: Users },
  { value: 'STUDENT',  label: 'All Enrolled Students', icon: GraduationCap },
  { value: 'DIVISION', label: 'Specific Class Division', icon: BookOpen },
  { value: 'COURSE',   label: 'Specific Degree Program', icon: Megaphone },
]

export default function AnnouncementsPanel() {
  const [announcements, setAnnouncements] = useState([])
  const [divisions, setDivisions]         = useState([])
  const [courses, setCourses]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [showForm, setShowForm]           = useState(false)
  const [activeAttachment, setActiveAttachment] = useState(null)

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
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Delete failed')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-ink tracking-tight">
            Institutional Notices & Broadcasts
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            Publish college circulars, exam schedules, and department notices with file attachments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchAll} variant="outline" size="sm" className="gap-1.5" title="Refresh notices">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button
            id="add-announcement-btn"
            onClick={() => setShowForm(true)}
            variant="primary"
            size="sm"
            className="gap-1.5"
          >
            <Plus size={15} /> New Announcement
          </Button>
        </div>
      </div>

      {/* Announcement List */}
      {loading ? (
        <div className="space-y-4">
          <Card className="p-6"><Skeleton className="h-20 w-full" /></Card>
          <Card className="p-6"><Skeleton className="h-20 w-full" /></Card>
          <Card className="p-6"><Skeleton className="h-20 w-full" /></Card>
        </div>
      ) : announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No institutional announcements published"
          description="Click 'New Announcement' to broadcast notices and exam timetables to teachers and students."
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowForm(true)}
              className="gap-1.5"
            >
              <Plus size={14} /> Create First Announcement
            </Button>
          }
        />
      ) : (
        <div className="space-y-3.5">
          {announcements.map(a => {
            const targetObj = TARGET_TYPES.find(t => t.value === a.target_type)
            const targetLabel = targetObj?.label || a.target_type

            return (
              <Card
                key={a.id}
                className="p-4 sm:p-5 hover:border-brand/40 transition-colors group relative"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
                      <Bell size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <h3 className="font-semibold text-ink text-sm sm:text-base leading-snug">
                          {a.title}
                        </h3>
                        <Badge variant="brand" size="sm">
                          {targetLabel}
                        </Badge>
                      </div>

                      <p className="text-xs sm:text-sm text-ink/80 whitespace-pre-line leading-relaxed">
                        {a.content}
                      </p>

                      {/* Attachments Preview Row */}
                      {a.attachments && a.attachments.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {a.attachments.map((att, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2.5 px-3 py-2 bg-bg border border-line rounded-lg max-w-sm hover:border-brand/40 transition-colors shadow-2xs"
                            >
                              {att.file_type === 'IMAGE' || (att.file_name && att.file_name.match(/\.(png|jpe?g|webp|gif)$/i)) ? (
                                <ImageIcon size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                              ) : (
                                <FileText size={16} className="text-brand shrink-0" />
                              )}
                              <span
                                onClick={() => {
                                  if (att.file_type === 'IMAGE' || att.file_url?.startsWith('data:image/') || (att.file_name && att.file_name.match(/\.(png|jpe?g|webp|gif)$/i))) {
                                    setActiveAttachment(att)
                                  } else {
                                    downloadAttachment(att.file_url, att.file_name)
                                  }
                                }}
                                className="text-xs font-medium text-ink truncate flex-1 cursor-pointer hover:text-brand"
                                title="Click to view attachment"
                              >
                                {att.file_name}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  downloadAttachment(att.file_url, att.file_name)
                                }}
                                className="!py-1 !px-2 text-[11px] gap-1 text-brand"
                                title="Download attachment"
                              >
                                <Download size={12} />
                                <span>Download</span>
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-3 mt-3.5 pt-2.5 border-t border-line/60">
                        <span className="text-muted text-xs flex items-center gap-1 font-mono">
                          <Clock size={12} />
                          {new Date(a.created_at).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {a.sent_by_user?.name && (
                          <span className="text-muted text-xs font-medium">
                            • Posted by {a.sent_by_user.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteAnn(a.id)}
                    className="opacity-70 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 p-1.5 shrink-0"
                    title="Delete notice"
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Broadcast Announcement Modal */}
      {showForm && (
        <NewAnnouncementModal
          divisions={divisions}
          courses={courses}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); fetchAll() }}
        />
      )}

      {/* Notice Attachment Lightbox Modal */}
      <Modal
        isOpen={Boolean(activeAttachment)}
        onClose={() => setActiveAttachment(null)}
        title={activeAttachment?.file_name || 'Notice Attachment'}
        description="Official circular document / image attachment"
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
                <p className="text-xs text-muted">Tap Download below to save and open this file.</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted font-mono truncate max-w-[200px]">
              {activeAttachment?.file_name}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => downloadAttachment(activeAttachment.file_url, activeAttachment.file_name)}
                className="gap-1.5 font-semibold"
              >
                <Download size={14} />
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
      return toast.error('Please select a specific target cohort')
    }
    setSaving(true)
    try {
      await api.post('/announcements', {
        ...form,
        target_id: needsTarget ? form.target_id : null,
        attachment: attachment || null,
      })
      toast.success('Announcement broadcast successfully!')
      onSuccess()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to send announcement')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Create Institutional Announcement"
      description="Send instant circulars and notices to faculty and student dashboards"
      maxWidth="max-w-lg"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink">Notice Title *</label>
          <input
            id="ann-title"
            type="text"
            className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none"
            placeholder="e.g. Mid-Term Examination Schedule or Holiday Circular"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            required
            maxLength={200}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-ink">Target Audience *</label>
          <div className="grid grid-cols-1 gap-1.5">
            {TARGET_TYPES.map(t => {
              const Icon = t.icon
              const isSelected = form.target_type === t.value
              return (
                <label key={t.value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="target_type"
                    value={t.value}
                    checked={isSelected}
                    onChange={() => set('target_type', t.value)}
                    className="sr-only"
                  />
                  <div className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                    isSelected
                      ? 'border-brand bg-brand/10 text-ink shadow-2xs'
                      : 'border-line bg-surface hover:bg-bg/60 text-muted'
                  }`}>
                    <div className={`p-1.5 rounded-md ${isSelected ? 'bg-brand text-white' : 'bg-bg text-muted'}`}>
                      <Icon size={14} />
                    </div>
                    <span className={`text-xs font-medium flex-1 ${isSelected ? 'text-ink font-semibold' : 'text-muted'}`}>
                      {t.label}
                    </span>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-brand" />
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        {needsTarget && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink">
              Select {form.target_type === 'DIVISION' ? 'Class Division' : 'Degree Course'} *
            </label>
            <select
              id="ann-target-id"
              className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
              value={form.target_id}
              onChange={e => set('target_id', e.target.value)}
              required
            >
              <option value="">-- Choose Target --</option>
              {(form.target_type === 'DIVISION' ? divisions : courses).map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink">Notice Content / Instructions *</label>
          <textarea
            id="ann-content"
            className="w-full text-xs p-3 rounded-lg border border-line bg-surface text-ink placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none resize-none"
            rows={4}
            placeholder="Type your circular details, timings, or academic instructions here..."
            value={form.content}
            onChange={e => set('content', e.target.value)}
            required
          />
        </div>

        {/* Attachment Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-ink flex items-center gap-1.5">
            <Paperclip size={13} className="text-brand" /> Attach PDF / Circular Image (Optional, Max 8MB)
          </label>
          {attachment ? (
            <div className="flex items-center justify-between p-3 bg-bg border border-brand/40 rounded-lg">
              <div className="flex items-center gap-2.5 min-w-0">
                {attachment.type === 'IMAGE' ? (
                  <ImageIcon size={18} className="text-emerald-600 shrink-0" />
                ) : (
                  <FileText size={18} className="text-brand shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink truncate">{attachment.name}</p>
                  <p className="text-[10px] text-muted font-mono">{(attachment.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAttachment(null)}
                className="text-red-600 hover:bg-red-50 text-xs gap-1"
              >
                <X size={13} /> Remove
              </Button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center p-4 border border-dashed border-line hover:border-brand rounded-lg cursor-pointer transition-colors bg-bg/50">
              <Paperclip size={18} className="text-muted mb-1" />
              <span className="text-ink text-xs font-medium">Click to select PDF notes, circular, or image</span>
              <span className="text-muted text-[10px] mt-0.5">Supports PDF, PNG, JPG, WebP (up to 8MB)</span>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            id="send-announcement-btn"
            type="submit"
            variant="primary"
            size="sm"
            disabled={saving}
            className="gap-1.5"
          >
            <Send size={14} />
            {saving ? 'Broadcasting...' : 'Publish Notice'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
