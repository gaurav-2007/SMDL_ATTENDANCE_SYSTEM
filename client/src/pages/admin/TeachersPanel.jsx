import { useEffect, useState } from 'react'
import {
  UserCheck, UserX, Clock, RefreshCw, Search, Filter,
  ShieldAlert, ShieldOff, AlertCircle, BookOpen, Check, X,
  GraduationCap, Mail, Building2, Hash, Layers
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Badge, Button, Input, Modal, Skeleton, EmptyState
} from '../../components/ui'

export default function TeachersPanel() {
  const [teachers, setTeachers] = useState([])
  const [allSubjects, setAllSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL') // ALL | PENDING | ACTIVE | SUSPENDED | REJECTED
  const [search, setSearch] = useState('')
  const [actingId, setActingId] = useState(null)
  const [actionModal, setActionModal] = useState(null) // { type: 'suspend' | 'disable' | 'reject', teacher: {} }
  const [modalReason, setModalReason] = useState('')

  // Subject Assignment Modals
  const [approveModal, setApproveModal] = useState(null) // { teacher: {}, selectedIds: [] }
  const [subjectModal, setSubjectModal] = useState(null) // { teacher: {}, selectedIds: [] }
  const [modalSubjSearch, setModalSubjSearch] = useState('')
  const [savingSubjects, setSavingSubjects] = useState(false)

  async function fetchTeachers() {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/teachers')
      const list = data.data?.teachers || data.data?.all || []
      setTeachers(list)
    } catch {
      toast.error('Failed to load teachers')
    } finally {
      setLoading(false)
    }
  }

  async function fetchSubjects() {
    try {
      const { data } = await api.get('/academic/subjects')
      setAllSubjects(data.data?.subjects || [])
    } catch {
      // non-fatal
    }
  }

  useEffect(() => {
    fetchTeachers()
    fetchSubjects()
  }, [])

  async function handleApproveSubmit(e) {
    if (e) e.preventDefault()
    if (!approveModal) return
    const { teacher, selectedIds } = approveModal
    setActingId(teacher.id)
    try {
      await api.post(`/admin/teachers/${teacher.id}/approve`, {
        subject_ids: selectedIds,
      })
      toast.success(`Teacher ${teacher.name || teacher.full_name} activated with ${selectedIds.length} subjects! ✅`)
      const assignedObjList = allSubjects.filter(s => selectedIds.includes(s.id))
      setTeachers(ts => ts.map(t =>
        t.id === teacher.id
          ? {
              ...t,
              status: 'ACTIVE',
              account_status: 'ACTIVE',
              assigned_subjects: assignedObjList,
              assigned_subject_ids: selectedIds
            }
          : t
      ))
      setApproveModal(null)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Activation failed')
    } finally {
      setActingId(null)
    }
  }

  async function handleSaveSubjects(e) {
    if (e) e.preventDefault()
    if (!subjectModal) return
    const { teacher, selectedIds } = subjectModal
    setSavingSubjects(true)
    try {
      const { data } = await api.put(`/admin/teachers/${teacher.id}/subjects`, {
        subject_ids: selectedIds,
      })
      toast.success(data?.message || 'Subject assignments updated successfully! 📚')
      const updatedSubjs = data?.data?.assigned_subjects || allSubjects.filter(s => selectedIds.includes(s.id))
      setTeachers(ts => ts.map(t =>
        t.id === teacher.id
          ? {
              ...t,
              assigned_subjects: updatedSubjs,
              assigned_subject_ids: selectedIds
            }
          : t
      ))
      setSubjectModal(null)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update subjects')
    } finally {
      setSavingSubjects(false)
    }
  }

  async function handleModalSubmit(e) {
    e?.preventDefault()
    if (!actionModal) return
    const { type, teacher } = actionModal
    if (!modalReason.trim()) {
      toast.error('Reason is required')
      return
    }

    setActingId(teacher.id)
    try {
      if (type === 'suspend') {
        await api.post(`/admin/teachers/${teacher.id}/suspend`, { reason: modalReason })
        toast.success(`Teacher ${teacher.name || teacher.full_name} suspended & logged out globally ⚠️`)
        setTeachers(ts => ts.map(t =>
          t.id === teacher.id ? { ...t, status: 'SUSPENDED', account_status: 'SUSPENDED' } : t
        ))
      } else if (type === 'disable') {
        await api.post(`/admin/teachers/${teacher.id}/disable`, { reason: modalReason })
        toast.success(`Teacher ${teacher.name || teacher.full_name} disabled & logged out 🛑`)
        setTeachers(ts => ts.map(t =>
          t.id === teacher.id ? { ...t, status: 'DISABLED', account_status: 'DISABLED' } : t
        ))
      } else if (type === 'reject') {
        await api.post(`/admin/teachers/${teacher.id}/reject`, { reason: modalReason })
        toast.success('Teacher registration rejected')
        setTeachers(ts => ts.map(t =>
          t.id === teacher.id ? { ...t, status: 'REJECTED', account_status: 'REJECTED' } : t
        ))
      }
      setActionModal(null)
      setModalReason('')
    } catch (err) {
      toast.error(err.response?.data?.message || `${type} action failed`)
    } finally {
      setActingId(null)
    }
  }

  const filtered = teachers.filter(t => {
    const tStatus = t.status || t.account_status
    const matchStatus = filter === 'ALL' || tStatus === filter
    const q = search.toLowerCase()
    const empId = t.employee_id || t.profile?.employee_id || ''
    const dept = t.department || t.profile?.department || ''
    const matchSearch = !q ||
      (t.name || t.full_name || '').toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      empId.toLowerCase().includes(q) ||
      dept.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const counts = {
    ALL: teachers.length,
    PENDING: teachers.filter(t => (t.status || t.account_status) === 'PENDING').length,
    ACTIVE: teachers.filter(t => (t.status || t.account_status) === 'ACTIVE').length,
    SUSPENDED: teachers.filter(t => (t.status || t.account_status) === 'SUSPENDED').length,
    REJECTED: teachers.filter(t => ['REJECTED', 'DISABLED'].includes(t.status || t.account_status)).length,
  }

  function renderStatusBadge(tStatus) {
    if (tStatus === 'ACTIVE') {
      return <Badge variant="present" dot>Active</Badge>
    }
    if (tStatus === 'PENDING') {
      return <Badge variant="grace" pulseDot>Pending Approval</Badge>
    }
    if (tStatus === 'SUSPENDED') {
      return <Badge variant="grace">Suspended</Badge>
    }
    if (tStatus === 'DISABLED') {
      return <Badge variant="absent">Disabled</Badge>
    }
    if (tStatus === 'REJECTED') {
      return <Badge variant="absent">Rejected</Badge>
    }
    return <Badge variant="neutral">{tStatus || 'Unknown'}</Badge>
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-ink tracking-tight">
            Faculty Directory & Access Control
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            Authorize accounts, assign curriculum subjects, and manage security session states
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            id="refresh-teachers-btn"
            variant="outline"
            size="sm"
            onClick={fetchTeachers}
            className="gap-1.5"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Segmented Filter Pills */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-bg border border-line rounded-lg">
            {['ALL', 'PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'].map(s => {
              const isActive = filter === s
              return (
                <button
                  key={s}
                  id={`filter-${s.toLowerCase()}`}
                  onClick={() => setFilter(s)}
                  type="button"
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-surface text-ink font-semibold shadow-xs border border-line'
                      : 'text-muted hover:text-ink hover:bg-surface/50'
                  }`}
                >
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                  <span className={`ml-1.5 text-[11px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-brand/10 text-brand' : 'text-muted'
                  }`}>
                    {counts[s]}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Search Box */}
          <div className="w-full md:w-80">
            <Input
              id="teacher-search"
              type="text"
              placeholder="Search faculty by name, email, ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              icon={Search}
            />
          </div>
        </div>
      </Card>

      {/* Teachers Content Area */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Filter}
            title="No faculty members found"
            description={search ? `No results match "${search}". Try adjusting your filters.` : 'No teachers registered under this status category.'}
            action={
              search ? (
                <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                  Clear search query
                </Button>
              ) : null
            }
          />
        ) : (
          <div>
            {/* Desktop Table View (>= 1024px) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-line bg-bg/50 text-xs font-semibold text-muted uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Faculty Member</th>
                    <th className="py-3 px-4">Employee ID</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Assigned Subjects</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Registered</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((t, i) => {
                    const tStatus = t.status || t.account_status
                    const empId = t.employee_id || t.profile?.employee_id || '—'
                    const dept = t.department || t.profile?.department || '—'
                    const regDate = t.registered_at || t.profile?.registration_submitted_at
                    const assignedList = t.assigned_subjects || []
                    const initial = (t.name || t.full_name || 'F').charAt(0).toUpperCase()

                    return (
                      <tr key={t.id || t.email} className="hover:bg-bg/40 transition-colors">
                        <td className="py-3.5 px-4 text-center text-xs text-muted font-mono">
                          {i + 1}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-brand/10 text-brand font-semibold text-xs flex items-center justify-center shrink-0">
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-ink leading-tight truncate">
                                {t.name || t.full_name}
                              </p>
                              <p className="text-xs text-muted truncate mt-0.5">{t.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-ink">
                          {empId}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-ink font-medium">
                          {dept}
                        </td>
                        <td className="py-3.5 px-4 max-w-[240px]">
                          {assignedList.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-[240px]">
                              {assignedList.map(s => (
                                <span
                                  key={s.id}
                                  className="text-[11px] font-mono bg-bg border border-line text-ink px-1.5 py-0.5 rounded shadow-2xs"
                                  title={`${s.name} (${s.code || ''}) - ${s.division?.name || ''}`}
                                >
                                  {s.code || s.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted italic">None assigned</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {renderStatusBadge(tStatus)}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-muted">
                          {regDate ? new Date(regDate).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {tStatus === 'PENDING' && (
                              <>
                                <Button
                                  id={`approve-${t.id}`}
                                  variant="primary"
                                  size="sm"
                                  onClick={() => {
                                    setApproveModal({ teacher: t, selectedIds: t.assigned_subject_ids || [] })
                                    setModalSubjSearch('')
                                  }}
                                  disabled={actingId === t.id}
                                  className="bg-green-600 hover:bg-green-700 text-white gap-1"
                                >
                                  {actingId === t.id ? <RefreshCw size={12} className="animate-spin" /> : <UserCheck size={14} />}
                                  Approve
                                </Button>
                                <Button
                                  id={`reject-${t.id}`}
                                  variant="danger"
                                  size="sm"
                                  onClick={() => { setActionModal({ type: 'reject', teacher: t }); setModalReason('') }}
                                  disabled={actingId === t.id}
                                  className="gap-1"
                                >
                                  <UserX size={14} /> Reject
                                </Button>
                              </>
                            )}

                            {tStatus === 'ACTIVE' && (
                              <>
                                <Button
                                  id={`subjects-${t.id}`}
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSubjectModal({ teacher: t, selectedIds: t.assigned_subject_ids || [] })
                                    setModalSubjSearch('')
                                  }}
                                  className="gap-1 text-xs"
                                >
                                  <BookOpen size={13} className="text-brand" /> Subjects
                                </Button>
                                <Button
                                  id={`suspend-${t.id}`}
                                  variant="outline"
                                  size="sm"
                                  onClick={() => { setActionModal({ type: 'suspend', teacher: t }); setModalReason('') }}
                                  disabled={actingId === t.id}
                                  className="gap-1 text-xs text-amber-700 hover:bg-amber-50 border-amber-200"
                                >
                                  <ShieldAlert size={13} /> Suspend
                                </Button>
                                <Button
                                  id={`disable-${t.id}`}
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => { setActionModal({ type: 'disable', teacher: t }); setModalReason('') }}
                                  disabled={actingId === t.id}
                                  className="gap-1 text-xs text-red-600 hover:bg-red-50"
                                >
                                  <ShieldOff size={13} /> Disable
                                </Button>
                              </>
                            )}

                            {tStatus === 'SUSPENDED' && (
                              <Button
                                id={`reapprove-${t.id}`}
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setApproveModal({ teacher: t, selectedIds: t.assigned_subject_ids || [] })
                                  setModalSubjSearch('')
                                }}
                                disabled={actingId === t.id}
                                className="gap-1 text-green-700 border-green-300 hover:bg-green-50"
                              >
                                <UserCheck size={14} /> Reactivate
                              </Button>
                            )}

                            {(tStatus === 'REJECTED' || tStatus === 'DISABLED') && (
                              <Button
                                id={`reapprove-${t.id}`}
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setApproveModal({ teacher: t, selectedIds: t.assigned_subject_ids || [] })
                                  setModalSubjSearch('')
                                }}
                                disabled={actingId === t.id}
                                className="gap-1 text-xs"
                              >
                                <UserCheck size={14} /> Restore
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Responsive Cards (< 1024px) */}
            <div className="lg:hidden divide-y divide-line">
              {filtered.map((t, i) => {
                const tStatus = t.status || t.account_status
                const empId = t.employee_id || t.profile?.employee_id || '—'
                const dept = t.department || t.profile?.department || '—'
                const assignedList = t.assigned_subjects || []
                const initial = (t.name || t.full_name || 'F').charAt(0).toUpperCase()

                return (
                  <div key={t.id || t.email} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand/10 text-brand font-semibold text-sm flex items-center justify-center shrink-0">
                          {initial}
                        </div>
                        <div>
                          <p className="font-semibold text-ink text-sm">
                            {t.name || t.full_name}
                          </p>
                          <p className="text-xs text-muted truncate max-w-[200px]">{t.email}</p>
                        </div>
                      </div>
                      <div>
                        {renderStatusBadge(tStatus)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-bg/50 p-2.5 rounded-lg border border-line">
                      <div>
                        <span className="text-muted block text-[11px]">Employee ID</span>
                        <span className="font-mono font-medium text-ink">{empId}</span>
                      </div>
                      <div>
                        <span className="text-muted block text-[11px]">Department</span>
                        <span className="font-medium text-ink truncate block">{dept}</span>
                      </div>
                    </div>

                    {assignedList.length > 0 && (
                      <div>
                        <span className="text-[11px] text-muted block mb-1">Assigned Subjects ({assignedList.length}):</span>
                        <div className="flex flex-wrap gap-1">
                          {assignedList.map(s => (
                            <span
                              key={s.id}
                              className="text-[11px] font-mono bg-bg border border-line text-ink px-1.5 py-0.5 rounded"
                            >
                              {s.code || s.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Mobile Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-line/60">
                      {tStatus === 'PENDING' && (
                        <>
                          <Button
                            id={`approve-mobile-${t.id}`}
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setApproveModal({ teacher: t, selectedIds: t.assigned_subject_ids || [] })
                              setModalSubjSearch('')
                            }}
                            disabled={actingId === t.id}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                          >
                            <UserCheck size={14} /> Approve
                          </Button>
                          <Button
                            id={`reject-mobile-${t.id}`}
                            variant="danger"
                            size="sm"
                            onClick={() => { setActionModal({ type: 'reject', teacher: t }); setModalReason('') }}
                            disabled={actingId === t.id}
                            className="flex-1"
                          >
                            <UserX size={14} /> Reject
                          </Button>
                        </>
                      )}

                      {tStatus === 'ACTIVE' && (
                        <>
                          <Button
                            id={`subjects-mobile-${t.id}`}
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSubjectModal({ teacher: t, selectedIds: t.assigned_subject_ids || [] })
                              setModalSubjSearch('')
                            }}
                            className="flex-1"
                          >
                            <BookOpen size={13} className="text-brand" /> Subjects
                          </Button>
                          <Button
                            id={`suspend-mobile-${t.id}`}
                            variant="outline"
                            size="sm"
                            onClick={() => { setActionModal({ type: 'suspend', teacher: t }); setModalReason('') }}
                            disabled={actingId === t.id}
                            className="text-amber-700 border-amber-200"
                          >
                            <ShieldAlert size={13} />
                          </Button>
                          <Button
                            id={`disable-mobile-${t.id}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => { setActionModal({ type: 'disable', teacher: t }); setModalReason('') }}
                            disabled={actingId === t.id}
                            className="text-red-600"
                          >
                            <ShieldOff size={13} />
                          </Button>
                        </>
                      )}

                      {tStatus === 'SUSPENDED' && (
                        <Button
                          id={`reapprove-mobile-${t.id}`}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setApproveModal({ teacher: t, selectedIds: t.assigned_subject_ids || [] })
                            setModalSubjSearch('')
                          }}
                          disabled={actingId === t.id}
                          className="w-full text-green-700 border-green-300"
                        >
                          <UserCheck size={14} /> Reactivate Account
                        </Button>
                      )}

                      {(tStatus === 'REJECTED' || tStatus === 'DISABLED') && (
                        <Button
                          id={`reapprove-mobile-${t.id}`}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setApproveModal({ teacher: t, selectedIds: t.assigned_subject_ids || [] })
                            setModalSubjSearch('')
                          }}
                          disabled={actingId === t.id}
                          className="w-full"
                        >
                          <UserCheck size={14} /> Restore Account
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>

      {/* APPROVE & ASSIGN SUBJECTS MODAL */}
      <Modal
        isOpen={Boolean(approveModal)}
        onClose={() => setApproveModal(null)}
        title="Approve Faculty & Assign Subjects"
        description={approveModal ? `${approveModal.teacher.name || approveModal.teacher.full_name} (${approveModal.teacher.email})` : ''}
        maxWidth="max-w-xl"
      >
        {approveModal && (
          <div className="space-y-4">
            <p className="text-xs text-muted">
              Select the curriculum subjects this faculty member is authorized to teach. The teacher will only be able to launch attendance sessions for authorized subjects.
            </p>

            <Input
              type="text"
              placeholder="Filter subjects by name or code..."
              value={modalSubjSearch}
              onChange={e => setModalSubjSearch(e.target.value)}
              icon={Search}
            />

            <div className="overflow-y-auto max-h-60 border border-line rounded-lg p-2 space-y-1.5 bg-bg/50">
              {allSubjects
                .filter(s => {
                  const q = modalSubjSearch.toLowerCase()
                  return !q || s.name?.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q)
                })
                .map(s => {
                  const isChecked = approveModal.selectedIds.includes(s.id)
                  const divLabel = s.divisions?.name || s.division?.name || ''
                  const courseLabel = s.divisions?.courses?.code || s.division?.course?.code || ''
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all border ${
                        isChecked
                          ? 'bg-brand/10 border-brand/30 text-ink'
                          : 'bg-surface border-line hover:bg-bg/60 text-muted'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setApproveModal(prev => ({ ...prev, selectedIds: [...prev.selectedIds, s.id] }))
                            } else {
                              setApproveModal(prev => ({ ...prev, selectedIds: prev.selectedIds.filter(id => id !== s.id) }))
                            }
                          }}
                          className="h-4 w-4 rounded border-line text-brand focus:ring-brand/30 cursor-pointer"
                        />
                        <div>
                          <p className={`text-xs font-semibold ${isChecked ? 'text-ink' : 'text-ink/80'}`}>{s.name}</p>
                          <p className="text-[11px] text-muted font-mono">{s.code} {divLabel ? `• ${divLabel}` : ''} {courseLabel ? `(${courseLabel})` : ''}</p>
                        </div>
                      </div>
                      {isChecked && <Check size={16} className="text-brand shrink-0" />}
                    </label>
                  )
                })}
              {allSubjects.length === 0 && (
                <p className="text-center text-xs text-muted py-6">No subjects found in academic database.</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-line">
              <span className="text-xs font-semibold text-brand">
                {approveModal.selectedIds.length} subjects selected
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setApproveModal(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApproveSubmit}
                  disabled={actingId === approveModal.teacher.id}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {actingId === approveModal.teacher.id ? 'Activating...' : 'Approve & Assign'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MANAGE / EDIT SUBJECTS MODAL */}
      <Modal
        isOpen={Boolean(subjectModal)}
        onClose={() => setSubjectModal(null)}
        title="Assign / Update Subjects"
        description={subjectModal ? `Faculty: ${subjectModal.teacher.name || subjectModal.teacher.full_name} (${subjectModal.teacher.email})` : ''}
        maxWidth="max-w-xl"
      >
        {subjectModal && (
          <div className="space-y-4">
            <p className="text-xs text-muted">
              Update authorized subjects for this teacher. The teacher will only see lectures and take attendance for these assigned subjects.
            </p>

            <Input
              type="text"
              placeholder="Filter subjects by name or code..."
              value={modalSubjSearch}
              onChange={e => setModalSubjSearch(e.target.value)}
              icon={Search}
            />

            <div className="overflow-y-auto max-h-60 border border-line rounded-lg p-2 space-y-1.5 bg-bg/50">
              {allSubjects
                .filter(s => {
                  const q = modalSubjSearch.toLowerCase()
                  return !q || s.name?.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q)
                })
                .map(s => {
                  const isChecked = subjectModal.selectedIds.includes(s.id)
                  const divLabel = s.divisions?.name || s.division?.name || ''
                  const courseLabel = s.divisions?.courses?.code || s.division?.course?.code || ''
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all border ${
                        isChecked
                          ? 'bg-brand/10 border-brand/30 text-ink'
                          : 'bg-surface border-line hover:bg-bg/60 text-muted'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setSubjectModal(prev => ({ ...prev, selectedIds: [...prev.selectedIds, s.id] }))
                            } else {
                              setSubjectModal(prev => ({ ...prev, selectedIds: prev.selectedIds.filter(id => id !== s.id) }))
                            }
                          }}
                          className="h-4 w-4 rounded border-line text-brand focus:ring-brand/30 cursor-pointer"
                        />
                        <div>
                          <p className={`text-xs font-semibold ${isChecked ? 'text-ink' : 'text-ink/80'}`}>{s.name}</p>
                          <p className="text-[11px] text-muted font-mono">{s.code} {divLabel ? `• ${divLabel}` : ''} {courseLabel ? `(${courseLabel})` : ''}</p>
                        </div>
                      </div>
                      {isChecked && <Check size={16} className="text-brand shrink-0" />}
                    </label>
                  )
                })}
              {allSubjects.length === 0 && (
                <p className="text-center text-xs text-muted py-6">No subjects found in academic database.</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-line">
              <span className="text-xs font-semibold text-brand">
                {subjectModal.selectedIds.length} subjects currently assigned
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSubjectModal(null)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveSubjects}
                  disabled={savingSubjects}
                >
                  {savingSubjects ? 'Saving...' : 'Save Assignments'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Action Dialog Modal (Suspend / Disable / Reject) */}
      <Modal
        isOpen={Boolean(actionModal)}
        onClose={() => setActionModal(null)}
        title={`${actionModal?.type ? actionModal.type.charAt(0).toUpperCase() + actionModal.type.slice(1) : ''} Faculty Account`}
        description={actionModal ? `${actionModal.teacher.name || actionModal.teacher.full_name} (${actionModal.teacher.email})` : ''}
        maxWidth="max-w-md"
      >
        {actionModal && (
          <form onSubmit={handleModalSubmit} className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-bg border border-line">
              <div className={`p-2 rounded-lg shrink-0 ${
                actionModal.type === 'suspend' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
              }`}>
                {actionModal.type === 'suspend' ? <ShieldAlert size={20} /> : <ShieldOff size={20} />}
              </div>
              <p className="text-xs text-muted">
                {actionModal.type === 'suspend'
                  ? 'This will immediately freeze access and terminate the teacher’s active login sessions across all devices.'
                  : 'This will deactivate the teacher account and immediately revoke their access tokens.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink">
                Audit Reason (Required):
              </label>
              <textarea
                required
                rows={3}
                className="w-full text-xs p-3 rounded-lg border border-line bg-surface text-ink placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none resize-none"
                placeholder={`Reason for ${actionModal.type} (e.g. End of contract, Administrative review, etc.)`}
                value={modalReason}
                onChange={e => setModalReason(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActionModal(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={actionModal.type === 'suspend' ? 'primary' : 'danger'}
                size="sm"
                disabled={actingId === actionModal.teacher.id}
                className={actionModal.type === 'suspend' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}
              >
                {actingId === actionModal.teacher.id ? 'Processing...' : `Confirm ${actionModal.type}`}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
