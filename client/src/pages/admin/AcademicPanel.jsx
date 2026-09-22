import { useEffect, useState, useCallback } from 'react'
import {
  BookOpen, Plus, X, GraduationCap, Layers,
  RefreshCw, CheckCircle2, ChevronRight, Loader2
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'

export default function AcademicPanel() {
  const [tab, setTab] = useState('COURSES') // 'COURSES', 'DIVISIONS', 'SUBJECTS'
  const [courses, setCourses] = useState([])
  const [divisions, setDivisions] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)

  const [showCourseModal, setShowCourseModal] = useState(false)
  const [courseForm, setCourseForm] = useState({ name: '', code: '', duration_years: 3 })
  const [savingCourse, setSavingCourse] = useState(false)

  const [showDivisionModal, setShowDivisionModal] = useState(false)
  const [divisionForm, setDivisionForm] = useState({ course_id: '', name: '', division_name: '' })
  const [savingDivision, setSavingDivision] = useState(false)

  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', division_id: '' })
  const [savingSubject, setSavingSubject] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, dRes, sRes] = await Promise.all([
        api.get('/academic/courses'),
        api.get('/academic/divisions'),
        api.get('/academic/subjects'),
      ])
      setCourses(cRes.data.data?.courses || [])
      setDivisions(dRes.data.data?.divisions || [])
      setSubjects(sRes.data.data?.subjects || [])
    } catch {
      toast.error('Failed to load academic structure')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleCreateCourse(e) {
    e.preventDefault()
    if (!courseForm.name.trim() || !courseForm.code.trim()) {
      return toast.error('Course name and code are required')
    }
    setSavingCourse(true)
    try {
      await api.post('/academic/courses', courseForm)
      toast.success('Course created successfully!')
      setShowCourseModal(false)
      setCourseForm({ name: '', code: '', duration_years: 3 })
      fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create course')
    } finally {
      setSavingCourse(false)
    }
  }

  async function handleCreateDivision(e) {
    e.preventDefault()
    if (!divisionForm.course_id || !divisionForm.name.trim() || !divisionForm.division_name.trim()) {
      return toast.error('All division fields are required')
    }
    setSavingDivision(true)
    try {
      await api.post('/academic/divisions', divisionForm)
      toast.success('Division created successfully!')
      setShowDivisionModal(false)
      setDivisionForm({ course_id: '', name: '', division_name: '' })
      fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create division')
    } finally {
      setSavingDivision(false)
    }
  }

  async function handleCreateSubject(e) {
    e.preventDefault()
    if (!subjectForm.name.trim() || !subjectForm.code.trim() || !subjectForm.division_id) {
      return toast.error('All subject fields are required')
    }
    setSavingSubject(true)
    try {
      await api.post('/academic/subjects', subjectForm)
      toast.success('Subject created successfully!')
      setShowSubjectModal(false)
      setSubjectForm({ name: '', code: '', division_id: '' })
      fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create subject')
    } finally {
      setSavingSubject(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Academic Structure Management</h2>
          <p className="page-subtitle">Configure college degree courses, academic divisions, and curriculum subjects</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="btn btn-ghost btn-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {tab === 'COURSES' && (
            <button onClick={() => setShowCourseModal(true)} className="btn btn-primary flex items-center gap-1.5 text-xs">
              <Plus size={15} /> Add Course
            </button>
          )}
          {tab === 'DIVISIONS' && (
            <button onClick={() => setShowDivisionModal(true)} className="btn btn-primary flex items-center gap-1.5 text-xs">
              <Plus size={15} /> Add Division
            </button>
          )}
          {tab === 'SUBJECTS' && (
            <button onClick={() => setShowSubjectModal(true)} className="btn btn-primary flex items-center gap-1.5 text-xs">
              <Plus size={15} /> Add Subject
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 p-1 bg-white/5 border border-white/10 rounded-xl w-fit mb-6">
        <button
          onClick={() => setTab('COURSES')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            tab === 'COURSES' ? 'bg-brand-accent text-white shadow' : 'text-brand-muted hover:text-white'
          }`}
        >
          <GraduationCap size={15} /> Courses ({courses.length})
        </button>
        <button
          onClick={() => setTab('DIVISIONS')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            tab === 'DIVISIONS' ? 'bg-brand-accent text-white shadow' : 'text-brand-muted hover:text-white'
          }`}
        >
          <Layers size={15} /> Divisions ({divisions.length})
        </button>
        <button
          onClick={() => setTab('SUBJECTS')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            tab === 'SUBJECTS' ? 'bg-brand-accent text-white shadow' : 'text-brand-muted hover:text-white'
          }`}
        >
          <BookOpen size={15} /> Subjects ({subjects.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="animate-spin w-8 h-8 text-brand-accent" />
        </div>
      ) : (
        <>
          {/* TAB 1: COURSES */}
          {tab === 'COURSES' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.map(c => (
                <div key={c.id} className="card hover:border-brand-accent/40 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="badge badge-info text-xs font-mono">{c.code}</span>
                    <span className="text-brand-muted text-xs">{c.duration_years || 3} Years</span>
                  </div>
                  <h4 className="text-white font-bold text-lg mb-1">{c.name}</h4>
                  <p className="text-brand-muted text-xs mb-4">
                    {c.divisions?.length || 0} active academic divisions
                  </p>
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-brand-accent">
                    <span>Full Curriculum</span>
                    <ChevronRight size={15} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: DIVISIONS */}
          {tab === 'DIVISIONS' && (
            <div className="table-wrapper card !p-0">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Division Name</th>
                    <th>Year / Level</th>
                    <th>Section</th>
                    <th>Course</th>
                    <th className="text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {divisions.map((d, idx) => (
                    <tr key={d.id}>
                      <td className="text-brand-muted">{idx + 1}</td>
                      <td className="text-white font-medium">{d.name} - Div {d.division_name}</td>
                      <td><span className="badge badge-info text-xs">{d.name}</span></td>
                      <td className="font-mono text-brand-muted">Div {d.division_name}</td>
                      <td className="text-brand-text">{d.courses?.name || 'General'}</td>
                      <td className="text-right"><span className="badge badge-active text-[10px]">Active</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: SUBJECTS */}
          {tab === 'SUBJECTS' && (
            <div className="table-wrapper card !p-0">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Subject Name</th>
                    <th>Code</th>
                    <th>Division / Year</th>
                    <th className="text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s, idx) => (
                    <tr key={s.id}>
                      <td className="text-brand-muted">{idx + 1}</td>
                      <td className="text-white font-semibold">{s.name}</td>
                      <td className="font-mono text-brand-accent">{s.code}</td>
                      <td className="text-brand-text">
                        {s.divisions ? `${s.divisions.name} - Div ${s.divisions.division_name}` : 'All Divisions'}
                      </td>
                      <td className="text-right"><span className="badge badge-active text-[10px]">Active</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* CREATE COURSE MODAL */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-md relative">
            <button onClick={() => setShowCourseModal(false)} className="absolute top-4 right-4 btn-icon btn-ghost">
              <X size={16} />
            </button>
            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <GraduationCap size={18} className="text-brand-accent" /> Add Degree Course
            </h3>
            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div className="form-group">
                <label className="form-label">Course Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. B.Sc. Computer Science"
                  value={courseForm.name}
                  onChange={e => setCourseForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Course Code *</label>
                <input
                  type="text"
                  className="form-input font-mono"
                  placeholder="e.g. BSCCS"
                  value={courseForm.code}
                  onChange={e => setCourseForm(p => ({ ...p, code: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Duration (Years)</label>
                <input
                  type="number"
                  min="1"
                  max="6"
                  className="form-input"
                  value={courseForm.duration_years}
                  onChange={e => setCourseForm(p => ({ ...p, duration_years: e.target.value }))}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCourseModal(false)} className="btn btn-ghost flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={savingCourse} className="btn btn-primary flex-1">
                  {savingCourse ? 'Saving...' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE DIVISION MODAL */}
      {showDivisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-md relative">
            <button onClick={() => setShowDivisionModal(false)} className="absolute top-4 right-4 btn-icon btn-ghost">
              <X size={16} />
            </button>
            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <Layers size={18} className="text-brand-accent" /> Add Academic Division
            </h3>
            <form onSubmit={handleCreateDivision} className="space-y-4">
              <div className="form-group">
                <label className="form-label">Parent Course *</label>
                <select
                  className="form-input"
                  value={divisionForm.course_id}
                  onChange={e => setDivisionForm(p => ({ ...p, course_id: e.target.value }))}
                  required
                >
                  <option value="">-- Select Course --</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Class Year / Level *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. FY, SY, TY or Sem 1"
                  value={divisionForm.name}
                  onChange={e => setDivisionForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Division Name / Letter *</label>
                <input
                  type="text"
                  className="form-input font-mono"
                  placeholder="e.g. A, B, C"
                  value={divisionForm.division_name}
                  onChange={e => setDivisionForm(p => ({ ...p, division_name: e.target.value }))}
                  required
                  maxLength={5}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowDivisionModal(false)} className="btn btn-ghost flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={savingDivision} className="btn btn-primary flex-1">
                  {savingDivision ? 'Saving...' : 'Create Division'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE SUBJECT MODAL */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-md relative">
            <button onClick={() => setShowSubjectModal(false)} className="absolute top-4 right-4 btn-icon btn-ghost">
              <X size={16} />
            </button>
            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <BookOpen size={18} className="text-brand-accent" /> Add Subject
            </h3>
            <form onSubmit={handleCreateSubject} className="space-y-4">
              <div className="form-group">
                <label className="form-label">Subject Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Data Structures & Algorithms"
                  value={subjectForm.name}
                  onChange={e => setSubjectForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Subject Code *</label>
                <input
                  type="text"
                  className="form-input font-mono"
                  placeholder="e.g. CS102"
                  value={subjectForm.code}
                  onChange={e => setSubjectForm(p => ({ ...p, code: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Assigned Division *</label>
                <select
                  className="form-input"
                  value={subjectForm.division_id}
                  onChange={e => setSubjectForm(p => ({ ...p, division_id: e.target.value }))}
                  required
                >
                  <option value="">-- Select Division --</option>
                  {divisions.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} - Div {d.division_name} ({d.courses?.name || 'Course'})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowSubjectModal(false)} className="btn btn-ghost flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={savingSubject} className="btn btn-primary flex-1">
                  {savingSubject ? 'Saving...' : 'Create Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
