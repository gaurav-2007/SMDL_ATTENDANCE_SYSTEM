import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Users, Search, UserCheck, UserX, Clock, Plus, X,
  ChevronDown, GraduationCap, Phone, BookOpen, Filter,
  RefreshCw, Eye, CheckCircle, XCircle, Upload, ArrowRightLeft,
  FileSpreadsheet, Loader2, Download, Mail, Calendar, ShieldAlert
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Badge, Button, Input, Select, Modal, StatCard, Skeleton, EmptyState
} from '../../components/ui'

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

  function renderStatusBadge(status) {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="present" dot>Active</Badge>
      case 'PENDING':
        return <Badge variant="grace" pulseDot>Pending</Badge>
      case 'REJECTED':
        return <Badge variant="absent">Rejected</Badge>
      case 'INACTIVE':
        return <Badge variant="neutral">Inactive</Badge>
      default:
        return <Badge variant="neutral">{status || 'Unknown'}</Badge>
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-ink tracking-tight">
            Student Roster & Cohort Management
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            Manage student enrollments, academic rosters, and division transfers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={fetchStudents}
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Enrolled"
          label="Total Enrolled"
          value={loading ? '—' : stats.total}
          subtitle="Registered students"
          sub="Registered students"
          icon={Users}
        />
        <StatCard
          title="Active Accounts"
          label="Active Accounts"
          value={loading ? '—' : stats.active}
          subtitle="Full access granted"
          sub="Full access granted"
          icon={UserCheck}
        />
        <StatCard
          title="Pending Verifications"
          label="Pending Verifications"
          value={loading ? '—' : stats.pending}
          subtitle="Requires approval"
          sub="Requires approval"
          icon={Clock}
        />
        <StatCard
          title="Rejected / Blocked"
          label="Rejected / Blocked"
          value={loading ? '—' : stats.rejected}
          subtitle="Denied accounts"
          sub="Denied accounts"
          icon={UserX}
        />
      </div>

      {/* Filters & Search */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex-1">
            <Input
              id="student-search"
              type="text"
              placeholder="Search by student name, roll number, email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              icon={Search}
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <select
              id="status-filter"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
            >
              <option value="ALL">All Account Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
              <option value="INACTIVE">Inactive</option>
            </select>

            <select
              id="course-filter"
              value={courseFilter}
              onChange={e => setCourseFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer max-w-[200px]"
            >
              <option value="ALL">All Courses</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Roster Container */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No students found"
            description={search ? `No student profiles match "${search}". Try refining your search query.` : 'No student accounts found in the selected cohort.'}
            action={
              search ? (
                <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                  Clear Search
                </Button>
              ) : null
            }
          />
        ) : (
          <div>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-line bg-bg/50 text-xs font-semibold text-muted uppercase tracking-wider">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Course Program</th>
                    <th className="py-3 px-4">Division</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map(s => {
                    const initial = (s.full_name || 'S').charAt(0).toUpperCase()
                    return (
                      <tr key={s.id} className="hover:bg-bg/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-brand/10 text-brand font-semibold text-xs flex items-center justify-center shrink-0">
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-ink leading-tight truncate">
                                {s.full_name}
                              </p>
                              <p className="text-xs text-muted truncate mt-0.5">{s.users?.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs font-semibold bg-bg border border-line text-ink px-2 py-0.5 rounded shadow-2xs">
                            {s.roll_number || '—'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <BookOpen size={14} className="text-brand shrink-0" />
                            <span className="text-xs font-medium text-ink truncate max-w-[200px]">
                              {s.courses?.name || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-xs font-medium text-ink bg-bg px-2 py-0.5 rounded border border-line">
                            {s.divisions?.name || '—'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {renderStatusBadge(s.users?.status)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              id={`view-student-${s.id}`}
                              variant="outline"
                              size="sm"
                              onClick={() => setSelected(s)}
                              className="gap-1 text-xs"
                            >
                              <Eye size={13} /> View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setTransferTargetStudent(s)}
                              className="gap-1 text-xs text-brand hover:bg-brand/10"
                              title="Transfer Division"
                            >
                              <ArrowRightLeft size={13} /> Transfer
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Responsive Cards */}
            <div className="lg:hidden divide-y divide-line">
              {filtered.map(s => {
                const initial = (s.full_name || 'S').charAt(0).toUpperCase()
                return (
                  <div key={s.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand/10 text-brand font-semibold text-sm flex items-center justify-center shrink-0">
                          {initial}
                        </div>
                        <div>
                          <p className="font-semibold text-ink text-sm">
                            {s.full_name}
                          </p>
                          <p className="text-xs text-muted truncate max-w-[190px]">{s.users?.email}</p>
                        </div>
                      </div>
                      <div>
                        {renderStatusBadge(s.users?.status)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-bg/50 p-2.5 rounded-lg border border-line">
                      <div>
                        <span className="text-muted block text-[11px]">Roll Number</span>
                        <span className="font-mono font-semibold text-ink">{s.roll_number || '—'}</span>
                      </div>
                      <div>
                        <span className="text-muted block text-[11px]">Division</span>
                        <span className="font-medium text-ink">{s.divisions?.name || '—'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted block text-[11px]">Course Program</span>
                        <span className="font-medium text-ink truncate block">{s.courses?.name || '—'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-line/60">
                      <Button
                        id={`view-student-mobile-${s.id}`}
                        variant="outline"
                        size="sm"
                        onClick={() => setSelected(s)}
                        className="flex-1 text-xs"
                      >
                        <Eye size={13} /> View Details
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTransferTargetStudent(s)}
                        className="flex-1 text-xs text-brand hover:bg-brand/10"
                      >
                        <ArrowRightLeft size={13} /> Transfer
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="p-3 bg-bg/40 border-t border-line text-right">
            <span className="text-xs text-muted">
              Displaying {filtered.length} of {students.length} students
            </span>
          </div>
        )}
      </Card>

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
  const initial = (s.full_name || 'S').charAt(0).toUpperCase()

  return (
    <Modal
      isOpen={Boolean(s)}
      onClose={onClose}
      title="Student Profile"
      description="Account verification and cohort status"
      maxWidth="max-w-md"
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3.5 p-3 rounded-xl bg-bg border border-line">
          <div className="w-12 h-12 rounded-xl bg-brand/10 text-brand flex items-center justify-center text-lg font-bold shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-ink text-base leading-tight truncate">{s.full_name}</h3>
            <p className="text-xs text-muted truncate mt-0.5">{s.users?.email}</p>
            <div className="mt-1.5">
              {s.users?.status === 'ACTIVE' && <Badge variant="present" dot>Active</Badge>}
              {s.users?.status === 'PENDING' && <Badge variant="grace" pulseDot>Pending</Badge>}
              {s.users?.status === 'REJECTED' && <Badge variant="absent">Rejected</Badge>}
              {s.users?.status === 'INACTIVE' && <Badge variant="neutral">Inactive</Badge>}
            </div>
          </div>
        </div>

        <div className="divide-y divide-line border border-line rounded-lg overflow-hidden text-xs">
          <DetailRow label="Roll Number" value={s.roll_number || '—'} mono />
          <DetailRow label="Course" value={s.courses?.name || '—'} />
          <DetailRow label="Division" value={s.divisions?.name || '—'} />
          <DetailRow label="Phone" value={s.phone || '—'} />
          <DetailRow
            label="Registration Date"
            value={s.users?.created_at ? new Date(s.users.created_at).toLocaleDateString('en-IN') : '—'}
          />
        </div>

        <div className="space-y-2 pt-2 border-t border-line">
          <Button
            onClick={() => onOpenTransfer(s)}
            variant="outline"
            className="w-full text-xs gap-1.5 text-brand border-brand/30 hover:bg-brand/10"
          >
            <ArrowRightLeft size={14} /> Transfer Division / Cohort
          </Button>

          <div className="flex gap-2">
            {s.users?.status !== 'ACTIVE' && (
              <Button
                id={`approve-student-${s.id}`}
                variant="primary"
                onClick={() => onUpdateStatus(s.id, 'ACTIVE')}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1 text-xs"
              >
                <CheckCircle size={14} />
                {loading ? 'Processing...' : 'Approve'}
              </Button>
            )}
            {s.users?.status !== 'REJECTED' && (
              <Button
                id={`reject-student-${s.id}`}
                variant="danger"
                onClick={() => onUpdateStatus(s.id, 'REJECTED')}
                disabled={loading}
                className="flex-1 gap-1 text-xs"
              >
                <XCircle size={14} />
                {loading ? 'Processing...' : 'Reject'}
              </Button>
            )}
            {s.users?.status !== 'INACTIVE' && (
              <Button
                id={`deactivate-student-${s.id}`}
                variant="ghost"
                onClick={() => onUpdateStatus(s.id, 'INACTIVE')}
                disabled={loading}
                className="text-xs text-muted hover:text-ink"
              >
                Deactivate
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
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
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Bulk Student Import (CSV)"
      description="Onboard entire division batches with roll numbers and login accounts"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink">Target Course:</label>
            <select
              className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
              value={selectedCourse}
              onChange={e => setSelectedCourse(e.target.value)}
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink">Target Division:</label>
            <select
              className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
              value={selectedDivision}
              onChange={e => setSelectedDivision(e.target.value)}
            >
              {courseDivisions.map(d => (
                <option key={d.id} value={d.id}>{d.name} Div {d.division_name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label className="font-semibold text-ink">CSV Data (Roll, Name, Email, Phone):</label>
            <div className="flex items-center gap-2">
              <label className="text-brand hover:underline cursor-pointer flex items-center gap-1 font-medium">
                <FileSpreadsheet size={13} /> Upload .CSV
                <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
              </label>
              <span className="text-muted">|</span>
              <button type="button" onClick={loadSampleCSV} className="text-muted hover:text-ink cursor-pointer">
                Load Sample
              </button>
            </div>
          </div>

          <textarea
            rows={5}
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            className="w-full font-mono text-xs p-3 rounded-lg border border-line bg-bg text-ink placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none resize-none"
            placeholder="Roll Number, Full Name, Email, Phone&#10;101, Aakash Sharma, aakash@student.smdl.ac.in, 9876543210&#10;102, Sneha Patil, sneha@student.smdl.ac.in, 9876543211"
          />
        </div>

        {parsedRows.length > 0 && (
          <div className="border border-line rounded-lg p-3 bg-bg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-ink">Parsed Preview ({parsedRows.length} students)</span>
              <Badge variant="present" size="sm">Valid Format</Badge>
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1 divide-y divide-line">
              {parsedRows.slice(0, 5).map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs pt-1 text-muted">
                  <span className="font-mono text-ink font-semibold">{r.roll_number} - {r.full_name}</span>
                  <span className="truncate max-w-[150px]">{r.email}</span>
                </div>
              ))}
              {parsedRows.length > 5 && (
                <p className="text-[11px] text-muted pt-1 text-center font-medium">... and {parsedRows.length - 5} more</p>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={importing || parsedRows.length === 0}
            className="gap-1.5"
          >
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Import {parsedRows.length} Students
          </Button>
        </div>
      </form>
    </Modal>
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
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Transfer Student Division"
      description={`${student.full_name} (${student.roll_number || 'No roll number'})`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleTransfer} className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink">Current Division:</label>
          <input
            type="text"
            readOnly
            className="w-full text-xs p-2.5 rounded-lg border border-line bg-bg text-muted cursor-not-allowed font-medium"
            value={student.divisions?.name || 'Not assigned'}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink">Select New Division / Batch:</label>
          <select
            required
            className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
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

        <div className="space-y-1">
          <label className="text-xs font-semibold text-ink">Transfer Reason (Audit Note):</label>
          <input
            type="text"
            className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none"
            placeholder="e.g. Batch change request, Year promotion, etc."
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={transferring}
            className="gap-1.5"
          >
            {transferring ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
            Confirm Transfer
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function DetailRow({ label, value, mono = false }) {
  return (
    <div className="flex justify-between items-center py-2.5 px-3 bg-surface">
      <span className="text-muted">{label}</span>
      <span className={`text-ink font-medium ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}
