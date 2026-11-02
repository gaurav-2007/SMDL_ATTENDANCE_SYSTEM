import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  BookOpen, Plus, X, GraduationCap, Layers,
  RefreshCw, CheckCircle2, ChevronRight, Loader2,
  Trash2, Search, Filter, Sparkles, BookMarked,
  ArrowRight, Hash, Check, Calendar, Clock, MapPin,
  AlertCircle, Edit2, User
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Badge, Button, Input, Modal, Skeleton, EmptyState
} from '../../components/ui'

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
  const [tab, setTab] = useState('COURSES') // 'COURSES', 'DIVISIONS', 'SUBJECTS', 'TIMETABLE'
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

  // Timetable State (Step 4: Weekly Timetable Builder)
  const [timetableDivId, setTimetableDivId] = useState('')
  const [timetableSlots, setTimetableSlots] = useState([])
  const [teachersList, setTeachersList] = useState([])
  const [loadingTimetable, setLoadingTimetable] = useState(false)
  const [showSlotModal, setShowSlotModal] = useState(false)
  const [slotForm, setSlotForm] = useState({
    id: null,
    day_of_week: 'Monday',
    start_time: '08:00:00',
    end_time: '09:00:00',
    subject_id: '',
    teacher_id: '',
    room_number: 'Room 101',
    is_lab: false,
  })
  const [savingSlot, setSavingSlot] = useState(false)
  const [conflictError, setConflictError] = useState('')
  const [smdlLoading, setSmdlLoading] = useState(false)

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
      const cList = cRes.data.data?.courses || []
      const dList = dRes.data.data?.divisions || []
      const sList = sRes.data.data?.subjects || []
      setCourses(cList)
      setDivisions(dList)
      setSubjects(sList)
      setTimetableDivId(prev => prev || dList[0]?.id || '')
    } catch {
      toast.error('Failed to load academic structure')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTimetable = useCallback(async (divId) => {
    if (!divId) return
    setLoadingTimetable(true)
    try {
      const { data } = await api.get(`/academic/timetable/${divId}`)
      setTimetableSlots(data.data?.slots || [])
    } catch {
      toast.error('Failed to load timetable')
    } finally {
      setLoadingTimetable(false)
    }
  }, [])

  const fetchTeachersList = useCallback(async () => {
    try {
      const { data } = await api.get('/academic/teachers-list')
      setTeachersList(data.data?.teachers || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (tab === 'TIMETABLE') {
      if (timetableDivId) fetchTimetable(timetableDivId)
      fetchTeachersList()
    }
  }, [tab, timetableDivId, fetchTimetable, fetchTeachersList])

  async function handleSaveSlot(e) {
    e?.preventDefault()
    if (!slotForm.subject_id) {
      toast.error('Please select a subject')
      return
    }
    setSavingSlot(true)
    setConflictError('')
    try {
      await api.post('/academic/timetable', {
        ...slotForm,
        division_id: timetableDivId,
      })
      toast.success(slotForm.id ? 'Slot updated successfully! ✅' : 'Slot added to timetable! ✅')
      setShowSlotModal(false)
      fetchTimetable(timetableDivId)
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save timetable slot'
      setConflictError(msg)
      toast.error(msg)
    } finally {
      setSavingSlot(false)
    }
  }

  async function handleDeleteSlot(id, name) {
    if (!window.confirm(`Delete ${name || 'this slot'} from the timetable?`)) return
    try {
      await api.delete(`/academic/timetable/${id}`)
      toast.success('Slot removed from timetable')
      setTimetableSlots(ts => ts.filter(s => s.id !== id))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete slot')
    }
  }

  async function handleLoadSmdlMatrix() {
    if (!timetableDivId) return toast.error('Select a division first')
    if (!window.confirm('Populate official SMDL 14-subject timetable for this division? This will schedule Monday through Saturday slots.')) return
    setSmdlLoading(true)
    try {
      const { data } = await api.post('/academic/timetable/load-smdl-matrix', { division_id: timetableDivId })
      toast.success(data.message || 'Official SMDL Timetable Loaded! ⚡')
      fetchTimetable(timetableDivId)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load timetable matrix')
    } finally {
      setSmdlLoading(false)
    }
  }

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
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-ink tracking-tight flex items-center gap-2.5">
            <GraduationCap className="text-brand shrink-0" size={26} />
            Academic Structure & Curriculum Management
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            Configure college degree programs, class divisions, curriculum subjects, and weekly timetable matrices
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={fetchData} variant="outline" size="sm" title="Refresh data">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button
            onClick={() => {
              setCourseForm({ name: '', code: '', duration_years: 3 })
              setShowCourseModal(true)
            }}
            variant="primary"
            size="sm"
            className="gap-1.5"
          >
            <Plus size={14} /> Add Course
          </Button>
          <Button
            onClick={() => {
              setDivisionForm({ course_id: courses[0]?.id || '', name: 'FY', division_name: 'A' })
              setShowDivisionModal(true)
            }}
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <Plus size={14} /> Add Division
          </Button>
          <Button
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
            variant="outline"
            size="sm"
            className="gap-1.5 text-emerald-700 dark:text-emerald-400 border-emerald-300 hover:bg-emerald-50"
          >
            <Plus size={14} /> Add Subject
          </Button>
        </div>
      </div>

      {/* Navigation Tabs & Quick Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1.5 p-1 bg-bg border border-line rounded-lg w-fit">
          <button
            onClick={() => setTab('COURSES')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              tab === 'COURSES'
                ? 'bg-surface text-ink font-semibold shadow-xs border border-line'
                : 'text-muted hover:text-ink hover:bg-surface/50'
            }`}
          >
            <GraduationCap size={14} /> Courses ({courses.length})
          </button>
          <button
            onClick={() => setTab('DIVISIONS')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              tab === 'DIVISIONS'
                ? 'bg-surface text-ink font-semibold shadow-xs border border-line'
                : 'text-muted hover:text-ink hover:bg-surface/50'
            }`}
          >
            <Layers size={14} /> Divisions ({divisions.length})
          </button>
          <button
            onClick={() => setTab('SUBJECTS')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              tab === 'SUBJECTS'
                ? 'bg-surface text-ink font-semibold shadow-xs border border-line'
                : 'text-muted hover:text-ink hover:bg-surface/50'
            }`}
          >
            <BookOpen size={14} /> Subjects ({subjects.length})
          </button>
          <button
            onClick={() => setTab('TIMETABLE')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              tab === 'TIMETABLE'
                ? 'bg-surface text-ink font-semibold shadow-xs border border-line'
                : 'text-muted hover:text-ink hover:bg-surface/50'
            }`}
          >
            <Calendar size={14} /> Weekly Timetable
          </button>
        </div>

        {/* Filter & Search Bar for non-course tabs */}
        {tab !== 'COURSES' && (
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="w-48 sm:w-60">
              <Input
                type="text"
                placeholder="Search by code or title..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                icon={Search}
              />
            </div>
            <select
              value={selectedCourseFilter}
              onChange={e => setSelectedCourseFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer max-w-[190px]"
            >
              <option value="ALL">All Degree Courses</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-8 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <>
          {/* ═══════════ TAB 1: COURSES ═══════════ */}
          {tab === 'COURSES' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {courses.map(c => {
                const courseDivs = divisions.filter(d => d.course_id === c.id)
                const subjectCount = subjectCountByCourse[c.id] || 0
                return (
                  <Card
                    key={c.id}
                    className="p-5 flex flex-col justify-between hover:border-brand/40 transition-colors shadow-xs"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <Badge variant="brand" size="md">
                            {c.code}
                          </Badge>
                          <span className="block text-[10px] text-muted font-mono mt-1">
                            Permanent Degree Identifier
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted text-xs font-medium">
                            {c.duration_years || 3} Yrs ({(c.duration_years || 3) * 2} Sems)
                          </span>
                          <button
                            onClick={() => handleDeleteCourse(c.id, c.name)}
                            className="text-muted hover:text-red-600 p-1 rounded-md hover:bg-red-50 transition-colors"
                            title="Delete course"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <h3 className="font-bold text-ink text-base sm:text-lg mb-3">
                        {c.name}
                      </h3>

                      {/* Meta counters */}
                      <div className="flex items-center gap-2.5 text-xs text-muted mb-5">
                        <span className="flex items-center gap-1.5 bg-bg px-2.5 py-1 rounded-md border border-line">
                          <Layers size={13} className="text-brand shrink-0" />
                          <strong className="text-ink font-semibold">{courseDivs.length}</strong> Divisions
                        </span>
                        <span className="flex items-center gap-1.5 bg-bg px-2.5 py-1 rounded-md border border-line">
                          <BookOpen size={13} className="text-emerald-600 shrink-0" />
                          <strong className="text-ink font-semibold">{subjectCount}</strong> Subjects
                        </span>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCourseForCurriculum(c)}
                        className="gap-1 text-xs text-brand"
                      >
                        <BookMarked size={13} /> Curriculum <ChevronRight size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSubjectForm({
                            course_id: c.id,
                            division_id: courseDivs[0]?.id || '',
                            name: '',
                            code: ''
                          })
                          setShowSubjectModal(true)
                        }}
                        className="gap-1 text-xs text-emerald-700 hover:bg-emerald-50"
                      >
                        <Plus size={13} /> Quick Add
                      </Button>
                    </div>
                  </Card>
                )
              })}

              {courses.length === 0 && (
                <div className="col-span-full">
                  <EmptyState
                    icon={GraduationCap}
                    title="No degree courses configured"
                    description="Configure your college degree programs (e.g. B.Sc. Computer Science) to get started."
                    action={
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setShowCourseModal(true)}
                        className="gap-1.5"
                      >
                        <Plus size={14} /> Add First Course
                      </Button>
                    }
                  />
                </div>
              )}
            </div>
          )}

          {/* ═══════════ TAB 2: DIVISIONS ═══════════ */}
          {tab === 'DIVISIONS' && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-line bg-bg/50 text-xs font-semibold text-muted uppercase tracking-wider">
                      <th className="py-3 px-4 w-12">#</th>
                      <th className="py-3 px-4">Class & Division</th>
                      <th className="py-3 px-4">Academic Year</th>
                      <th className="py-3 px-4">Section</th>
                      <th className="py-3 px-4">Associated Degree</th>
                      <th className="py-3 px-4">Curriculum</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filteredDivisions.map((d, idx) => (
                      <tr key={d.id} className="hover:bg-bg/40 transition-colors">
                        <td className="py-3 px-4 text-muted text-xs font-mono">{idx + 1}</td>
                        <td className="py-3 px-4 font-semibold text-ink">
                          {d.courses?.name ? `${d.courses.code} - ` : ''}{d.name} Div {d.division_name}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="brand">{d.name}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-ink bg-bg border border-line px-2 py-0.5 rounded text-xs font-medium">
                            Div {d.division_name}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-ink text-xs font-medium">{d.courses?.name || 'General'}</td>
                        <td className="py-3 px-4">
                          <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {subjectCountByDivision[d.id] || 0} subjects
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeleteDivision(d.id, `${d.name} Div ${d.division_name}`)}
                            className="text-muted hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition-colors inline-flex items-center"
                            title="Delete division"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredDivisions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-muted text-xs">
                          No divisions found matching criteria
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ═══════════ TAB 3: SUBJECTS ═══════════ */}
          {tab === 'SUBJECTS' && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-line bg-bg/50 text-xs font-semibold text-muted uppercase tracking-wider">
                      <th className="py-3 px-4 w-12">#</th>
                      <th className="py-3 px-4">Subject Code</th>
                      <th className="py-3 px-4">Curriculum Subject Name</th>
                      <th className="py-3 px-4">Degree Course</th>
                      <th className="py-3 px-4">Assigned Division</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filteredSubjects.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-bg/40 transition-colors">
                        <td className="py-3 px-4 text-muted text-xs font-mono">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-brand bg-brand/10 border border-brand/20 px-2.5 py-0.5 rounded text-xs font-bold">
                            {s.code}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-ink">
                          {s.name}
                        </td>
                        <td className="py-3 px-4 text-muted text-xs">
                          {s.divisions?.courses?.name || 'General Degree'}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {s.divisions ? (
                            <Badge variant="brand">
                              {s.divisions.name} - Div {s.divisions.division_name}
                            </Badge>
                          ) : (
                            <span className="text-muted italic">All Divisions</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeleteSubject(s.id, s.name)}
                            className="text-muted hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition-colors inline-flex items-center"
                            title="Delete subject"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredSubjects.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-muted text-xs">
                          No curriculum subjects found matching criteria
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ═══════════ TAB 4: WEEKLY TIMETABLE BUILDER ═══════════ */}
          {tab === 'TIMETABLE' && (
            <div className="space-y-4">
              {/* Top Controls: Division Picker & Actions */}
              <Card className="p-4 sm:p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-muted text-xs font-semibold">Select Division:</span>
                    <select
                      value={timetableDivId}
                      onChange={e => {
                        setTimetableDivId(e.target.value)
                        fetchTimetable(e.target.value)
                      }}
                      className="px-3 py-2 text-xs rounded-lg border border-line bg-surface text-ink font-semibold focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer w-64"
                    >
                      {divisions.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.courses?.code ? `[${d.courses.code}] ` : ''}{d.name} Div {d.division_name}
                        </option>
                      ))}
                    </select>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchTimetable(timetableDivId)}
                      className="p-2"
                      title="Refresh schedule"
                    >
                      <RefreshCw size={14} className={loadingTimetable ? 'animate-spin' : ''} />
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLoadSmdlMatrix}
                      disabled={smdlLoading}
                      className="gap-1.5 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                      title="Import official 14-subject SMDL FYBSc CS schedule"
                    >
                      {smdlLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      ⚡ Load SMDL Presets
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        const matchedSubjects = subjects.filter(s => !s.division_id || s.division_id === timetableDivId)
                        setSlotForm({
                          id: null,
                          day_of_week: 'Monday',
                          start_time: '08:00:00',
                          end_time: '09:00:00',
                          subject_id: matchedSubjects[0]?.id || '',
                          teacher_id: teachersList[0]?.id || '',
                          room_number: 'Room 101',
                          is_lab: false,
                        })
                        setConflictError('')
                        setShowSlotModal(true)
                      }}
                      className="gap-1.5 text-xs"
                    >
                      <Plus size={14} /> Add Lecture Slot
                    </Button>
                  </div>
                </div>
              </Card>

              {/* 6-Day Weekly Matrix Grid */}
              {loadingTimetable ? (
                <Card className="text-center py-20">
                  <Loader2 className="animate-spin w-8 h-8 mx-auto mb-2 text-brand" />
                  <p className="text-muted text-xs">Loading division timetable matrix...</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => {
                    const daySlots = timetableSlots
                      .filter(s => s.day_of_week?.toLowerCase() === day.toLowerCase())
                      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))

                    return (
                      <div key={day} className="flex flex-col bg-surface border border-line rounded-xl overflow-hidden shadow-2xs">
                        {/* Day Column Header */}
                        <div className="px-3.5 py-2.5 bg-bg/60 border-b border-line flex items-center justify-between">
                          <span className="font-bold text-xs text-ink">{day}</span>
                          <span className="text-[11px] font-mono text-muted">
                            {daySlots.length} {daySlots.length === 1 ? 'Slot' : 'Slots'}
                          </span>
                        </div>

                        {/* Slots container */}
                        <div className="p-2.5 space-y-2 flex-1 min-h-[160px]">
                          {daySlots.map(slot => (
                            <div
                              key={slot.id}
                              className="group relative bg-bg/50 hover:bg-bg border border-line rounded-lg p-2.5 transition-all text-xs shadow-2xs"
                            >
                              {/* Slot Time */}
                              <div className="flex items-center justify-between gap-1 text-[11px] font-mono text-muted mb-1">
                                <span className="flex items-center gap-1 font-semibold text-ink">
                                  <Clock size={11} className="text-brand shrink-0" />
                                  {(slot.start_time || '').slice(0, 5)} - {(slot.end_time || '').slice(0, 5)}
                                </span>
                                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => {
                                      setSlotForm({
                                        id: slot.id,
                                        day_of_week: slot.day_of_week,
                                        start_time: slot.start_time,
                                        end_time: slot.end_time,
                                        subject_id: slot.subject?.id || slot.subject_id,
                                        teacher_id: slot.teacher?.id || slot.teacher_id || '',
                                        room_number: slot.room_number || 'Room 101',
                                        is_lab: !!slot.is_lab,
                                      })
                                      setConflictError('')
                                      setShowSlotModal(true)
                                    }}
                                    className="text-muted hover:text-ink p-0.5"
                                    title="Edit slot"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSlot(slot.id, slot.subject?.name)}
                                    className="text-muted hover:text-red-600 p-0.5"
                                    title="Delete slot"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>

                              {/* Subject Badge & Name */}
                              <div className="flex items-start gap-1.5 mb-1.5">
                                {slot.subject?.code && (
                                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-brand/10 text-brand border border-brand/20 shrink-0">
                                    {slot.subject.code}
                                  </span>
                                )}
                                <p className="font-semibold text-ink line-clamp-2 leading-tight">
                                  {slot.subject?.name || 'Class'}
                                </p>
                              </div>

                              {/* Faculty & Room Footer */}
                              <div className="flex flex-wrap items-center justify-between gap-1 pt-1.5 border-t border-line text-[10px]">
                                <span className="text-muted truncate max-w-[105px] flex items-center gap-1" title={slot.teacher?.user?.full_name || 'Faculty'}>
                                  <User size={10} className="text-muted shrink-0" />
                                  {slot.teacher?.user?.full_name || 'Assigned Faculty'}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                                  slot.is_lab
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-purple-50 text-purple-700 border border-purple-200'
                                }`}>
                                  {slot.room_number || 'Room 101'}
                                </span>
                              </div>
                            </div>
                          ))}

                          {daySlots.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full py-8 text-center text-muted">
                              <p className="text-[11px] mb-2">No lectures scheduled</p>
                              <button
                                onClick={() => {
                                  const matchedSubjects = subjects.filter(s => !s.division_id || s.division_id === timetableDivId)
                                  setSlotForm({
                                    id: null,
                                    day_of_week: day,
                                    start_time: '08:00:00',
                                    end_time: '09:00:00',
                                    subject_id: matchedSubjects[0]?.id || '',
                                    teacher_id: teachersList[0]?.id || '',
                                    room_number: 'Room 101',
                                    is_lab: false,
                                  })
                                  setConflictError('')
                                  setShowSlotModal(true)
                                }}
                                className="text-[11px] text-brand hover:underline flex items-center gap-1 font-medium cursor-pointer"
                              >
                                <Plus size={11} /> Add slot
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 1: ADD COURSE
      ══════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={showCourseModal}
        onClose={() => setShowCourseModal(false)}
        title="Add Degree Program"
        description="Configure permanent degree course structure for SMDL College"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          {/* Quick Presets */}
          <div className="p-3 rounded-lg bg-bg border border-line">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2 flex items-center gap-1">
              <Sparkles size={12} className="text-brand" /> Quick Degree Presets:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {COURSE_PRESETS.map(p => (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`text-[11px] px-2.5 py-1 rounded-md border font-medium transition-all cursor-pointer ${
                    courseForm.code === p.code
                      ? 'bg-brand/10 border-brand text-brand font-bold shadow-2xs'
                      : 'bg-surface border-line text-muted hover:text-ink hover:bg-bg'
                  }`}
                >
                  {p.code}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleCreateCourse} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink">Full Degree Name *</label>
              <input
                type="text"
                className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none"
                placeholder="e.g. B.Sc. Computer Science"
                value={courseForm.name}
                onChange={e => setCourseForm(p => ({ ...p, name: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink flex items-center justify-between">
                  <span>Permanent Code *</span>
                  <span className="text-[10px] text-muted normal-case font-medium">Fixed for all sems</span>
                </label>
                <input
                  type="text"
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-mono uppercase tracking-wider font-bold focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none"
                  placeholder="e.g. BSC-CS"
                  value={courseForm.code}
                  onChange={e => setCourseForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink">Duration (Years)</label>
                <select
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
                  value={courseForm.duration_years}
                  onChange={e => setCourseForm(p => ({ ...p, duration_years: Number(e.target.value) }))}
                >
                  <option value="1">1 Year (2 Semesters)</option>
                  <option value="2">2 Years (4 Semesters)</option>
                  <option value="3">3 Years (6 Semesters)</option>
                  <option value="4">4 Years (8 Semesters)</option>
                  <option value="5">5 Years (10 Semesters)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowCourseModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={savingCourse}>
                {savingCourse ? 'Creating...' : 'Create Program'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 2: ADD DIVISION
      ══════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={showDivisionModal}
        onClose={() => setShowDivisionModal(false)}
        title="Add Academic Division"
        description="Create class sections (e.g. FY Div A) for lectures and attendance"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateDivision} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink">Parent Degree Course *</label>
            <select
              className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink">Academic Level *</label>
              <input
                type="text"
                className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-bold focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none"
                placeholder="e.g. FY, SY, TY"
                value={divisionForm.name}
                onChange={e => setDivisionForm(p => ({ ...p, name: e.target.value.toUpperCase() }))}
                required
              />
              <div className="flex gap-1.5 mt-1.5">
                {['FY', 'SY', 'TY'].map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setDivisionForm(p => ({ ...p, name: lvl }))}
                    className={`text-[10px] px-2 py-0.5 rounded font-mono border transition-all cursor-pointer ${
                      divisionForm.name === lvl
                        ? 'bg-brand/10 border-brand text-brand font-bold'
                        : 'bg-bg border-line text-muted'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink">Division Section *</label>
              <input
                type="text"
                className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-mono uppercase font-bold focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none"
                placeholder="e.g. A, B, C"
                maxLength={4}
                value={divisionForm.division_name}
                onChange={e => setDivisionForm(p => ({ ...p, division_name: e.target.value.toUpperCase() }))}
                required
              />
              <div className="flex gap-1.5 mt-1.5">
                {['A', 'B', 'C', 'D'].map(sec => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setDivisionForm(p => ({ ...p, division_name: sec }))}
                    className={`text-[10px] px-2 py-0.5 rounded font-mono border transition-all cursor-pointer ${
                      divisionForm.division_name === sec
                        ? 'bg-brand/10 border-brand text-brand font-bold'
                        : 'bg-bg border-line text-muted'
                    }`}
                  >
                    Div {sec}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Live Preview */}
          {divisionForm.name && divisionForm.division_name && (
            <div className="p-3 bg-bg rounded-lg border border-line flex items-center justify-between text-xs">
              <span className="text-muted font-medium">Resulting Identifier:</span>
              <span className="text-brand font-bold">
                {courses.find(c => c.id === divisionForm.course_id)?.code || 'Course'} · {divisionForm.name} - Division {divisionForm.division_name}
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowDivisionModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={savingDivision}>
              {savingDivision ? 'Creating...' : 'Create Division'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 3: ADD SUBJECT
      ══════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={showSubjectModal}
        onClose={() => setShowSubjectModal(false)}
        title="Add Curriculum Subject"
        description="Format: Course Prefix + 2 Digits (e.g. CS-01, CS-02)"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateSubject} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink">Degree Program *</label>
              <select
                className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
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

            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink">Assigned Scope / Division *</label>
              <select
                className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
                value={subjectForm.division_id}
                onChange={e => setSubjectForm(p => ({ ...p, division_id: e.target.value }))}
                required
              >
                <option value="">-- Select Division --</option>
                {subjectForm.course_id && (
                  <option value="ALL_IN_COURSE" className="font-bold text-brand">
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

          {/* SMDL Official Timetable Presets for B.Sc. CS */}
          {courses.find(c => c.id === subjectForm.course_id)?.code === 'BSC-CS' && (
            <div className="p-3 bg-bg rounded-lg border border-line">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-brand uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={12} /> Official Timetable Subjects (1-Click Fill):
                </span>
                <span className="text-[10px] text-muted">NEP Sem-1</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                {OFFICIAL_CS_TIMETABLE_SUBJECTS.map(ts => (
                  <button
                    key={ts.code}
                    type="button"
                    onClick={() => setSubjectForm(p => ({ ...p, name: ts.name, code: ts.code }))}
                    className={`text-[11px] p-2 rounded-lg border text-left transition-all cursor-pointer ${
                      subjectForm.code === ts.code
                        ? 'bg-brand/10 border-brand text-ink font-bold shadow-2xs'
                        : 'bg-surface border-line text-muted hover:text-ink'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-bold text-brand">{ts.code}</span>
                      <span className="text-[9px] px-1 py-0.2 bg-bg text-muted rounded">
                        {ts.tag}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted truncate mt-0.5">{ts.name}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Code Builder */}
          <div className="p-3 bg-bg rounded-lg border border-line space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-ink uppercase tracking-wider flex items-center gap-1">
                <Hash size={12} className="text-brand" /> Subject Code Options Builder:
              </span>
              {nextAvailableCode && (
                <button
                  type="button"
                  onClick={() => setSubjectForm(p => ({ ...p, code: nextAvailableCode }))}
                  className="text-[10px] px-2 py-0.5 rounded bg-brand/10 text-brand border border-brand/20 font-mono font-semibold cursor-pointer"
                >
                  ⚡ Next Free: {nextAvailableCode}
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
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
                    className={`text-[11px] font-mono px-2 py-0.5 rounded transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-brand text-white border-brand font-bold'
                        : isUsed
                        ? 'bg-bg/40 border-line text-muted/60'
                        : 'bg-surface border-line text-ink hover:border-brand'
                    }`}
                  >
                    {num} {isUsed && <span className="text-[8px] text-muted">●</span>}
                  </button>
                )
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-ink block mb-1">
                  Final Subject Code *
                </label>
                <input
                  type="text"
                  className="w-full text-xs p-2 rounded-lg border border-line bg-surface text-ink font-mono uppercase tracking-wider font-bold focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none"
                  placeholder="e.g. CS-01"
                  value={subjectForm.code}
                  onChange={e => setSubjectForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-ink block mb-1">
                  Availability Status
                </label>
                <div className="p-2 rounded-lg bg-surface border border-line flex items-center justify-between text-xs font-mono h-[38px]">
                  <span className="text-brand font-bold">{subjectForm.code || 'None'}</span>
                  {subjectForm.code && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      existingCodesInSelectedCourse.has(subjectForm.code)
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {existingCodesInSelectedCourse.has(subjectForm.code) ? 'In use' : 'Available'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-ink">Subject Title *</label>
            <input
              type="text"
              className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none"
              placeholder="e.g. Data Structures & Algorithms (DSA)"
              value={subjectForm.name}
              onChange={e => setSubjectForm(p => ({ ...p, name: e.target.value }))}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowSubjectModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={savingSubject}>
              {savingSubject ? 'Adding...' : 'Add Subject'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 4: COURSE CURRICULUM DRAWER
      ══════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={Boolean(selectedCourseForCurriculum)}
        onClose={() => setSelectedCourseForCurriculum(null)}
        title={selectedCourseForCurriculum ? `${selectedCourseForCurriculum.name} (${selectedCourseForCurriculum.code})` : 'Curriculum'}
        description="Course syllabus subjects and class division mapping"
        maxWidth="max-w-3xl"
      >
        {selectedCourseForCurriculum && (
          <div className="space-y-5">
            {/* Quick Add Subject Box */}
            <div className="p-4 rounded-xl bg-bg border border-line space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand flex items-center gap-1.5">
                <Plus size={14} /> Quick Add Subject to {selectedCourseForCurriculum.code}
              </h4>

              <form onSubmit={handleQuickAddSubjectToCourse} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                <div className="sm:col-span-4 space-y-1">
                  <label className="text-[11px] font-semibold text-ink">Division *</label>
                  <select
                    className="w-full text-xs p-2 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
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
                <div className="sm:col-span-4 space-y-1">
                  <label className="text-[11px] font-semibold text-ink">Subject Name *</label>
                  <input
                    type="text"
                    className="w-full text-xs p-2 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none"
                    placeholder="e.g. Applied Math"
                    value={quickSubjectForm.name}
                    onChange={e => setQuickSubjectForm(p => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-semibold text-ink">Code *</label>
                  <input
                    type="text"
                    className="w-full text-xs p-2 rounded-lg border border-line bg-surface text-ink font-mono uppercase font-bold focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none"
                    placeholder="e.g. CS-15"
                    value={quickSubjectForm.code}
                    onChange={e => setQuickSubjectForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={savingQuickSubject}
                    className="w-full"
                  >
                    {savingQuickSubject ? 'Saving...' : 'Add'}
                  </Button>
                </div>
              </form>
            </div>

            {/* Subject Breakdown per Division */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
                Curriculum Subjects by Division ({subjects.filter(s => s.divisions?.course_id === selectedCourseForCurriculum.id).length} Total)
              </h4>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {divisions
                  .filter(d => d.course_id === selectedCourseForCurriculum.id)
                  .map(div => {
                    const divSubjects = subjects.filter(s => s.division_id === div.id)
                    return (
                      <div key={div.id} className="p-3.5 bg-surface rounded-xl border border-line">
                        <div className="flex items-center justify-between mb-2.5">
                          <Badge variant="brand">{div.name} - Division {div.division_name}</Badge>
                          <span className="text-muted text-xs font-mono font-medium">
                            {divSubjects.length} subjects
                          </span>
                        </div>

                        {divSubjects.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {divSubjects.map(sub => (
                              <div
                                key={sub.id}
                                className="flex items-center justify-between p-2.5 rounded-lg bg-bg border border-line text-xs"
                              >
                                <div className="min-w-0 pr-2">
                                  <p className="font-semibold text-ink truncate leading-tight">{sub.name}</p>
                                  <span className="font-mono text-brand font-bold text-[11px]">{sub.code}</span>
                                </div>
                                <button
                                  onClick={() => handleDeleteSubject(sub.id, sub.name)}
                                  className="text-muted hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                                  title="Delete subject"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted text-xs italic py-1">
                            No subjects registered for this division yet.
                          </p>
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-line">
              <Button variant="outline" size="sm" onClick={() => setSelectedCourseForCurriculum(null)}>
                Close Curriculum
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL 5: ADD / EDIT TIMETABLE SLOT
      ══════════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={showSlotModal}
        onClose={() => setShowSlotModal(false)}
        title={slotForm.id ? 'Edit Timetable Slot' : 'Add Timetable Slot'}
        description="Schedule division classroom lecture slot with faculty and room assignment"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          {conflictError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{conflictError}</span>
            </div>
          )}

          <form onSubmit={handleSaveSlot} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink">Day of Week:</label>
                <select
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
                  value={slotForm.day_of_week}
                  onChange={e => setSlotForm({ ...slotForm, day_of_week: e.target.value })}
                >
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink">Classroom / Room Number:</label>
                <input
                  type="text"
                  required
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none"
                  placeholder="e.g. Room 101 or Lab 202"
                  value={slotForm.room_number}
                  onChange={e => setSlotForm({ ...slotForm, room_number: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink">Start Time:</label>
                <input
                  type="time"
                  step="1"
                  required
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none"
                  value={slotForm.start_time}
                  onChange={e => setSlotForm({ ...slotForm, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink">End Time:</label>
                <input
                  type="time"
                  step="1"
                  required
                  className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none"
                  value={slotForm.end_time}
                  onChange={e => setSlotForm({ ...slotForm, end_time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink">Curriculum Subject:</label>
              <select
                required
                className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
                value={slotForm.subject_id}
                onChange={e => setSlotForm({ ...slotForm, subject_id: e.target.value })}
              >
                <option value="">-- Choose Subject --</option>
                {subjects
                  .filter(s => !s.division_id || s.division_id === timetableDivId)
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      {s.code ? `[${s.code}] ` : ''}{s.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-ink">Assigned Faculty (Teacher):</label>
              <select
                className="w-full text-xs p-2.5 rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
                value={slotForm.teacher_id}
                onChange={e => setSlotForm({ ...slotForm, teacher_id: e.target.value })}
              >
                <option value="">-- Optional / Assigned Faculty --</option>
                {teachersList.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.user?.full_name || t.teacher_id} ({t.department || 'Faculty'})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="slot_is_lab"
                checked={slotForm.is_lab}
                onChange={e => setSlotForm({ ...slotForm, is_lab: e.target.checked })}
                className="w-4 h-4 rounded border-line text-brand focus:ring-0 cursor-pointer"
              />
              <label htmlFor="slot_is_lab" className="text-ink text-xs cursor-pointer select-none">
                Practical / Lab Session (hands-on)
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowSlotModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={savingSlot}>
                {savingSlot ? 'Saving...' : slotForm.id ? 'Save Changes' : 'Add to Timetable'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  )
}
