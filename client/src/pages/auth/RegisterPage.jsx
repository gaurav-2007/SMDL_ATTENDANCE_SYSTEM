import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, UserPlus, GraduationCap, BookOpen, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import api from '../../lib/api'

const DEFAULT_COURSES = [
  { id: '80acc4c6-829f-40a4-ab0b-6cd44032fffc', name: 'B.Sc. Computer Science', code: 'BSC-CS', department: 'Computer Science' },
  { id: '86baa198-736b-481a-b519-177498d5259b', name: 'B.Sc. Information Technology', code: 'BSC-IT', department: 'Information Technology' },
  { id: '61429f5e-c954-4992-bdf6-a2bbfafe1d0a', name: 'Bachelor of Commerce', code: 'BCOM', department: 'Commerce' },
  { id: '47997f9f-bff3-4f17-a88f-8a46086fcd53', name: 'B.Com Accounting & Finance', code: 'BAF', department: 'Accounting & Finance' },
]

const TEACHER_DEPARTMENTS = [
  'Computer Science', 'Information Technology', 'Commerce', 'Accounting & Finance',
  'Electronics', 'Mechanical', 'Civil', 'Arts', 'Science'
]

const INITIAL_STUDENT = {
  full_name: '', email: '', password: '', confirm_password: '',
  roll_number: '', branch: '', course_id: '', division_id: '',
  class: 'FY', division: 'A', phone: '',
}

const INITIAL_TEACHER = {
  full_name: '', email: '', password: '', confirm_password: '',
  employee_id: '', department: '', designation: '', phone: '',
}

