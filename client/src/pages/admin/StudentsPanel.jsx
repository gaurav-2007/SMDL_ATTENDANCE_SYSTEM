import { useEffect, useState, useCallback } from 'react'
import {
  Users, Search, UserCheck, UserX, Clock, Plus, X,
  ChevronDown, GraduationCap, Phone, BookOpen, Filter,
  RefreshCw, Eye, CheckCircle, XCircle, Upload, ArrowRightLeft,
  FileSpreadsheet, Loader2, Download
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
  const [divisions, setDivisions] = useState([])
  const [selected, setSelected] = useState(null)  // for detail modal
  const [actionLoading, setActionLoading] = useState(false)

  // Bulk Import & Transfer Modals
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [transferTargetStudent, setTransferTargetStudent] = useState(null)

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

  const fetchAcademicData = useCallback(async () => {
    try {
      const [cRes, dRes] = await Promise.all([
        api.get('/academic/courses'),
        api.get('/academic/divisions'),
      ])
      setCourses(cRes.data.data?.courses || [])
      setDivisions(dRes.data.data?.divisions || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchStudents()
    fetchAcademicData()
  }, [fetchStudents, fetchAcademicData])


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
          <p className="page-subtitle">Manage student accounts, bulk imports & division transfers</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkModal(true)}
            className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-md"
          >
            <Upload size={14} /> Bulk CSV Import
          </button>
          <button
            onClick={fetchStudents}
            className="btn btn-ghost btn-sm flex items-center gap-2"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
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
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelected(s)}
                          className="btn btn-ghost btn-sm"
                          id={`view-student-${s.id}`}
                        >
                          <Eye size={14} /> View
                        </button>
                        <button
                          onClick={() => setTransferTargetStudent(s)}
                          className="btn btn-ghost btn-sm text-xs !text-indigo-400 hover:!bg-indigo-500/10 flex items-center gap-1"
                          title="Transfer Division"
                        >
                          <ArrowRightLeft size={13} /> Transfer
                        </button>
                      </div>
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
          onOpenTransfer={(s) => { setSelected(null); setTransferTargetStudent(s) }}
        />
      )}

      {/* Bulk CSV Import Modal */}
      {showBulkModal && (
        <BulkImportModal
          courses={courses}
          divisions={divisions}
          onClose={() => setShowBulkModal(false)}
          onSuccess={fetchStudents}
        />
      )}

      {/* Division Transfer Modal */}
      {transferTargetStudent && (
        <TransferDivisionModal
          student={transferTargetStudent}
          courses={courses}
          divisions={divisions}
          onClose={() => setTransferTargetStudent(null)}
          onSuccess={fetchStudents}
        />
      )}
    </div>
  )
}

function StudentDetailModal({ student: s, loading, onClose, onUpdateStatus, onOpenTransfer }) {
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

        <div className="space-y-2">
          <button
            onClick={() => onOpenTransfer(s)}
            className="btn btn-secondary w-full flex items-center justify-center gap-2 text-xs"
          >
            <ArrowRightLeft size={14} className="text-indigo-400" />
            Transfer Division / Batch
          </button>

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
    </div>
  )
}

