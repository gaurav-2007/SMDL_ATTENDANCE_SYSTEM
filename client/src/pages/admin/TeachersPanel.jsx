import { useEffect, useState } from 'react'
import { UserCheck, UserX, Clock, RefreshCw, Search, Filter } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'

export default function TeachersPanel() {
  const [teachers, setTeachers]   = useState([])
  const [loading,  setLoading]    = useState(true)
  const [filter,   setFilter]     = useState('ALL')   // ALL | PENDING | ACTIVE | REJECTED
  const [search,   setSearch]     = useState('')
  const [actingId, setActingId]   = useState(null)    // which teacher is being approved/rejected

  async function fetchTeachers() {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/teachers')
      // Backend returns data.data.teachers (alias for 'all') or data.data.all
      const list = data.data?.teachers || data.data?.all || []
      setTeachers(list)
    } catch {
      toast.error('Failed to load teachers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTeachers() }, [])

  async function approve(teacherId) {
    setActingId(teacherId)
    try {
      await api.post(`/admin/teachers/${teacherId}/approve`)
      toast.success('Teacher approved! ✅')
      setTeachers(ts => ts.map(t =>
        t.id === teacherId
          ? { ...t, status: 'ACTIVE', account_status: 'ACTIVE' }
          : t
      ))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approval failed')
    } finally {
      setActingId(null)
    }
  }

  async function reject(teacherId) {
    const reason = window.prompt('Rejection reason (required):') ?? ''
    if (!reason.trim()) {
      toast.error('Rejection reason is required')
      return
    }
    setActingId(teacherId)
    try {
      await api.post(`/admin/teachers/${teacherId}/reject`, { reason })
      toast.success('Teacher rejected')
      setTeachers(ts => ts.map(t =>
        t.id === teacherId
          ? { ...t, status: 'REJECTED', account_status: 'REJECTED' }
          : t
      ))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rejection failed')
    } finally {
      setActingId(null)
    }
  }

  const filtered = teachers.filter(t => {
    const tStatus = t.status || t.account_status
    const matchStatus = filter === 'ALL' || tStatus === filter
    const q = search.toLowerCase()
    const empId = t.employee_id || t.profile?.employee_id || ''
    const dept  = t.department  || t.profile?.department  || ''
    const matchSearch = !q ||
      (t.name || t.full_name || '').toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      empId.toLowerCase().includes(q) ||
      dept.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const counts = {
    ALL: teachers.length,
    PENDING:  teachers.filter(t => (t.status || t.account_status) === 'PENDING').length,
    ACTIVE:   teachers.filter(t => (t.status || t.account_status) === 'ACTIVE').length,
    REJECTED: teachers.filter(t => (t.status || t.account_status) === 'REJECTED').length,
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="page-title">Teacher Management</h2>
          <p className="page-subtitle">Approve or reject teacher registration requests</p>
        </div>
        <button id="refresh-teachers-btn" onClick={fetchTeachers} className="btn-secondary btn-sm gap-1">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {['ALL','PENDING','ACTIVE','REJECTED'].map(s => (
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
                  <th>Name / Email</th>
                  <th>Employee ID</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => {
                    const tStatus  = t.status || t.account_status
                    const empId    = t.employee_id || t.profile?.employee_id || '—'
                    const dept     = t.department  || t.profile?.department  || '—'
                    const regDate  = t.registered_at || t.profile?.registration_submitted_at
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
                      {tStatus === 'ACTIVE'   && <span className="badge-active">Active</span>}
                      {tStatus === 'PENDING'  && <span className="badge-pending">Pending</span>}
                      {tStatus === 'REJECTED' && <span className="badge-rejected">Rejected</span>}
                    </td>
                    <td className="text-brand-muted text-xs">
                      {regDate ? new Date(regDate).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        {tStatus === 'PENDING' && (
                          <>
                            <button
                              id={`approve-${t.id}`}
                              onClick={() => approve(t.id)}
                              disabled={actingId === t.id}
                              className="btn-success btn-sm"
                            >
                              {actingId === t.id ? <div className="spinner w-3 h-3" /> : <UserCheck size={14} />}
                              Approve
                            </button>
                            <button
                              id={`reject-${t.id}`}
                              onClick={() => reject(t.id)}
                              disabled={actingId === t.id}
                              className="btn-danger btn-sm"
                            >
                              <UserX size={14} /> Reject
                            </button>
                          </>
                        )}
                        {tStatus === 'ACTIVE' && (
                          <button
                            id={`revoke-${t.id}`}
                            onClick={() => reject(t.id)}
                            disabled={actingId === t.id}
                            className="btn-danger btn-sm"
                          >
                            <UserX size={14} /> Revoke
                          </button>
                        )}
                        {tStatus === 'REJECTED' && (
                          <button
                            id={`reapprove-${t.id}`}
                            onClick={() => approve(t.id)}
                            disabled={actingId === t.id}
                            className="btn-success btn-sm"
                          >
                            <UserCheck size={14} /> Re-Approve
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
    </div>
  )
}