function FieldInput({ id, label, name, type = 'text', placeholder, value, onChange, error, optional }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label} {optional && <span className="text-brand-muted text-xs">(optional)</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`input ${error ? 'input-error' : ''}`}
      />
      {error && <p className="text-brand-danger text-xs mt-1">{error}</p>}
    </div>
  )
}

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [role, setRole] = useState(location.state?.role || 'student')
  const [courses, setCourses] = useState(DEFAULT_COURSES)
  const [divisions, setDivisions] = useState([])
  const [loadingAcademic, setLoadingAcademic] = useState(false)

  const [form, setForm] = useState(() => {
    const initBranch = location.state?.branch || location.state?.course_id || DEFAULT_COURSES[0].id
    const matched = DEFAULT_COURSES.find(c => c.id === initBranch || c.name === initBranch || c.code === initBranch)
    return {
      ...INITIAL_STUDENT,
      branch: matched?.name || DEFAULT_COURSES[0].name,
      course_id: matched?.id || DEFAULT_COURSES[0].id,
    }
  })

  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  // Fetch academic courses and divisions
  useEffect(() => {
    let isMounted = true
    async function fetchAcademic() {
      setLoadingAcademic(true)
      try {
        const [cRes, dRes] = await Promise.allSettled([
          api.get('/academic/courses'),
          api.get('/academic/divisions'),
        ])
        if (!isMounted) return

        if (cRes.status === 'fulfilled' && cRes.value.data?.data?.courses?.length > 0) {
          const fetchedCourses = cRes.value.data.data.courses
          setCourses(fetchedCourses)

          // If current form has initial course, match it
          const passed = location.state?.course_id || location.state?.branch
          const found = passed
            ? fetchedCourses.find(c => c.id === passed || c.name === passed || c.code === passed)
            : fetchedCourses[0]

          if (found) {
            setForm(prev => ({
              ...prev,
              course_id: found.id,
              branch: found.name,
            }))
          }
        }

        if (dRes.status === 'fulfilled' && dRes.value.data?.data?.divisions?.length > 0) {
          setDivisions(dRes.value.data.data.divisions)
        }
      } catch (err) {
        console.warn('Academic fetch error:', err)
      } finally {
        if (isMounted) setLoadingAcademic(false)
      }
    }
    fetchAcademic()
    return () => { isMounted = false }
  }, [location.state])

  function switchRole(r) {
    setRole(r)
    if (r === 'student') {
      const defaultCourse = courses[0] || DEFAULT_COURSES[0]
      setForm({
        ...INITIAL_STUDENT,
        course_id: defaultCourse.id,
        branch: defaultCourse.name,
      })
    } else {
      setForm(INITIAL_TEACHER)
    }
    setErrors({})
  }

  function change(e) {
    const { name, value } = e.target
    setForm(p => ({ ...p, [name]: value }))
    if (errors[name]) setErrors(p => ({ ...p, [name]: undefined }))
  }

  function handleBranchChange(e) {
    const courseId = e.target.value
    const found = courses.find(c => c.id === courseId) || DEFAULT_COURSES.find(c => c.id === courseId)
    setForm(p => ({
      ...p,
      course_id: courseId,
      branch: found?.name || courseId,
      division_id: '',
    }))
    if (errors.branch) setErrors(p => ({ ...p, branch: undefined }))
  }

  // Filter divisions that belong to current selected course
  const currentCourseDivisions = divisions.filter(d => d.course_id === form.course_id)

  function validate() {
    const e = {}
    if (!form.full_name?.trim()) e.full_name = 'Full name required'
    if (!form.email?.trim()) e.email = 'Email required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email'
    if (!form.password) e.password = 'Password required'
    else if (form.password.length < 8) e.password = 'Min 8 characters'
    if (form.password !== form.confirm_password) e.confirm_password = 'Passwords do not match'
    if (!form.phone?.trim()) e.phone = 'Phone required'

    if (role === 'student') {
      if (!form.branch && !form.course_id) e.branch = 'Branch (department) required'
      if (!form.roll_number?.trim()) e.roll_number = 'Roll number required'
      if (!form.class?.trim()) e.class = 'Class / Year required'
      if (!form.division?.trim()) e.division = 'Division required'
    } else {
      if (!form.employee_id?.trim()) e.employee_id = 'Employee ID required'
      if (!form.department) e.department = 'Department required'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const payload = {
        ...form,
        name: form.full_name?.trim(),
        full_name: form.full_name?.trim(),
        email: form.email?.trim().toLowerCase(),
        phone: form.phone?.trim() || undefined,
        roll_number: form.roll_number?.trim(),
        employee_id: form.employee_id?.trim(),
        branch: form.branch,
        department: form.branch || form.department,
        designation: form.designation?.trim() || undefined,
        course_id: form.course_id || undefined,
        division_id: form.division_id || undefined,
      }
      delete payload.confirm_password

      await register(role, payload)
      if (role === 'student') {
        toast.success(`Account created for ${form.branch || 'Student'}! You can now log in.`)
        navigate('/login', {
          state: {
            role: 'student',
            selectedCourseId: form.course_id,
            prefillEmail: form.roll_number?.trim() || form.email?.trim(),
          }
        })
      } else {
        toast.success('Registration submitted! Wait for Admin approval before logging in.', { duration: 6000 })
        navigate('/login', { state: { role: 'teacher' } })
      }
    } catch (err) {
      console.error('Registration error:', err)
      const msg = err.response?.data?.message || err.message || 'Registration failed. Try again.'
      toast.error(msg)
      if (msg.toLowerCase().includes('email')) setErrors(p => ({ ...p, email: msg }))
      if (msg.toLowerCase().includes('roll')) setErrors(p => ({ ...p, roll_number: msg }))
      if (msg.toLowerCase().includes('employee')) setErrors(p => ({ ...p, employee_id: msg }))
    } finally {
      setLoading(false)
    }
  }

  // Selected course details for helper text
  const selectedCourse = courses.find(c => c.id === form.course_id) || DEFAULT_COURSES.find(c => c.id === form.course_id)
  const rollPrefixPlaceholder = selectedCourse?.code ? `${selectedCourse.code.replace('BSC-', '')}-2026-001` : 'CS-2024-001'

  return (
    <div className="min-h-screen bg-brand-dark bg-dot-pattern flex items-center justify-center p-4 py-10">
      {/* Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary-700/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-brand-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg animate-slide-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-brand shadow-xl shadow-primary-900/50 mb-4">
            <GraduationCap size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Create Account</h1>
          <p className="text-brand-muted mt-1 text-sm">SMDL College Smart Attendance System</p>
        </div>

        {/* Role toggle */}
        <div className="flex gap-3 mb-6 bg-brand-card border border-brand-border rounded-2xl p-1.5">
          {[
            { key: 'student', label: 'Student', Icon: BookOpen },
            { key: 'teacher', label: 'Teacher', Icon: UserPlus },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              id={`role-tab-${key}`}
              type="button"
              onClick={() => switchRole(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                role === key ? 'bg-gradient-brand text-white shadow-lg' : 'text-brand-muted hover:text-white'
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {/* Form card */}
        <div className="card">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {/* STUDENT: Step 1 - Choose Branch (Department) */}
            {role === 'student' && (
              <div className="bg-brand-dark/60 p-4 rounded-xl border border-brand-accent/30 space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="reg-student-branch" className="text-sm font-semibold text-brand-accent flex items-center gap-2">
                    <Building2 size={16} />
                    <span>Step 1: Choose Branch (Department)</span>
                  </label>
                  {selectedCourse?.code && (
                    <span className="badge badge-primary text-xs font-mono">
                      {selectedCourse.code}
                    </span>
                  )}
                </div>

                <select
                  id="reg-student-branch"
                  name="branch"
                  value={form.course_id || ''}
                  onChange={handleBranchChange}
                  className={`input font-medium ${errors.branch ? 'input-error' : ''}`}
                >
                  <option value="" disabled>Select your Branch (Department)...</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code || 'Dept'})
                    </option>
                  ))}
                </select>
                {errors.branch && <p className="text-brand-danger text-xs mt-1">{errors.branch}</p>}

                {/* Quick Selection Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {courses.slice(0, 4).map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleBranchChange({ target: { value: c.id } })}
                      className={`text-[11px] px-2.5 py-1 rounded-lg transition-all ${
                        form.course_id === c.id
                          ? 'bg-brand-accent text-brand-dark font-bold shadow-sm'
                          : 'bg-brand-border/40 text-brand-muted hover:text-white hover:bg-brand-border'
                      }`}
                    >
                      {c.code || c.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <FieldInput
              id="reg-full-name" label="Full Name" name="full_name"
              placeholder="e.g. Rahul Sharma" value={form.full_name || ''}
              onChange={change} error={errors.full_name}
            />

            <FieldInput
              id="reg-email" label="College or Personal Email" name="email" type="email"
              placeholder="student@smdl.ac.in" value={form.email || ''}
              onChange={change} error={errors.email}
            />

            <FieldInput
              id="reg-phone" label="Mobile Phone" name="phone" type="tel"
              placeholder="10-digit mobile number" value={form.phone || ''}
              onChange={change} error={errors.phone}
            />

            {role === 'student' ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="reg-roll" className="label">Roll No.</label>
                    <input
                      id="reg-roll"
                      name="roll_number"
                      type="text"
                      placeholder={rollPrefixPlaceholder}
                      value={form.roll_number || ''}
                      onChange={change}
                      className={`input ${errors.roll_number ? 'input-error' : ''}`}
                    />
                    {errors.roll_number && <p className="text-brand-danger text-xs mt-1">{errors.roll_number}</p>}
                  </div>

                  <div>
                    <label htmlFor="reg-class" className="label">Class / Year</label>
                    <select
                      id="reg-class"
                      name="class"
                      value={form.class || 'FY'}
                      onChange={change}
                      className={`input ${errors.class ? 'input-error' : ''}`}
                    >
                      <option value="FY">FY (1st Year)</option>
                      <option value="SY">SY (2nd Year)</option>
                      <option value="TY">TY (3rd Year)</option>
                    </select>
                    {errors.class && <p className="text-brand-danger text-xs mt-1">{errors.class}</p>}
                  </div>

                  <div>
                    <label htmlFor="reg-division" className="label">Division</label>
                    <select
                      id="reg-division"
                      name="division"
                      value={form.division || 'A'}
                      onChange={change}
                      className={`input ${errors.division ? 'input-error' : ''}`}
                    >
                      <option value="A">Division A</option>
                      <option value="B">Division B</option>
                      <option value="C">Division C</option>
                    </select>
                    {errors.division && <p className="text-brand-danger text-xs mt-1">{errors.division}</p>}
                  </div>
                </div>

                {currentCourseDivisions.length > 0 && (
                  <div className="text-[11px] text-brand-muted bg-brand-dark/40 px-3 py-1.5 rounded-lg border border-brand-border/40">
                    Linked Cohort: <span className="text-white font-medium">{form.class}{selectedCourse?.code || ''} - Div {form.division}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <FieldInput
                    id="reg-emp-id" label="Employee ID" name="employee_id"
                    placeholder="TCH-1001" value={form.employee_id || ''}
                    onChange={change} error={errors.employee_id}
                  />
                  <div>
                    <label htmlFor="reg-dept" className="label">Department</label>
                    <select
                      id="reg-dept" name="department"
                      value={form.department || ''} onChange={change}
                      className={`input ${errors.department ? 'input-error' : ''}`}
                    >
                      <option value="">Select dept.</option>
                      {TEACHER_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    {errors.department && <p className="text-brand-danger text-xs mt-1">{errors.department}</p>}
                  </div>
                </div>

                <FieldInput
                  id="reg-designation" label="Designation" name="designation"
                  placeholder="e.g. Assistant Professor / Head of Department" value={form.designation || ''}
                  onChange={change} error={errors.designation} optional
                />
              </div>
            )}

            {/* Password */}
            <div>
              <label htmlFor="reg-password" className="label">Password</label>
              <div className="relative">
                <input
                  id="reg-password" name="password" type={show ? 'text' : 'password'}
                  placeholder="Min 8 characters" autoComplete="new-password"
                  value={form.password || ''} onChange={change}
                  className={`input pr-11 ${errors.password ? 'input-error' : ''}`}
                />
                <button type="button" id="toggle-reg-password"
                  onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-white transition-colors">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-brand-danger text-xs mt-1">{errors.password}</p>}
            </div>

            <div>
              <label htmlFor="reg-confirm" className="label">Confirm Password</label>
              <input
                id="reg-confirm" name="confirm_password" type={show ? 'text' : 'password'}
                placeholder="Re-enter password" autoComplete="new-password"
                value={form.confirm_password || ''} onChange={change}
                className={`input ${errors.confirm_password ? 'input-error' : ''}`}
              />
              {errors.confirm_password && <p className="text-brand-danger text-xs mt-1">{errors.confirm_password}</p>}
            </div>

            {/* Teacher note */}
            {role === 'teacher' && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-xs text-yellow-400">
                ⚠️ Teacher accounts require <strong>Admin approval</strong> before you can log in.
              </div>
            )}

            <button
              id="register-submit-btn"
              type="submit"
              disabled={loading || loadingAcademic}
              className="btn-primary w-full btn-lg mt-2"
            >
              {loading ? (
                <><div className="spinner w-4 h-4 border-2" /> Creating account...</>
              ) : (
                <><UserPlus size={18} /> {role === 'student' ? `Create Account (${selectedCourse?.code || 'Student'})` : 'Submit Teacher Application'}</>
              )}
            </button>
          </form>

          <div className="divider mt-6" />
          <p className="text-center text-sm text-brand-muted">
            Already have an account?{' '}
            <Link
              to="/login"
              id="go-to-login"
              state={{
                role,
                selectedCourseId: form.course_id,
                branch: form.branch,
              }}
              className="text-brand-accent hover:underline font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

