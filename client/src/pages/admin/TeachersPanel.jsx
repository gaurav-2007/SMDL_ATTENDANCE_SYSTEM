import { useEffect, useState } from 'react'
import {
  UserCheck, UserX, Clock, RefreshCw, Search, Filter,
  ShieldAlert, ShieldOff, AlertCircle, BookOpen, CheckSquare, Square, Check, X
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'

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

  return (
    <div className="animate-fade-in">
      <div className="page-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="page-title">Teacher Management & Access Control</h2>
          <p className="page-subtitle">Approve, suspend, disable accounts with immediate global session revocation</p>
        </div>
        <button id="refresh-teachers-btn" onClick={fetchTeachers} className="btn-secondary btn-sm gap-1">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {['ALL', 'PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'].map(s => (
          <button
            key={s}
            id={`filter-${s.toLowerCase()}`}
            onClick={() => setFilter(s)}
            className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
          >
            {s} <span className="ml-1 opacity-70">({counts[s]})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
        <input
          id="teacher-search"
          type="text"
          placeholder="Search by name, email, employee ID or department..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input pl-9"
        />
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="spinner w-8 h-8 border-4" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Filter size={36} className="text-brand-border" />
            <p className="text-brand-muted">No teachers found</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Faculty / Email</th>
                  <th>Employee ID</th>
                  <th>Department</th>
                  <th>Assigned Subjects</th>
                  <th>Account Status</th>
                  <th>Registered</th>
                  <th className="text-right">Access Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                  const tStatus = t.status || t.account_status
                  const empId = t.employee_id || t.profile?.employee_id || '—'
                  const dept = t.department || t.profile?.department || '—'
                  const regDate = t.registered_at || t.profile?.registration_submitted_at
                  const assignedList = t.assigned_subjects || []
                  return (
                    <tr key={t.id || t.email}>
                      <td className="text-brand-muted">{i + 1}</td>
                      <td>
                        <p className="text-white font-medium">{t.name || t.full_name}</p>
                        <p className="text-brand-muted text-xs">{t.email}</p>
                      </td>
                      <td className="font-mono text-sm">{empId}</td>
                      <td>{dept}</td>
                      <td>
                        {assignedList.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {assignedList.map(s => (
                              <span
                                key={s.id}
                                className="text-[11px] bg-brand-dark/80 text-brand-accent px-1.5 py-0.5 rounded border border-brand-accent/20"
                                title={`${s.name} (${s.code || ''}) - ${s.division?.name || ''}`}
                              >
                                {s.code || s.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-brand-muted text-xs italic">No subjects assigned</span>
                        )}
                      </td>
                      <td>
                        {tStatus === 'ACTIVE' && <span className="badge-active">Active</span>}
                        {tStatus === 'PENDING' && <span className="badge-pending">Pending Approval</span>}
                        {tStatus === 'SUSPENDED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            Suspended
                          </span>
                        )}
                        {(tStatus === 'REJECTED' || tStatus === 'DISABLED') && (
                          <span className="badge-rejected">{tStatus === 'DISABLED' ? 'Disabled' : 'Rejected'}</span>
                        )}
                      </td>
                      <td className="text-brand-muted text-xs">
                        {regDate ? new Date(regDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1.5">
                          {tStatus === 'PENDING' && (
                            <>
                              <button
                                id={`approve-${t.id}`}
                                onClick={() => {
                                  setApproveModal({ teacher: t, selectedIds: t.assigned_subject_ids || [] })
                                  setModalSubjSearch('')
                                }}
                                disabled={actingId === t.id}
                                className="btn-success btn-sm"
                                title="Approve and assign subjects"
                              >
                                {actingId === t.id ? <div className="spinner w-3 h-3" /> : <UserCheck size={14} />}
                                Approve
                              </button>
                              <button
                                id={`reject-${t.id}`}
                                onClick={() => { setActionModal({ type: 'reject', teacher: t }); setModalReason('') }}
                                disabled={actingId === t.id}
                                className="btn-danger btn-sm"
                              >
                                <UserX size={14} /> Reject
                              </button>
                            </>
                          )}
                          {tStatus === 'ACTIVE' && (
                            <>
                              <button
                                id={`subjects-${t.id}`}
                                onClick={() => {
                                  setSubjectModal({ teacher: t, selectedIds: t.assigned_subject_ids || [] })
                                  setModalSubjSearch('')
                                }}
                                className="btn-secondary btn-sm !text-sky-400 !border-sky-500/30 hover:!bg-sky-500/10"
                                title="Assign / update subjects"
                              >
                                <BookOpen size={14} /> Subjects
                              </button>
                              <button
                                id={`suspend-${t.id}`}
                                onClick={() => { setActionModal({ type: 'suspend', teacher: t }); setModalReason('') }}
                                disabled={actingId === t.id}
                                className="btn-secondary btn-sm !text-amber-400 !border-amber-500/30 hover:!bg-amber-500/10"
                                title="Temporary freeze + kill session"
                              >
                                <ShieldAlert size={14} /> Suspend
                              </button>
                              <button
                                id={`disable-${t.id}`}
                                onClick={() => { setActionModal({ type: 'disable', teacher: t }); setModalReason('') }}
                                disabled={actingId === t.id}
                                className="btn-danger btn-sm"
                                title="Permanent deactivation + kill session"
                              >
                                <ShieldOff size={14} /> Disable
                              </button>
                            </>
                          )}
                          {tStatus === 'SUSPENDED' && (
                            <button
                              id={`reapprove-${t.id}`}
                              onClick={() => {
                                setApproveModal({ teacher: t, selectedIds: t.assigned_subject_ids || [] })
                                setModalSubjSearch('')
                              }}
                              disabled={actingId === t.id}
                              className="btn-success btn-sm"
                            >
                              <UserCheck size={14} /> Reactivate
                            </button>
                          )}
                          {(tStatus === 'REJECTED' || tStatus === 'DISABLED') && (
                            <button
                              id={`reapprove-${t.id}`}
                              onClick={() => {
                                setApproveModal({ teacher: t, selectedIds: t.assigned_subject_ids || [] })
                                setModalSubjSearch('')
                              }}
                              disabled={actingId === t.id}
                              className="btn-secondary btn-sm"
                            >
                              <UserCheck size={14} /> Restore
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* APPROVE & ASSIGN SUBJECTS MODAL */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-xl border-brand-border/80 bg-brand-surface shadow-2xl animate-scale-up max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-brand-border/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-green-500/15 text-green-400">
                  <UserCheck size={20} />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">Approve Faculty & Assign Subjects</h3>
                  <p className="text-brand-muted text-xs">
                    {approveModal.teacher.name || approveModal.teacher.full_name} ({approveModal.teacher.email})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApproveModal(null)}
                className="text-brand-muted hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-brand-muted text-xs mt-3 mb-2">
              Select the subjects this faculty member is authorized to teach. The teacher will ONLY be able to conduct lectures and take attendance for these selected subjects.
            </p>

            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
              <input
                type="text"
                placeholder="Filter subjects by name or code..."
                value={modalSubjSearch}
                onChange={e => setModalSubjSearch(e.target.value)}
                className="input input-sm pl-8 text-xs"
              />
            </div>

            <div className="overflow-y-auto flex-1 border border-brand-border/50 rounded-xl p-2 space-y-1.5 bg-brand-dark/40 max-h-60">
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
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border ${
                        isChecked
                          ? 'bg-brand-accent/15 border-brand-accent/40 text-white'
                          : 'bg-transparent border-transparent hover:bg-white/5 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
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
                          className="checkbox checkbox-sm accent-brand-accent"
                        />
                        <div>
                          <p className="text-xs font-semibold">{s.name}</p>
                          <p className="text-[11px] text-brand-muted font-mono">{s.code} {divLabel ? `• ${divLabel}` : ''} {courseLabel ? `(${courseLabel})` : ''}</p>
                        </div>
                      </div>
                      {isChecked && <Check size={14} className="text-brand-accent" />}
                    </label>
                  )
                })}
              {allSubjects.length === 0 && (
                <p className="text-center text-xs text-brand-muted py-4">No subjects found in academic database.</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-brand-border/60 mt-3">
              <span className="text-xs text-brand-accent font-medium">
                {approveModal.selectedIds.length} subjects selected
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setApproveModal(null)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApproveSubmit}
                  disabled={actingId === approveModal.teacher.id}
                  className="btn-success btn-sm"
                >
                  {actingId === approveModal.teacher.id ? 'Activating...' : 'Approve & Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE / EDIT SUBJECTS MODAL (FOR ACTIVE TEACHERS) */}
      {subjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-xl border-brand-border/80 bg-brand-surface shadow-2xl animate-scale-up max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-brand-border/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">Assign / Update Subjects</h3>
                  <p className="text-brand-muted text-xs">
                    Faculty: {subjectModal.teacher.name || subjectModal.teacher.full_name} ({subjectModal.teacher.email})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSubjectModal(null)}
                className="text-brand-muted hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-brand-muted text-xs mt-3 mb-2">
              Update authorized subjects for this teacher. The teacher will only see lectures and take attendance for these assigned subjects.
            </p>

            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
              <input
                type="text"
                placeholder="Filter subjects by name or code..."
                value={modalSubjSearch}
                onChange={e => setModalSubjSearch(e.target.value)}
                className="input input-sm pl-8 text-xs"
              />
            </div>

            <div className="overflow-y-auto flex-1 border border-brand-border/50 rounded-xl p-2 space-y-1.5 bg-brand-dark/40 max-h-60">
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
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border ${
                        isChecked
                          ? 'bg-sky-500/15 border-sky-500/40 text-white'
                          : 'bg-transparent border-transparent hover:bg-white/5 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
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
                          className="checkbox checkbox-sm accent-sky-400"
                        />
                        <div>
                          <p className="text-xs font-semibold">{s.name}</p>
                          <p className="text-[11px] text-brand-muted font-mono">{s.code} {divLabel ? `• ${divLabel}` : ''} {courseLabel ? `(${courseLabel})` : ''}</p>
                        </div>
                      </div>
                      {isChecked && <Check size={14} className="text-sky-400" />}
                    </label>
                  )
                })}
              {allSubjects.length === 0 && (
                <p className="text-center text-xs text-brand-muted py-4">No subjects found in academic database.</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-brand-border/60 mt-3">
              <span className="text-xs text-sky-400 font-medium">
                {subjectModal.selectedIds.length} subjects currently assigned
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSubjectModal(null)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSubjects}
                  disabled={savingSubjects}
                  className="btn-primary btn-sm"
                >
                  {savingSubjects ? 'Saving...' : 'Save Assignments'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Dialog Modal (Suspend / Disable / Reject) */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-md border-brand-border/80 bg-brand-surface shadow-2xl animate-scale-up">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2.5 rounded-xl ${actionModal.type === 'suspend' ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'}`}>
                {actionModal.type === 'suspend' ? <ShieldAlert size={22} /> : <ShieldOff size={22} />}
              </div>
              <div>
                <h3 className="text-white font-bold text-lg capitalize">{actionModal.type} Faculty Account</h3>
                <p className="text-brand-muted text-xs">
                  {actionModal.teacher.name || actionModal.teacher.full_name} ({actionModal.teacher.email})
                </p>
              </div>
            </div>

            <p className="text-brand-muted text-sm mb-4">
              {actionModal.type === 'suspend'
                ? 'This will immediately freeze access and terminate the teacher’s active login sessions across all devices.'
                : 'This will deactivate the teacher account and immediately revoke their access tokens.'}
            </p>

            <form onSubmit={handleModalSubmit} className="space-y-4">
              <div className="form-group">
                <label className="form-label">Audit Reason (Required):</label>
                <textarea
                  required
                  rows={3}
                  className="form-input resize-none"
                  placeholder={`Reason for ${actionModal.type} (e.g. End of contract, Administrative review, etc.)`}
                  value={modalReason}
                  onChange={e => setModalReason(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actingId === actionModal.teacher.id}
                  className={`btn-sm font-semibold ${
                    actionModal.type === 'suspend'
                      ? 'bg-amber-500 hover:bg-amber-400 text-black'
                      : 'btn-danger'
                  }`}
                >
                  {actingId === actionModal.teacher.id ? 'Processing...' : `Confirm ${actionModal.type}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

