import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  BookOpen, Plus, X, GraduationCap, Layers,
  RefreshCw, CheckCircle2, ChevronRight, Loader2,
  Trash2, Search, Filter, Sparkles, BookMarked,
  ArrowRight, Hash, Check
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'

// Common degree presets with permanent course codes (fixed for all semesters)
const COURSE_PRESETS = [
  { name: 'B.Sc. Computer Science', code: 'BSC-CS', duration: 3, prefix: 'CS-' },
  { name: 'B.Sc. Information Technology', code: 'BSC-IT', duration: 3, prefix: 'IT-' },
  { name: 'Bachelor of Commerce', code: 'BCOM', duration: 3, prefix: 'COM-' },
  { name: 'Bachelor of Management Studies', code: 'BMS', duration: 3, prefix: 'BMS-' },
  { name: 'B.Com Accounting & Finance', code: 'BAF', duration: 3, prefix: 'BAF-' },
  { name: 'M.Sc. Computer Science', code: 'MSC-CS', duration: 2, prefix: 'MCS-' },
]

// Official SMDL College Timetable Subjects for F.Y.BSc Computer Science (NEP SEM-I)
// Formatted as Course Short Form (CS) + 2 numeric digits (01 to 14)
const OFFICIAL_CS_TIMETABLE_SUBJECTS = [
  { code: 'CS-01', tag: 'DSA', name: 'Data Structures & Algorithms (DSA)', faculty: 'Arati Sawant', type: 'Theory' },
  { code: 'CS-02', tag: 'DBS', name: 'Database Management Systems (DBS)', faculty: 'Pooja Chande', type: 'Theory' },
  { code: 'CS-03', tag: 'PYN', name: 'Python Programming (PYN)', faculty: 'Joshila Chanu Soraisam', type: 'Theory' },
  { code: 'CS-04', tag: 'LINUX', name: 'Linux Operating System (LINUX)', faculty: 'Pooja Sawant', type: 'Theory' },
  { code: 'CS-05', tag: 'IKS', name: 'Indian Knowledge Systems (IKS)', faculty: 'Girish Kumbhar', type: 'Theory' },
  { code: 'CS-06', tag: 'OE-1', name: 'Open Elective 1 (OE-1)', faculty: 'Nilam Sonawane', type: 'Elective' },
  { code: 'CS-07', tag: 'OE-2', name: 'Open Elective 2 (OE-2)', faculty: 'Sabina Shaikh', type: 'Elective' },
  { code: 'CS-08', tag: 'AEC', name: 'Ability Enhancement Course (AEC)', faculty: 'Maithili Sawant', type: 'Theory' },
  { code: 'CS-09', tag: 'EVS', name: 'Environmental Studies (EVS)', faculty: 'Girish Kumbhar', type: 'Theory' },
  { code: 'CS-10', tag: 'CC', name: 'Co-Curricular / Value Education (CC)', faculty: 'Girish Kumbhar', type: 'Activity' },
  { code: 'CS-11', tag: 'DSA(P)', name: 'Data Structures & Algorithms Lab (DSA-P)', faculty: 'Arati Sawant & Pooja Chande', type: 'Practical' },
  { code: 'CS-12', tag: 'DBS(P)', name: 'Database Management Systems Lab (DBS-P)', faculty: 'Arati Sawant & Pooja Chande', type: 'Practical' },
  { code: 'CS-13', tag: 'PYN(P)', name: 'Python Programming Lab (PYN-P)', faculty: 'Joshila Chanu Soraisam', type: 'Practical' },
  { code: 'CS-14', tag: 'LINUX(P)', name: 'Linux Operating System Lab (LINUX-P)', faculty: 'Pooja Sawant', type: 'Practical' },
]

function getCoursePrefix(course) {
  if (!course) return 'SUB-'
  const code = (course.code || '').toUpperCase()
  if (code === 'BSC-CS' || code === 'BSCCS') return 'CS-'
  if (code === 'BSC-IT' || code === 'BSCIT') return 'IT-'
  if (code === 'BCOM') return 'COM-'
  if (code === 'BMS') return 'BMS-'
  if (code === 'BAF') return 'BAF-'
  if (code === 'MSC-CS') return 'MCS-'
  if (code.includes('-')) return code.split('-').pop() + '-'
  return code + '-'
}