function BulkImportModal({ courses, divisions, onClose, onSuccess }) {
  const [selectedCourse, setSelectedCourse] = useState(courses[0]?.id || '')
  const [selectedDivision, setSelectedDivision] = useState('')
  const [csvText, setCsvText] = useState('')
  const [importing, setImporting] = useState(false)

  const courseDivisions = divisions.filter(d => !selectedCourse || d.course_id === selectedCourse)

  useEffect(() => {
    if (courseDivisions.length > 0 && !selectedDivision) {
      setSelectedDivision(courseDivisions[0].id)
    }
  }, [courseDivisions, selectedDivision])

  const parsedRows = useMemo(() => {
    if (!csvText.trim()) return []
    const lines = csvText.trim().split('\n').filter(Boolean)
    const result = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      if (i === 0 && (line.toLowerCase().startsWith('roll') || line.toLowerCase().startsWith('sr'))) continue
      const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''))
      if (parts.length >= 2) {
        result.push({
          roll_number: parts[0],
          full_name: parts[1],
          email: parts[2] || `${parts[0].toLowerCase()}@student.smdl.ac.in`,
          phone: parts[3] || '',
        })
      }
    }
    return result
  }, [csvText])

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setCsvText(text)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (parsedRows.length === 0) {
      toast.error('Please enter or upload valid student CSV data (Roll Number, Full Name)')
      return
    }
    setImporting(true)
    try {
      const { data } = await api.post('/admin/students/bulk-import', {
        students: parsedRows,
        course_id: selectedCourse,
        division_id: selectedDivision,
      })
      toast.success(data.message || `Imported ${parsedRows.length} students! ✅`)
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk import failed')
    } finally {
      setImporting(false)
    }
  }

  function loadSampleCSV() {
    setCsvText(`Roll Number, Full Name, Email, Phone
CS-101, Aakash Sharma, aakash.sharma@student.smdl.ac.in, 9876543210
CS-102, Sneha Patil, sneha.patil@student.smdl.ac.in, 9876543211
CS-103, Rahul Gupta, rahul.gupta@student.smdl.ac.in, 9876543212
CS-104, Pooja Nair, pooja.nair@student.smdl.ac.in, 9876543213
CS-105, Vikram Nishad, vikram.nishad@student.smdl.ac.in, 9876543214`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-xl relative bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-brand-accent/15 text-brand-accent">
            <Upload size={22} />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Bulk Student Import (CSV)</h3>
            <p className="text-brand-muted text-xs">Import entire division batches with roll numbers & accounts</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label">Target Course:</label>
              <select
                className="form-input text-xs"
                value={selectedCourse}
                onChange={e => setSelectedCourse(e.target.value)}
              >
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Target Division:</label>
              <select
                className="form-input text-xs"
                value={selectedDivision}
                onChange={e => setSelectedDivision(e.target.value)}
              >
                {courseDivisions.map(d => (
                  <option key={d.id} value={d.id}>{d.name} Div {d.division_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <label className="form-label mb-0">CSV Data (Roll, Name, Email, Phone):</label>
            <div className="flex items-center gap-2">
              <label className="text-brand-accent hover:underline cursor-pointer flex items-center gap-1">
                <FileSpreadsheet size={13} /> Upload .CSV
                <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
              </label>
              <span className="text-slate-600">|</span>
              <button type="button" onClick={loadSampleCSV} className="text-slate-400 hover:text-white">
                Load Sample
              </button>
            </div>
          </div>

          <textarea
            rows={5}
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            className="form-input font-mono text-xs resize-none"
            placeholder="Roll Number, Full Name, Email, Phone&#10;101, Aakash Sharma, aakash@student.smdl.ac.in, 9876543210&#10;102, Sneha Patil, sneha@student.smdl.ac.in, 9876543211"
          />

          {parsedRows.length > 0 && (
            <div className="border border-slate-800 rounded-xl p-3 bg-slate-950/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300">Parsed Preview ({parsedRows.length} students)</span>
                <span className="badge badge-active text-[10px]">Valid Format</span>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 divide-y divide-slate-800/40">
                {parsedRows.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] pt-1 text-slate-400">
                    <span className="font-mono text-white font-medium">{r.roll_number} - {r.full_name}</span>
                    <span className="truncate max-w-[150px]">{r.email}</span>
                  </div>
                ))}
                {parsedRows.length > 5 && (
                  <p className="text-[10px] text-slate-500 pt-1 text-center">... and {parsedRows.length - 5} more</p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={importing || parsedRows.length === 0}
              className="btn btn-primary btn-sm flex items-center gap-1.5"
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Import {parsedRows.length} Students
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TransferDivisionModal({ student, courses, divisions, onClose, onSuccess }) {
  const [targetDivision, setTargetDivision] = useState(divisions[0]?.id || '')
  const [reason, setReason] = useState('')
  const [transferring, setTransferring] = useState(false)

  async function handleTransfer(e) {
    e.preventDefault()
    if (!targetDivision) return
    setTransferring(true)
    try {
      const { data } = await api.post(`/admin/students/${student.id}/transfer`, {
        new_division_id: targetDivision,
        reason,
      })
      toast.success(data.message || 'Student transferred successfully! ✅')
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transfer failed')
    } finally {
      setTransferring(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-md relative bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400">
            <ArrowRightLeft size={22} />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Transfer Student Division</h3>
            <p className="text-brand-muted text-xs">{student.full_name} ({student.roll_number || 'No roll'})</p>
          </div>
        </div>

        <form onSubmit={handleTransfer} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Current Division:</label>
            <input
              type="text"
              readOnly
              className="form-input text-xs bg-slate-950/60 text-slate-400 cursor-not-allowed"
              value={student.divisions?.name || 'Not assigned'}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Select New Division / Batch:</label>
            <select
              required
              className="form-input text-xs"
              value={targetDivision}
              onChange={e => setTargetDivision(e.target.value)}
            >
              {divisions.map(d => (
                <option key={d.id} value={d.id}>
                  {d.courses?.code ? `[${d.courses.code}] ` : ''}{d.name} Div {d.division_name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Transfer Reason (Audit Note):</label>
            <input
              type="text"
              className="form-input text-xs"
              placeholder="e.g. Batch change request, Year promotion, etc."
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={transferring}
              className="btn bg-indigo-600 hover:bg-indigo-500 text-white btn-sm flex items-center gap-1.5"
            >
              {transferring ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
              Confirm Transfer
            </button>
          </div>
        </form>
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

