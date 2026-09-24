import { useEffect, useState, useCallback } from 'react'
import { Users, UserCheck, UserX, Clock, TrendingUp, RefreshCw, CheckCircle, XCircle, GraduationCap } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'

export default function AdminHome() {
  const [teachers, setTeachers] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [actingId, setActingId] = useState(null)

  const fetchTeachers = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/teachers')
      // Backend returns data.data.teachers (alias for 'all')
      const list = data.data?.teachers || data.data?.all || []
      setTeachers(list)
    } catch {
      toast.error('Failed to load teacher data')
      setTeachers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTeachers() }, [fetchTeachers])

  const stats = {
    total:    teachers.length,
    active:   teachers.filter(t => (t.status || t.account_status) === 'ACTIVE').length,
    pending:  teachers.filter(t => (t.status || t.account_status) === 'PENDING').length,
    rejected: teachers.filter(t => (t.status || t.account_status) === 'REJECTED').length,
  }

  const pendingTeachers = teachers.filter(t => (t.status || t.account_status) === 'PENDING')

  async function approve(teacherId, teacherName) {
    setActingId(teacherId)
    try {
      await api.post(`/admin/teachers/${teacherId}/approve`)
      toast.success(`✅ ${teacherName} approved! They can now log in.`)
      setTeachers(prev => prev.map(t =>
        t.id === teacherId ? { ...t, status: 'ACTIVE', account_status: 'ACTIVE' } : t
      ))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approval failed')
    } finally {
      setActingId(null)
    }
  }

  async function reject(teacherId, teacherName) {
    const reason = window.prompt(`Reason for rejecting ${teacherName} (required):`)
    if (reason === null) return // user cancelled
    if (!reason.trim()) {
      toast.error('Rejection reason is required')
      return
    }
    setActingId(teacherId)
    try {
      await api.post(`/admin/teachers/${teacherId}/reject`, { reason })
      toast.success(`${teacherName} rejected.`)
      setTeachers(prev => prev.map(t =>
        t.id === teacherId ? { ...t, status: 'REJECTED', account_status: 'REJECTED' } : t
      ))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rejection failed')
    } finally {
      setActingId(null)
    }
  }

  const cards = [
    { label: 'Total Teachers',   value: stats.total,    Icon: Users,     color: 'bg-blue-500/20 text-blue-400' },
    { label: 'Active Teachers',  value: stats.active,   Icon: UserCheck, color: 'bg-green-500/20 text-green-400' },
    { label: 'Pending Approval', value: stats.pending,  Icon: Clock,     color: 'bg-yellow-500/20 text-yellow-400' },
    { label: 'Rejected',         value: stats.rejected, Icon: UserX,     color: 'bg-red-500/20 text-red-400' },
  ]

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="page-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="page-title">Admin Dashboard</h2>
          <p className="page-subtitle">SMDL College — Overview</p>
        </div>
        <button
          id="refresh-dashboard-btn"
          onClick={fetchTeachers}
          className="btn-secondary btn-sm gap-1"
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, Icon, color }) => (
          <div key={label} className="stat-card">
            <div className={`stat-icon ${color}`}><Icon size={22} /></div>
            <div>
              <p className="text-2xl font-bold text-white">
                {loading ? <span className="text-brand-muted">—</span> : value}
              </p>
              <p className="text-brand-muted text-xs mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pending Teacher Approvals */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Clock size={18} className="text-yellow-400" />
            Pending Teacher Approvals
            {!loading && stats.pending > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold">
                {stats.pending}
              </span>
            )}
          </h3>
          <a href="/admin/teachers" className="text-brand-accent text-xs hover:underline">
            View All Teachers →
          </a>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="spinner w-8 h-8 border-4" />
          </div>
        ) : pendingTeachers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center">
              <CheckCircle size={28} className="text-green-400" />
            </div>
            <div className="text-center">
              <p className="text-white font-medium">All caught up!</p>
              <p className="text-brand-muted text-sm mt-1">No pending teacher approval requests.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingTeachers.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20 hover:border-yellow-500/40 transition-colors"
              >
                {/* Teacher Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {(t.name || t.full_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold truncate">
                      {t.name || t.full_name}
                    </p>
                    <p className="text-brand-muted text-xs truncate">{t.email}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {t.employee_id && (
                        <span className="text-xs font-mono text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded">
                          {t.employee_id}
                        </span>
                      )}
                      {t.department && (
                        <span className="text-xs text-brand-muted flex items-center gap-1">
                          <GraduationCap size={11} />
                          {t.department}
                        </span>
                      )}
                      {t.registered_at && (
                        <span className="text-xs text-brand-muted">
                          Registered: {new Date(t.registered_at).toLocaleDateString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    id={`home-approve-${t.id}`}
                    onClick={() => approve(t.id, t.name || t.full_name)}
                    disabled={actingId === t.id}
                    className="btn-success btn-sm gap-1"
                  >
                    {actingId === t.id
                      ? <div className="spinner w-3 h-3" />
                      : <UserCheck size={14} />}
                    Approve
                  </button>
                  <button
                    id={`home-reject-${t.id}`}
                    onClick={() => reject(t.id, t.name || t.full_name)}
                    disabled={actingId === t.id}
                    className="btn-danger btn-sm gap-1"
                  >
                    <XCircle size={14} />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <TrendingUp size={18} className="text-brand-accent" />
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a href="/admin/teachers" className="card-sm hover:border-brand-accent transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-yellow-500/20 text-yellow-400 w-10 h-10">
                <Clock size={18} />
              </div>
              <div>
                <p className="text-white font-semibold text-sm group-hover:text-brand-accent transition-colors">
                  Teacher Management
                </p>
                <p className="text-brand-muted text-xs">
                  {loading ? '...' : `${stats.pending} pending · ${stats.active} active`}
                </p>
              </div>
            </div>
          </a>
          <a href="/admin/students" className="card-sm hover:border-brand-accent transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-blue-500/20 text-blue-400 w-10 h-10">
                <Users size={18} />
              </div>
              <div>
                <p className="text-white font-semibold text-sm group-hover:text-brand-accent transition-colors">
                  Student Management
                </p>
                <p className="text-brand-muted text-xs">View and manage student accounts</p>
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  )
}