export default function AcademicPanel() {
  const [tab, setTab] = useState('COURSES') // 'COURSES', 'DIVISIONS', 'SUBJECTS'
  const [courses, setCourses] = useState([])
  const [divisions, setDivisions] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)

  // Modals state
  const [showCourseModal, setShowCourseModal] = useState(false)
  const [courseForm, setCourseForm] = useState({ name: '', code: '', duration_years: 3 })
  const [savingCourse, setSavingCourse] = useState(false)

  const [showDivisionModal, setShowDivisionModal] = useState(false)
  const [divisionForm, setDivisionForm] = useState({ course_id: '', name: 'FY', division_name: 'A' })
  const [savingDivision, setSavingDivision] = useState(false)

  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [subjectForm, setSubjectForm] = useState({ course_id: '', division_id: '', name: '', code: '' })
  const [savingSubject, setSavingSubject] = useState(false)

  // Course Details / Curriculum Drawer Modal
  const [selectedCourseForCurriculum, setSelectedCourseForCurriculum] = useState(null)
  const [quickSubjectForm, setQuickSubjectForm] = useState({ division_id: '', name: '', code: '' })
  const [savingQuickSubject, setSavingQuickSubject] = useState(false)

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('ALL')

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

  // Count subjects per course
  const subjectCountByCourse = useMemo(() => {
    const counts = {}
    subjects.forEach(s => {
      const courseId = s.divisions?.course_id
      if (courseId) {
        counts[courseId] = (counts[courseId] || 0) + 1
      }
    })
    return counts
  }, [subjects])

  // Count subjects per division
  const subjectCountByDivision = useMemo(() => {
    const counts = {}
    subjects.forEach(s => {
      if (s.division_id) {
        counts[s.division_id] = (counts[s.division_id] || 0) + 1
      }
    })
    return counts
  }, [subjects])

  // Filtered Divisions for Add Subject Form
  const divisionsForSelectedCourse = useMemo(() => {
    if (!subjectForm.course_id) return divisions
    return divisions.filter(d => d.course_id === subjectForm.course_id)
  }, [divisions, subjectForm.course_id])

  // Existing subject codes in selected course
  const existingCodesInSelectedCourse = useMemo(() => {
    if (!subjectForm.course_id) return new Set()
    return new Set(
      subjects
        .filter(s => s.divisions?.course_id === subjectForm.course_id)
        .map(s => s.code.toUpperCase())
    )
  }, [subjects, subjectForm.course_id])

  // Next available code helper
  const nextAvailableCode = useMemo(() => {
    const course = courses.find(c => c.id === subjectForm.course_id)
    if (!course) return ''
    const prefix = getCoursePrefix(course)
    for (let i = 1; i <= 99; i++) {
      const numStr = String(i).padStart(2, '0')
      const candidate = `${prefix}${numStr}`
      if (!existingCodesInSelectedCourse.has(candidate)) {
        return candidate
      }
    }
    return `${prefix}01`
  }, [courses, subjectForm.course_id, existingCodesInSelectedCourse])

  // Filtered list of subjects based on search & course filter
  const filteredSubjects = useMemo(() => {
    return subjects.filter(s => {
      const matchesCourse = selectedCourseFilter === 'ALL' || s.divisions?.course_id === selectedCourseFilter
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.divisions?.name?.toLowerCase().includes(q)
      return matchesCourse && matchesSearch
    })
  }, [subjects, selectedCourseFilter, searchQuery])

  // Filtered divisions based on search & course filter
  const filteredDivisions = useMemo(() => {
    return divisions.filter(d => {
      const matchesCourse = selectedCourseFilter === 'ALL' || d.course_id === selectedCourseFilter
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch = !q || d.name.toLowerCase().includes(q) || d.division_name.toLowerCase().includes(q) || d.courses?.name?.toLowerCase().includes(q)
      return matchesCourse && matchesSearch
    })
  }, [divisions, selectedCourseFilter, searchQuery])

  // Handlers
  async function handleCreateCourse(e) {
    e.preventDefault()
    if (!courseForm.name.trim() || !courseForm.code.trim()) {
      return toast.error('Course name and permanent code are required')
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

  async function handleDeleteCourse(courseId, courseName) {
    if (!confirm(`Are you sure you want to delete "${courseName}"? This will also delete all associated divisions and subjects!`)) {
      return
    }
    try {
      await api.delete(`/academic/courses/${courseId}`)
      toast.success('Course deleted')
      fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete course')
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
      setDivisionForm({ course_id: '', name: 'FY', division_name: 'A' })
      fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create division')
    } finally {
      setSavingDivision(false)
    }
  }

  async function handleDeleteDivision(divId, divName) {
    if (!confirm(`Delete division "${divName}"? This may affect associated subjects.`)) return
    try {
      await api.delete(`/academic/divisions/${divId}`)
      toast.success('Division deleted')
      fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete division')
    }
  }

  async function handleCreateSubject(e) {
    e.preventDefault()
    if (!subjectForm.name.trim() || !subjectForm.code.trim()) {
      return toast.error('Subject name and code are required')
    }

    setSavingSubject(true)
    try {
      if (subjectForm.division_id === 'ALL_IN_COURSE' && subjectForm.course_id) {
        const targetDivs = divisions.filter(d => d.course_id === subjectForm.course_id).map(d => d.id)
        if (targetDivs.length === 0) {
          toast.error('No divisions found for this course to assign subject to')
          setSavingSubject(false)
          return
        }
        await api.post('/academic/subjects/batch', {
          division_ids: targetDivs,
          subjects: [{ name: subjectForm.name, code: subjectForm.code }]
        })
        toast.success(`Subject assigned to ${targetDivs.length} divisions!`)
      } else {
        if (!subjectForm.division_id) {
          toast.error('Please select an assigned division')
          setSavingSubject(false)
          return
        }
        await api.post('/academic/subjects', {
          name: subjectForm.name,
          code: subjectForm.code,
          division_id: subjectForm.division_id
        })
        toast.success('Subject created successfully!')
      }

      setShowSubjectModal(false)
      setSubjectForm({ course_id: '', division_id: '', name: '', code: '' })
      fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create subject')
    } finally {
      setSavingSubject(false)
    }
  }

  async function handleQuickAddSubjectToCourse(e) {
    e.preventDefault()
    if (!selectedCourseForCurriculum) return
    if (!quickSubjectForm.name.trim() || !quickSubjectForm.code.trim()) {
      return toast.error('Subject name and code are required')
    }

    setSavingQuickSubject(true)
    try {
      const courseDivisions = divisions.filter(d => d.course_id === selectedCourseForCurriculum.id)
      if (courseDivisions.length === 0) {
        toast.error('This course has no divisions yet! Please create a division first.')
        setSavingQuickSubject(false)
        return
      }

      const divId = quickSubjectForm.division_id || courseDivisions[0].id
      await api.post('/academic/subjects', {
        name: quickSubjectForm.name,
        code: quickSubjectForm.code,
        division_id: divId
      })
      toast.success('Subject added to curriculum!')
      setQuickSubjectForm({ division_id: '', name: '', code: '' })
      fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add subject')
    } finally {
      setSavingQuickSubject(false)
    }
  }

  async function handleDeleteSubject(subId, subName) {
    if (!confirm(`Delete subject "${subName}"?`)) return
    try {
      await api.delete(`/academic/subjects/${subId}`)
      toast.success('Subject deleted')
      fetchData()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete subject')
    }
  }

  // Pre-fill course form from preset
  const applyPreset = (preset) => {
    setCourseForm({
      name: preset.name,
      code: preset.code,
      duration_years: preset.duration
    })
  }

  return (
    <div className="animate-fade-in pb-12">
      {/* Page Header */}
      <div className="page-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="page-title flex items-center gap-2.5">
            <GraduationCap className="text-brand-accent" size={26} />
            Academic Structure Management
          </h2>
          <p className="page-subtitle">Configure college degree courses, academic divisions, and curriculum subjects for attendance</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={fetchData} className="btn btn-ghost btn-sm" title="Refresh data">
            <RefreshCw size={15} className={loading ? 'animate-spin text-brand-accent' : ''} />
          </button>
          <button
            onClick={() => {
              setCourseForm({ name: '', code: '', duration_years: 3 })
              setShowCourseModal(true)
            }}
            className="btn btn-primary flex items-center gap-2 text-xs shadow-lg shadow-primary-900/30"
          >
            <Plus size={15} /> Add Course
          </button>
          <button
            onClick={() => {
              setDivisionForm({ course_id: courses[0]?.id || '', name: 'FY', division_name: 'A' })
              setShowDivisionModal(true)
            }}
            className="btn btn-secondary flex items-center gap-2 text-xs"
          >
            <Plus size={15} /> Add Division
          </button>
          <button
            onClick={() => {
              const defaultCourse = courses[0]
              const matchedDivs = divisions.filter(d => d.course_id === defaultCourse?.id)
              setSubjectForm({
                course_id: defaultCourse?.id || '',
                division_id: matchedDivs[0]?.id || '',
                name: '',
                code: ''
              })
              setShowSubjectModal(true)
            }}
            className="btn bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/50 flex items-center gap-2 text-xs"
          >
            <Plus size={15} /> Add Subject
          </button>
        </div>
      </div>

      {/* Navigation Tabs & Quick Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl w-fit">
          <button
            onClick={() => setTab('COURSES')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              tab === 'COURSES' ? 'bg-gradient-brand text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <GraduationCap size={15} /> Courses ({courses.length})
          </button>
          <button
            onClick={() => setTab('DIVISIONS')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              tab === 'DIVISIONS' ? 'bg-gradient-brand text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers size={15} /> Divisions ({divisions.length})
          </button>
          <button
            onClick={() => setTab('SUBJECTS')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              tab === 'SUBJECTS' ? 'bg-gradient-brand text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen size={15} /> Subjects ({subjects.length})
          </button>
        </div>

        {/* Filter & Search Bar for non-course tabs */}
        {tab !== 'COURSES' && (
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="form-input !py-1.5 !pl-9 text-xs w-44 md:w-56"
              />
            </div>
            <select
              value={selectedCourseFilter}
              onChange={e => setSelectedCourseFilter(e.target.value)}
              className="form-input !py-1.5 text-xs w-44"
            >
              <option value="ALL">All Courses</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="animate-spin w-8 h-8 text-brand-accent" />
          <p className="text-slate-400 text-xs">Loading academic structure...</p>
        </div>
      ) : (
        <>
          {/* ═══════════ TAB 1: COURSES ═══════════ */}
          {tab === 'COURSES' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {courses.map(c => {
                const courseDivs = divisions.filter(d => d.course_id === c.id)
                const subjectCount = subjectCountByCourse[c.id] || 0
                return (
                  <div
                    key={c.id}
                    className="card group hover:border-brand-accent/60 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/80 transition-all duration-200 hover:shadow-xl hover:shadow-primary-950/40 relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="badge badge-info text-xs font-mono font-bold tracking-wider px-2.5 py-1">
                          {c.code}
                        </span>
                        <span className="block text-[10px] text-sky-400 font-mono mt-1 font-semibold">
                          Permanent Course Code
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs font-medium">
                          {c.duration_years || 3} Years ({(c.duration_years || 3) * 2} Semesters)
                        </span>
                        <button
                          onClick={() => handleDeleteCourse(c.id, c.name)}
                          className="text-slate-500 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition-colors"
                          title="Delete course"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <h4 className="text-white font-bold text-lg mb-2 group-hover:text-brand-accent transition-colors">
                      {c.name}
                    </h4>

                    {/* Meta stats badges */}
                    <div className="flex items-center gap-3 text-xs text-slate-400 mb-5">
                      <span className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/50">
                        <Layers size={13} className="text-sky-400" />
                        <strong className="text-white font-semibold">{courseDivs.length}</strong> Divisions
                      </span>
                      <span className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/50">
                        <BookOpen size={13} className="text-emerald-400" />
                        <strong className="text-white font-semibold">{subjectCount}</strong> Subjects
                      </span>
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-3.5 border-t border-slate-800 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedCourseForCurriculum(c)}
                        className="btn btn-ghost !px-2.5 !py-1 text-xs text-brand-accent hover:text-white flex items-center gap-1.5"
                      >
                        <BookMarked size={14} /> View & Add Subjects <ChevronRight size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setSubjectForm({
                            course_id: c.id,
                            division_id: courseDivs[0]?.id || '',
                            name: '',
                            code: ''
                          })
                          setShowSubjectModal(true)
                        }}
                        className="btn btn-ghost !px-2.5 !py-1 text-xs text-slate-300 hover:text-emerald-400 flex items-center gap-1"
                        title="Add subject directly to this course"
                      >
                        <Plus size={13} /> Quick Add
                      </button>
                    </div>
                  </div>
                )
              })}

              {courses.length === 0 && (
                <div className="col-span-full text-center py-16 card border-dashed border-slate-700">
                  <GraduationCap size={44} className="mx-auto text-slate-500 mb-3" />
                  <p className="text-white font-semibold">No courses added yet</p>
                  <p className="text-slate-400 text-xs mt-1 mb-4">Add your college degree courses to get started</p>
                  <button onClick={() => setShowCourseModal(true)} className="btn btn-primary text-xs mx-auto">
                    <Plus size={14} /> Add First Course
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ═══════════ TAB 2: DIVISIONS ═══════════ */}
          {tab === 'DIVISIONS' && (
            <div className="card !p-0 overflow-hidden border border-slate-800">
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="w-12">#</th>
                      <th>Class & Division</th>
                      <th>Year / Level</th>
                      <th>Section</th>
                      <th>Associated Course</th>
                      <th>Subjects</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDivisions.map((d, idx) => (
                      <tr key={d.id} className="hover:bg-slate-800/40">
                        <td className="text-slate-500 text-xs font-mono">{idx + 1}</td>
                        <td className="text-white font-medium">
                          {d.courses?.name ? `${d.courses.code} - ` : ''}{d.name} Div {d.division_name}
                        </td>
                        <td>
                          <span className="badge badge-info text-xs">{d.name}</span>
                        </td>
                        <td>
                          <span className="font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded text-xs">
                            Div {d.division_name}
                          </span>
                        </td>
                        <td className="text-slate-300">{d.courses?.name || 'General'}</td>
                        <td>
                          <span className="badge bg-emerald-500/10 text-emerald-400 text-xs">
                            {subjectCountByDivision[d.id] || 0} subjects
                          </span>
                        </td>
                        <td className="text-right">
                          <button
                            onClick={() => handleDeleteDivision(d.id, `${d.name} Div ${d.division_name}`)}
                            className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors inline-flex items-center"
                            title="Delete division"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredDivisions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400 text-xs">
                          No divisions found matching criteria
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══════════ TAB 3: SUBJECTS ═══════════ */}
          {tab === 'SUBJECTS' && (
            <div className="card !p-0 overflow-hidden border border-slate-800">
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="w-12">#</th>
                      <th>Subject Code</th>
                      <th>Subject Name</th>
                      <th>Course</th>
                      <th>Assigned Division</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubjects.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-slate-800/40">
                        <td className="text-slate-500 text-xs font-mono">{idx + 1}</td>
                        <td>
                          <span className="font-mono text-brand-accent bg-sky-950/60 border border-sky-800/40 px-2.5 py-0.5 rounded text-xs font-bold">
                            {s.code}
                          </span>
                        </td>
                        <td className="text-white font-semibold">
                          {s.name}
                        </td>
                        <td className="text-slate-300 text-xs">
                          {s.divisions?.courses?.name || 'General Degree'}
                        </td>
                        <td className="text-slate-300 text-xs">
                          {s.divisions ? (
                            <span className="badge badge-info text-[11px]">
                              {s.divisions.name} - Div {s.divisions.division_name}
                            </span>
                          ) : (
                            <span className="text-slate-500">All Divisions</span>
                          )}
                        </td>
                        <td className="text-right">
                          <button
                            onClick={() => handleDeleteSubject(s.id, s.name)}
                            className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors inline-flex items-center"
                            title="Delete subject"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredSubjects.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-400 text-xs">
                          No curriculum subjects found matching criteria
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 1: ADD COURSE (Polished UI with fixed width & duration)
      ══════════════════════════════════════════════════════════════════ */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="card w-full max-w-lg relative bg-slate-900/95 border border-slate-700/80 shadow-2xl rounded-2xl overflow-hidden p-6 sm:p-7">
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-brand" />

            {/* Close button */}
            <button
              onClick={() => setShowCourseModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-gradient-brand flex items-center justify-center text-white shadow-lg shadow-sky-900/30">
                <GraduationCap size={22} />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Add Degree Course</h3>
                <p className="text-slate-400 text-xs">Configure a permanent degree program for SMDL College</p>
              </div>
            </div>

            {/* Quick 1-Click Presets */}
            <div className="mb-5 p-3 rounded-xl bg-slate-800/70 border border-slate-700/50">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
                <Sparkles size={12} className="text-brand-accent" /> Quick Fill Presets:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {COURSE_PRESETS.map(p => (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all ${
                      courseForm.code === p.code
                        ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-bold shadow-sm'
                        : 'bg-slate-700/60 hover:bg-brand-accent/20 hover:border-brand-accent/40 text-slate-300 hover:text-white border-slate-600/40'
                    }`}
                  >
                    {p.code}
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div className="form-group">
                <label className="form-label">Full Course Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. B.Sc. Computer Science"
                  value={courseForm.name}
                  onChange={e => setCourseForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label flex items-center justify-between">
                    <span>Permanent Code *</span>
                    <span className="text-[10px] text-sky-400 normal-case font-medium">Fixed for all sems</span>
                  </label>
                  <input
                    type="text"
                    className="form-input font-mono uppercase tracking-wider font-bold"
                    placeholder="e.g. BSC-CS"
                    value={courseForm.code}
                    onChange={e => setCourseForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Degree code (jaise <span className="text-white font-mono font-bold">BSC-CS</span>) jo sabhi semesters ke liye fix rahega.
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">Duration (Years)</label>
                  <select
                    className="form-input"
                    value={courseForm.duration_years}
                    onChange={e => setCourseForm(p => ({ ...p, duration_years: Number(e.target.value) }))}
                  >
                    <option value="1">1 Year (2 Semesters)</option>
                    <option value="2">2 Years (4 Semesters)</option>
                    <option value="3">3 Years (6 Semesters)</option>
                    <option value="4">4 Years (8 Semesters)</option>
                    <option value="5">5 Years (10 Semesters)</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">Total degree duration</p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="btn btn-secondary flex-1 py-2.5 text-xs text-slate-300 border border-slate-700 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCourse}
                  className="btn btn-primary flex-1 py-2.5 text-xs font-semibold bg-gradient-brand shadow-lg hover:shadow-sky-500/25"
                >
                  {savingCourse ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={14} className="animate-spin" /> Saving...
                    </span>
                  ) : (
                    'Create Course'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 2: ADD DIVISION
      ══════════════════════════════════════════════════════════════════ */}
      {showDivisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="card w-full max-w-lg relative bg-slate-900/95 border border-slate-700/80 shadow-2xl rounded-2xl overflow-hidden p-6 sm:p-7">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-brand" />

            <button
              onClick={() => setShowDivisionModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-gradient-brand flex items-center justify-center text-white shadow-lg shadow-sky-900/30">
                <Layers size={22} />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Add Academic Division</h3>
                <p className="text-slate-400 text-xs">Create class sections (e.g., FY Div A) for lectures and attendance</p>
              </div>
            </div>

            <form onSubmit={handleCreateDivision} className="space-y-4">
              <div className="form-group">
                <label className="form-label">Parent Degree Course *</label>
                <select
                  className="form-input"
                  value={divisionForm.course_id}
                  onChange={e => setDivisionForm(p => ({ ...p, course_id: e.target.value }))}
                  required
                >
                  <option value="">-- Select Degree Course --</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Year / Academic Level *</label>
                  <input
                    type="text"
                    className="form-input font-bold"
                    placeholder="e.g. FY, SY, TY, Sem 1"
                    value={divisionForm.name}
                    onChange={e => setDivisionForm(p => ({ ...p, name: e.target.value.toUpperCase() }))}
                    required
                  />
                  <div className="flex gap-1.5 mt-2">
                    {['FY', 'SY', 'TY'].map(lvl => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setDivisionForm(p => ({ ...p, name: lvl }))}
                        className={`text-[10px] px-2 py-0.5 rounded font-mono border transition-all ${
                          divisionForm.name === lvl
                            ? 'bg-brand-accent/20 border-brand-accent text-brand-accent font-bold'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Division Section *</label>
                  <input
                    type="text"
                    className="form-input font-mono uppercase font-bold"
                    placeholder="e.g. A, B, C"
                    maxLength={4}
                    value={divisionForm.division_name}
                    onChange={e => setDivisionForm(p => ({ ...p, division_name: e.target.value.toUpperCase() }))}
                    required
                  />
                  <div className="flex gap-1.5 mt-2">
                    {['A', 'B', 'C', 'D'].map(sec => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setDivisionForm(p => ({ ...p, division_name: sec }))}
                        className={`text-[10px] px-2 py-0.5 rounded font-mono border transition-all ${
                          divisionForm.division_name === sec
                            ? 'bg-brand-accent/20 border-brand-accent text-brand-accent font-bold'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        Div {sec}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Preview Card */}
              {divisionForm.name && divisionForm.division_name && (
                <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Resulting Division:</span>
                  <span className="text-brand-accent font-bold">
                    {courses.find(c => c.id === divisionForm.course_id)?.code || 'Course'} · {divisionForm.name} - Division {divisionForm.division_name}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDivisionModal(false)}
                  className="btn btn-secondary flex-1 py-2.5 text-xs text-slate-300 border border-slate-700 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDivision}
                  className="btn btn-primary flex-1 py-2.5 text-xs font-semibold bg-gradient-brand"
                >
                  {savingDivision ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={14} className="animate-spin" /> Saving...
                    </span>
                  ) : (
                    'Create Division'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 3: ADD SUBJECT (With Course Short Form + 1-2 Digits Builder)
      ══════════════════════════════════════════════════════════════════ */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="card w-full max-w-xl relative bg-slate-900/95 border border-slate-700/80 shadow-2xl rounded-2xl max-h-[92vh] overflow-y-auto p-6 sm:p-7">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-brand" />

            <button
              onClick={() => setShowSubjectModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-gradient-brand flex items-center justify-center text-white shadow-lg shadow-sky-900/30">
                <BookOpen size={22} />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Add Curriculum Subject</h3>
                <p className="text-slate-400 text-xs">Subject Code format: [Course Short Form] + [1 to 2 Digits] (e.g. CS-01, CS-02)</p>
              </div>
            </div>

            <form onSubmit={handleCreateSubject} className="space-y-4">
              {/* Select Course First */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Degree Course *</label>
                  <select
                    className="form-input"
                    value={subjectForm.course_id}
                    onChange={e => {
                      const cid = e.target.value
                      const matchedDivs = divisions.filter(d => d.course_id === cid)
                      setSubjectForm(p => ({
                        ...p,
                        course_id: cid,
                        division_id: matchedDivs[0]?.id || ''
                      }))
                    }}
                    required
                  >
                    <option value="">-- Select Course --</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Select Target Division */}
                <div className="form-group">
                  <label className="form-label">Assigned Division / Scope *</label>
                  <select
                    className="form-input"
                    value={subjectForm.division_id}
                    onChange={e => setSubjectForm(p => ({ ...p, division_id: e.target.value }))}
                    required
                  >
                    <option value="">-- Select Division --</option>
                    {subjectForm.course_id && (
                      <option value="ALL_IN_COURSE" className="font-bold text-brand-accent">
                        ✨ Apply to ALL Divisions in Course
                      </option>
                    )}
                    {divisionsForSelectedCourse.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} - Division {d.division_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SMDL Official Timetable Quick Fill for B.Sc. CS */}
              {courses.find(c => c.id === subjectForm.course_id)?.code === 'BSC-CS' && (
                <div className="p-3.5 bg-slate-800/80 rounded-xl border border-sky-800/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={13} /> Official Timetable Subjects (1-Click Fill):
                    </span>
                    <span className="text-[10px] text-slate-400">NEP Sem-1</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                    {OFFICIAL_CS_TIMETABLE_SUBJECTS.map(ts => (
                      <button
                        key={ts.code}
                        type="button"
                        onClick={() => setSubjectForm(p => ({ ...p, name: ts.name, code: ts.code }))}
                        className={`text-[11px] p-2 rounded-lg border text-left transition-all ${
                          subjectForm.code === ts.code
                            ? 'bg-sky-500/25 border-sky-400 text-sky-200 font-bold shadow-sm'
                            : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono">
                          <span className="font-bold text-brand-accent">{ts.code}</span>
                          <span className="text-[9px] px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded">
                            {ts.tag}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-300 truncate mt-0.5">{ts.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Subject Code Builder (Course Short Form + 1-2 Digits Number) */}
              <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                    <Hash size={12} className="text-brand-accent" /> Subject Code Options Builder:
                  </label>
                  {nextAvailableCode && (
                    <button
                      type="button"
                      onClick={() => setSubjectForm(p => ({ ...p, code: nextAvailableCode }))}
                      className="text-[10px] px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-700 hover:bg-sky-900 transition-colors font-mono"
                    >
                      ⚡ Next Free: {nextAvailableCode}
                    </button>
                  )}
                </div>

                {/* Number selector pills (01 to 20) */}
                <div className="mb-3">
                  <p className="text-[10px] text-slate-400 mb-1.5">
                    Course prefix: <span className="font-mono text-brand-accent font-bold">{getCoursePrefix(courses.find(c => c.id === subjectForm.course_id))}</span> + pick numeric number (01–20):
                  </p>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                    {Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(2, '0')).map(num => {
                      const prefix = getCoursePrefix(courses.find(c => c.id === subjectForm.course_id))
                      const targetCode = `${prefix}${num}`
                      const isUsed = existingCodesInSelectedCourse.has(targetCode)
                      const isSelected = subjectForm.code === targetCode
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setSubjectForm(p => ({ ...p, code: targetCode }))}
                          className={`text-[11px] font-mono px-2 py-0.5 rounded transition-all border ${
                            isSelected
                              ? 'bg-sky-500/30 border-sky-400 text-sky-200 font-bold'
                              : isUsed
                              ? 'bg-slate-900/60 border-slate-800 text-slate-500 hover:border-slate-700'
                              : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:border-sky-500 hover:text-white'
                          }`}
                          title={isUsed ? `${targetCode} (already used)` : `${targetCode} (available)`}
                        >
                          {num} {isUsed && <span className="text-[8px] text-slate-500">●</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Final Subject Code *
                    </label>
                    <input
                      type="text"
                      className="form-input font-mono uppercase tracking-wider font-bold"
                      placeholder="e.g. CS-01"
                      value={subjectForm.code}
                      onChange={e => setSubjectForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Code Status Preview
                    </label>
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-between text-xs font-mono h-[42px]">
                      <span className="text-brand-accent font-bold">{subjectForm.code || 'None'}</span>
                      {subjectForm.code && (
                        <span className={`text-[10px] px-2 py-0.5 rounded ${
                          existingCodesInSelectedCourse.has(subjectForm.code)
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {existingCodesInSelectedCourse.has(subjectForm.code) ? 'Already in use' : 'Available'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Subject Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Data Structures & Algorithms (DSA)"
                  value={subjectForm.name}
                  onChange={e => setSubjectForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSubjectModal(false)}
                  className="btn btn-secondary flex-1 py-2.5 text-xs text-slate-300 border border-slate-700 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSubject}
                  className="btn btn-primary flex-1 py-2.5 text-xs font-semibold bg-gradient-brand shadow-lg hover:shadow-sky-500/25"
                >
                  {savingSubject ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={14} className="animate-spin" /> Saving...
                    </span>
                  ) : (
                    'Add Subject'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 4: COURSE CURRICULUM & SUBJECT MANAGEMENT DRAWER
      ══════════════════════════════════════════════════════════════════ */}
      {selectedCourseForCurriculum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="card w-full max-w-3xl relative bg-slate-900 border border-slate-700/80 shadow-2xl rounded-2xl max-h-[90vh] flex flex-col p-6 sm:p-7 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-brand" />

            <button
              onClick={() => setSelectedCourseForCurriculum(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="flex items-start gap-3.5 mb-4 pb-4 border-b border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-gradient-brand flex items-center justify-center text-white shadow-lg shadow-primary-900/30 flex-shrink-0">
                <BookMarked size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="badge badge-info text-xs font-mono font-bold tracking-wider">{selectedCourseForCurriculum.code}</span>
                  <span className="text-slate-400 text-xs font-medium">{selectedCourseForCurriculum.duration_years || 3} Years · {(selectedCourseForCurriculum.duration_years || 3) * 2} Semesters</span>
                </div>
                <h3 className="text-white font-bold text-xl mt-1">{selectedCourseForCurriculum.name}</h3>
                <p className="text-slate-400 text-xs">Curriculum subjects & division mapping for lecture scheduling & attendance</p>
              </div>
            </div>

            {/* Permanent Code Info Strip */}
            <div className="p-3 bg-sky-950/40 border border-sky-800/40 rounded-xl mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Fixed Course Code:</span>
                <span className="font-mono text-brand-accent font-bold text-sm bg-sky-900/50 px-2 py-0.5 rounded border border-sky-700/50">
                  {selectedCourseForCurriculum.code}
                </span>
                <span className="text-slate-400 text-[11px] hidden sm:inline">
                  (Permanent for all semesters: Sem 1 to Sem {(selectedCourseForCurriculum.duration_years || 3) * 2})
                </span>
              </div>
              <span className="badge bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold">
                Permanent Degree Code
              </span>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              {/* Quick Add Subject Box inside this Course */}
              <div className="p-4 rounded-xl bg-slate-800/70 border border-slate-700/60">
                <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 text-brand-accent">
                  <Plus size={14} /> Add New Subject to {selectedCourseForCurriculum.code}
                </h4>

                {/* SMDL Timetable Presets for B.Sc. CS */}
                {selectedCourseForCurriculum.code === 'BSC-CS' && (
                  <div className="p-2.5 bg-slate-900/80 rounded-lg border border-sky-800/40 mb-3">
                    <p className="text-[11px] font-bold text-sky-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Sparkles size={12} /> Official Timetable Subjects (Click to Load):
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                      {OFFICIAL_CS_TIMETABLE_SUBJECTS.map(ts => (
                        <button
                          key={ts.code}
                          type="button"
                          onClick={() => setQuickSubjectForm(p => ({ ...p, name: ts.name, code: ts.code }))}
                          className={`text-[10px] px-2 py-0.5 rounded border font-mono transition-all ${
                            quickSubjectForm.code === ts.code
                              ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-bold'
                              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
                          }`}
                          title={`${ts.name} (${ts.faculty})`}
                        >
                          {ts.code} ({ts.tag})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <form onSubmit={handleQuickAddSubjectToCourse} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-4">
                    <label className="form-label text-[11px]">Assigned Division *</label>
                    <select
                      className="form-input !py-1.5 text-xs"
                      value={quickSubjectForm.division_id}
                      onChange={e => setQuickSubjectForm(p => ({ ...p, division_id: e.target.value }))}
                      required
                    >
                      <option value="">Select Division</option>
                      {divisions
                        .filter(d => d.course_id === selectedCourseForCurriculum.id)
                        .map(d => (
                          <option key={d.id} value={d.id}>
                            {d.name} - Div {d.division_name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="sm:col-span-4">
                    <label className="form-label text-[11px]">Subject Name *</label>
                    <input
                      type="text"
                      className="form-input !py-1.5 text-xs"
                      placeholder="e.g. Applied Mathematics"
                      value={quickSubjectForm.name}
                      onChange={e => setQuickSubjectForm(p => ({ ...p, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="form-label text-[11px]">Code (e.g. CS-15) *</label>
                    <input
                      type="text"
                      className="form-input !py-1.5 text-xs font-mono uppercase"
                      placeholder="e.g. CS-15"
                      value={quickSubjectForm.code}
                      onChange={e => setQuickSubjectForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={savingQuickSubject}
                      className="btn btn-primary w-full !py-2 text-xs font-semibold"
                    >
                      {savingQuickSubject ? <Loader2 size={13} className="animate-spin" /> : 'Save'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Subject Breakdown by Division */}
              <div>
                <h4 className="text-white text-sm font-semibold mb-3 flex items-center justify-between">
                  <span>Course Curriculum Subjects</span>
                  <span className="text-xs text-slate-400 font-normal">
                    Total: {subjects.filter(s => s.divisions?.course_id === selectedCourseForCurriculum.id).length} Subjects
                  </span>
                </h4>

                <div className="space-y-4">
                  {divisions
                    .filter(d => d.course_id === selectedCourseForCurriculum.id)
                    .map(div => {
                      const divSubjects = subjects.filter(s => s.division_id === div.id)
                      return (
                        <div key={div.id} className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800">
                          <div className="flex items-center justify-between mb-2.5">
                            <span className="badge badge-info text-xs">
                              {div.name} - Division {div.division_name}
                            </span>
                            <span className="text-slate-400 text-xs font-medium">
                              {divSubjects.length} {divSubjects.length === 1 ? 'subject' : 'subjects'}
                            </span>
                          </div>

                          {divSubjects.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {divSubjects.map(sub => (
                                <div
                                  key={sub.id}
                                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-xs"
                                >
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="text-white font-medium">{sub.name}</p>
                                      {OFFICIAL_CS_TIMETABLE_SUBJECTS.find(x => x.code === sub.code)?.type && (
                                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                                          OFFICIAL_CS_TIMETABLE_SUBJECTS.find(x => x.code === sub.code)?.type === 'Practical'
                                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                            : OFFICIAL_CS_TIMETABLE_SUBJECTS.find(x => x.code === sub.code)?.type === 'Elective'
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                        }`}>
                                          {OFFICIAL_CS_TIMETABLE_SUBJECTS.find(x => x.code === sub.code)?.type}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="font-mono text-brand-accent text-[11px] font-bold">{sub.code}</span>
                                      {OFFICIAL_CS_TIMETABLE_SUBJECTS.find(x => x.code === sub.code)?.faculty && (
                                        <span className="text-[10px] text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-700/60">
                                          Faculty: {OFFICIAL_CS_TIMETABLE_SUBJECTS.find(x => x.code === sub.code)?.faculty}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteSubject(sub.id, sub.name)}
                                    className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors"
                                    title="Delete subject"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-slate-500 text-xs italic py-2">
                              No subjects added yet for {div.name} Div {div.division_name}. Use the form above to add one.
                            </p>
                          )}
                        </div>
                      )
                    })}

                  {divisions.filter(d => d.course_id === selectedCourseForCurriculum.id).length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                      No divisions configured for this course yet. Please create a division (e.g., FY Div A) first.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 mt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCourseForCurriculum(null)}
                className="btn btn-secondary py-2 text-xs"
              >
                Close Curriculum View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
