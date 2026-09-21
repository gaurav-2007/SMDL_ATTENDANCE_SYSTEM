import { useEffect, useState, useCallback } from 'react'
import {
  Users, Search, UserCheck, UserX, Clock, Plus, X,
  ChevronDown, GraduationCap, Phone, BookOpen, Filter,
  RefreshCw, Eye, CheckCircle, XCircle
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'

const STATUS_BADGE = {
  ACTIVE:   'badge badge-active',
  PENDING:  'badge badge-warning',
  REJECTED: 'badge badge-danger',
  INACTIVE: 'badge badge-muted',
}

export default function StudentsPanel() {
  const [students, setStudents] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [courseFilter, setCourseFilter] = useState('ALL')
  const [courses, setCourses]   = useState([])
  const [selected, setSelected] = useState(null)  // for detail modal
  const [actionLoading, setActionLoading] = useState(false)

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/students')
      setStudents(data.data?.students || [])
    } catch {
      toast.error('Could not load students')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCourses = useCallback(async () => {
    try {
      const { data } = await api.get('/academic/courses')
      setCourses(data.data?.courses || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchStudents()
    fetchCourses()
  }, [fetchStudents, fetchCourses])

  async function updateStatus(studentId, status) {
    setActionLoading(true)
    try {
      await api.patch(`/admin/students/${studentId}/status`, { status })
      toast.success(`Student ${status.toLowerCase()} successfully`)
      setSelected(null)
      fetchStudents()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Action failed')
    } finally {
      setActionLoading(false)
    }
  }

  const filtered = students.filter(s => {
    const matchSearch = !search ||
      s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.users?.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.roll_number?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'ALL' || s.users?.status === statusFilter
    const matchCourse = courseFilter === 'ALL' || s.courses?.id === courseFilter
    return matchSearch && matchStatus && matchCourse
  })

  const stats = {
    total:    students.length,
    active:   students.filter(s => s.users?.status === 'ACTIVE').length,
    pending:  students.filter(s => s.users?.status === 'PENDING').length,
    rejected: students.filter(s => s.users?.status === 'REJECTED').length,
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Students Management</h2>
          <p className="page-subtitle">Manage student accounts & approvals</p>
        </div>
        <button
          onClick={fetchStudents}
          className="btn btn-ghost btn-sm flex items-center gap-2"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total,    color: 'text-blue-400',   bg: 'bg-blue-500/10',   Icon: Users },
          { label: 'Active', value: stats.active,  color: 'text-green-400',  bg: 'bg-green-500/10',  Icon: UserCheck },
          { label: 'Pending', value: stats.pending, color: 'text-yellow-400', bg: 'bg-yellow-500/10', Icon: Clock },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-400',  bg: 'bg-red-500/10',   Icon: UserX },
        ].map(({ label, value, color, bg, Icon }) => (
          <div key={label} className="stat-card">
            <div className={`stat-icon ${bg} ${color}`}><Icon size={20} /></div>
            <div>
              <p className={`text-2xl font-bold ${color}`}>{loading ? '—' : value}</p>
              <p className="text-brand-muted text-xs">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
            <input
              id="student-search"
              type="text"
              placeholder="Search by name, email, roll no..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-input pl-9 py-2 text-sm w-full"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <select
              id="status-filter"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="form-input py-2 text-sm"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            <select
              id="course-filter"
              value={courseFilter}
              onChange={e => setCourseFilter(e.target.value)}
              className="form-input py-2 text-sm"
            >
              <option value="ALL">All Courses</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-white/10 border-t-brand-accent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <GraduationCap size={40} className="mx-auto text-brand-muted mb-3" />
            <p className="text-white font-semibold">No students found</p>
            <p className="text-brand-muted text-sm mt-1">Try changing your search or filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Roll No</th>
                  <th>Course</th>
                  <th>Division</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {s.full_name?.charAt(0)?.toUpperCase() || 'S'}
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">{s.full_name}</p>
                          <p className="text-brand-muted text-xs">{s.users?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="font-mono text-brand-muted text-xs bg-white/5 px-2 py-0.5 rounded">
                        {s.roll_number || '—'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <BookOpen size={13} className="text-brand-accent" />
                        <span className="text-sm text-brand-text">{s.courses?.name || '—'}</span>
                      </div>
                    </td>
                    <td>
                      <span className="text-sm text-brand-text">{s.divisions?.name || '—'}</span>
                    </td>
                    <td>
                      <span className={STATUS_BADGE[s.users?.status] || 'badge badge-muted'}>
                        {s.users?.status || 'UNKNOWN'}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => setSelected(s)}
                        className="btn btn-ghost btn-sm"
                        id={`view-student-${s.id}`}
                      >
                        <Eye size={14} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Total count */}
      {!loading && (
        <p className="text-brand-muted text-xs mt-3 text-right">
          Showing {filtered.length} of {students.length} students
        </p>
      )}

      {/* Detail Modal */}
      {selected && (
        <StudentDetailModal
          student={selected}
          loading={actionLoading}
          onClose={() => setSelected(null)}
          onUpdateStatus={updateStatus}
        />
      )}
    </div>
  )
}

function StudentDetailModal({ student: s, loading, onClose, onUpdateStatus }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 btn-icon btn-ghost">
          <X size={16} />
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-xl bg-gradient-brand flex items-center justify-center text-white text-xl font-bold">
            {s.full_name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">{s.full_name}</h3>
            <p className="text-brand-muted text-sm">{s.users?.email}</p>
            <span className={`${STATUS_BADGE[s.users?.status]} mt-1 inline-block`}>
              {s.users?.status}
            </span>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <DetailRow label="Roll Number" value={s.roll_number || '—'} />
          <DetailRow label="Course" value={s.courses?.name || '—'} />
          <DetailRow label="Division" value={s.divisions?.name || '—'} />
          <DetailRow label="Phone" value={s.phone || '—'} />
          <DetailRow label="Joined" value={s.users?.created_at ? new Date(s.users.created_at).toLocaleDateString('en-IN') : '—'} />
        </div>

        <div className="flex gap-2">
          {s.users?.status !== 'ACTIVE' && (
            <button
              id={`approve-student-${s.id}`}
              onClick={() => onUpdateStatus(s.id, 'ACTIVE')}
              disabled={loading}
              className="btn btn-success flex-1 flex items-center justify-center gap-2"
            >
              <CheckCircle size={15} />
              {loading ? 'Processing...' : 'Approve'}
            </button>
          )}
          {s.users?.status !== 'REJECTED' && (
            <button
              id={`reject-student-${s.id}`}
              onClick={() => onUpdateStatus(s.id, 'REJECTED')}
              disabled={loading}
              className="btn btn-danger flex-1 flex items-center justify-center gap-2"
            >
              <XCircle size={15} />
              {loading ? 'Processing...' : 'Reject'}
            </button>
          )}
          {s.users?.status !== 'INACTIVE' && (
            <button
              id={`deactivate-student-${s.id}`}
              onClick={() => onUpdateStatus(s.id, 'INACTIVE')}
              disabled={loading}
              className="btn btn-ghost flex items-center gap-2"
            >
              Deactivate
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-brand-border/50">
      <span className="text-brand-muted text-sm">{label}</span>
      <span className="text-white text-sm font-medium">{value}</span>
    </div>
  )
}
