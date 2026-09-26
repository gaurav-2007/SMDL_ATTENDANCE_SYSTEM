import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn, GraduationCap, Building2, UserPlus, BookOpen, ShieldCheck, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import api from '../../lib/api'

const DEFAULT_COURSES = [
  { id: '80acc4c6-829f-40a4-ab0b-6cd44032fffc', name: 'B.Sc. Computer Science', code: 'BSC-CS', department: 'Computer Science' },
  { id: '86baa198-736b-481a-b519-177498d5259b', name: 'B.Sc. Information Technology', code: 'BSC-IT', department: 'Information Technology' },
  { id: '61429f5e-c954-4992-bdf6-a2bbfafe1d0a', name: 'Bachelor of Commerce', code: 'BCOM', department: 'Commerce' },
  { id: '47997f9f-bff3-4f17-a88f-8a46086fcd53', name: 'B.Com Accounting & Finance', code: 'BAF', department: 'Accounting & Finance' },
]

export default function LoginPage() {
  const { login, register, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // State: Role selector
  const [activeRole, setActiveRole] = useState(location.state?.role || 'student')
  // State: For student portal, toggle between 'login' and 'create-account'
  const [studentMode, setStudentMode] = useState(location.state?.mode || 'login')

  // Courses / Branches from API
  const [courses, setCourses] = useState(DEFAULT_COURSES)
  const [selectedCourseId, setSelectedCourseId] = useState(
    location.state?.selectedCourseId || DEFAULT_COURSES[0].id
  )

  // Login form state
  const [loginForm, setLoginForm] = useState({
    identifier: location.state?.prefillEmail || '',
    password: '',
  })

  // Student Quick Registration Form state
  const [regForm, setRegForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    roll_number: '',
    class: 'FY',
    division: 'A',
    password: '',
    confirm_password: '',
  })

  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  // If already logged in, redirect declaratively
  if (user) {
    if (user.role === 'teacher' && user.account_status === 'PENDING') {
      return <Navigate to="/pending-approval" replace />
    }
    const roleMap = { admin: '/admin', teacher: '/teacher', student: '/student' }
    return <Navigate to={roleMap[user.role] || '/'} replace />
  }

  const from = location.state?.from?.pathname || null

  // Fetch live courses on mount
  useEffect(() => {
    let mounted = true
    async function fetchCourses() {
      try {
        const { data } = await api.get('/academic/courses')
        if (mounted && data.data?.courses?.length > 0) {
          setCourses(data.data.courses)
          if (!location.state?.selectedCourseId) {
            setSelectedCourseId(data.data.courses[0].id)
          }
        }
      } catch (_err) {
        // use fallback DEFAULT_COURSES
      }
    }
    fetchCourses()
    return () => { mounted = false }
  }, [location.state])

  const selectedCourse = courses.find(c => c.id === selectedCourseId) || courses[0] || DEFAULT_COURSES[0]

  // Validate Login Form
  function validateLogin() {
    const e = {}
    const iden = (loginForm.identifier || '').trim()
    const pwd = (loginForm.password || '').trim()
    if (!iden) {
      e.identifier = activeRole === 'student'
        ? 'Roll number or email required'
        : 'Email or ID required'
    }
    if (!pwd) e.password = 'Password required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // Handle Login submission
  async function handleLoginSubmit(e) {
    if (e) e.preventDefault()
    if (!validateLogin()) return
    setLoading(true)
    try {
      let identifier = (loginForm.identifier || '').trim()
      if (identifier.toLowerCase() === 'admin') {
        identifier = 'admin@smdl.ac.in'
      }
      const password = (loginForm.password || '').trim()

      const loggedUser = await login(identifier, password, {
        course_id: activeRole === 'student' ? selectedCourse.id : undefined,
        branch: activeRole === 'student' ? selectedCourse.name : undefined,
      })

      toast.success(`Welcome back, ${loggedUser?.name || 'User'}!`)
      const roleMap = { admin: '/admin', teacher: '/teacher', student: '/student' }
      if (loggedUser?.role === 'teacher' && loggedUser?.account_status === 'PENDING') {
        navigate('/pending-approval', { replace: true })
      } else {
        navigate(from || roleMap[loggedUser?.role] || '/', { replace: true })
      }
    } catch (err) {
      console.error('Login error:', err)
      const msg = !err.response
        ? 'Cannot connect to backend server. Make sure port 5000 is running.'
        : (err.response?.data?.message || 'Login failed. Check credentials.')
      toast.error(msg)
      if (err.response?.status === 401) {
        setErrors({ password: 'Invalid credentials. Check roll number/email & password.' })
      }
    } finally {
      setLoading(false)
    }
  }

  // Validate Student Registration
  function validateRegister() {
    const e = {}
    if (!regForm.full_name?.trim()) e.full_name = 'Full name required'
    if (!regForm.roll_number?.trim()) e.roll_number = 'Roll number required'
    if (!regForm.email?.trim()) e.email = 'Email required'
    else if (!/\S+@\S+\.\S+/.test(regForm.email)) e.email = 'Invalid email'
    if (!regForm.phone?.trim()) e.phone = 'Phone required'
    if (!regForm.password) e.password = 'Password required'
    else if (regForm.password.length < 8) e.password = 'Min 8 characters'
    if (regForm.password !== regForm.confirm_password) e.confirm_password = 'Passwords do not match'

    setErrors(e)
    return Object.keys(e).length === 0
  }

  // Handle Student Registration submission
  async function handleRegisterSubmit(e) {
    if (e) e.preventDefault()
    if (!validateRegister()) return
    setLoading(true)
    try {
      const payload = {
        name: regForm.full_name?.trim(),
        full_name: regForm.full_name?.trim(),
        email: regForm.email?.trim().toLowerCase(),
        phone: regForm.phone?.trim(),
        roll_number: regForm.roll_number?.trim(),
        course_id: selectedCourse.id,
        branch: selectedCourse.name,
        department: selectedCourse.name,
        class: regForm.class,
        division: regForm.division,
        password: regForm.password,
      }

      await register('student', payload)
      toast.success(`Account created for ${selectedCourse.name}! Logging you in...`)

      // Immediately log in with new credentials
      const loggedUser = await login(payload.roll_number, payload.password)
      navigate('/student', { replace: true })
    } catch (err) {
      console.error('Registration error:', err)
      const msg = err.response?.data?.message || err.message || 'Registration failed'
      toast.error(msg)
      if (msg.toLowerCase().includes('email')) setErrors(p => ({ ...p, email: msg }))
      if (msg.toLowerCase().includes('roll')) setErrors(p => ({ ...p, roll_number: msg }))
    } finally {
      setLoading(false)
    }
  }

  // Instant 1-Click Admin Login
  async function quickAdminLogin() {
    setLoading(true)
    try {
      const loggedUser = await login('admin@smdl.ac.in', 'admin@123')
      toast.success(`Welcome back, ${loggedUser?.name || 'SMDL Admin'}!`)
      navigate('/admin', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Admin login failed')
    } finally {
      setLoading(false)
    }
  }

  // Dynamic roll placeholder based on selected course
  const rollPlaceholder = selectedCourse?.code
    ? `${selectedCourse.code.replace('BSC-', '')}-2026-001`
    : 'CS-2024-001'

  return (
    <div className="min-h-screen bg-brand-dark bg-dot-pattern flex items-center justify-center p-4 py-8">
      {/* Glow background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary-700/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-brand-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg animate-slide-up">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-brand shadow-xl shadow-primary-900/50 mb-3">
            <GraduationCap size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">SMDL Attendance</h1>
          <p className="text-brand-muted mt-1 text-sm">SES&apos;s S. M. Dadasaheb Limaye College, Kalamboli</p>
        </div>

        {/* Role Selection Tabs */}
        <div className="flex gap-2 mb-4 bg-brand-card/90 backdrop-blur-md border border-brand-border rounded-2xl p-1.5 shadow-lg">
          {[
            { key: 'student', label: 'Student', icon: BookOpen },
            { key: 'teacher', label: 'Faculty', icon: UserPlus },
            { key: 'admin', label: 'Admin', icon: ShieldCheck },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              id={`tab-role-${key}`}
              onClick={() => {
                setActiveRole(key)
                setErrors({})
                if (key === 'student') {
                  setLoginForm({ identifier: '', password: '' })
                } else if (key === 'admin') {
                  setLoginForm({ identifier: 'admin@smdl.ac.in', password: 'admin@123' })
                } else {
                  setLoginForm({ identifier: '', password: '' })
                }
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeRole === key
                  ? 'bg-gradient-brand text-white shadow-md'
                  : 'text-brand-muted hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Card Body */}
        <div className="card shadow-2xl border-brand-border/80">

          {/* ═══════════════════ STUDENT WORKFLOW ═══════════════════ */}
          {activeRole === 'student' && (
            <div className="space-y-5">

              {/* STEP 1: Choose Branch (Department) */}
              <div className="bg-brand-dark/70 border border-brand-accent/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-brand-accent font-semibold text-sm">
                    <Building2 size={18} />
                    <span>Step 1: Choose Branch (Department)</span>
                  </div>
                  <span className="badge badge-primary text-xs font-mono font-bold">
                    {selectedCourse.code || 'BRANCH'}
                  </span>
                </div>

                <select
                  id="student-branch-select"
                  value={selectedCourseId}
                  onChange={e => {
                    setSelectedCourseId(e.target.value)
                    setErrors({})
                  }}
                  className="input font-semibold text-sm text-white bg-slate-900 border-brand-accent/40 focus:border-brand-accent"
                >
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code || 'Dept'})
                    </option>
                  ))}
                </select>

                {/* Quick Branch Switch Chips */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {courses.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      id={`chip-course-${c.code || c.id}`}
                      onClick={() => {
                        setSelectedCourseId(c.id)
                        setErrors({})
                      }}
                      className={`text-xs px-3 py-1 rounded-lg font-medium transition-all ${
                        selectedCourseId === c.id
                          ? 'bg-brand-accent text-brand-dark font-bold shadow-md scale-105'
                          : 'bg-slate-800/80 text-brand-muted hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      {c.code || c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* STEP 2: Sub-tabs: Sign In vs Create Account */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-brand-border/60 pb-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
                    Step 2: Access Your Branch
                  </div>
                  <div className="flex gap-1 bg-brand-dark/60 p-1 rounded-xl border border-brand-border/40">
                    <button
                      type="button"
                      id="student-subtab-login"
                      onClick={() => {
                        setStudentMode('login')
                        setErrors({})
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        studentMode === 'login'
                          ? 'bg-brand-accent text-brand-dark shadow-sm'
                          : 'text-brand-muted hover:text-white'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      id="student-subtab-create"
                      onClick={() => {
                        setStudentMode('create')
                        setErrors({})
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        studentMode === 'create'
                          ? 'bg-brand-accent text-brand-dark shadow-sm'
                          : 'text-brand-muted hover:text-white'
                      }`}
                    >
                      Create Account
                    </button>
                  </div>
                </div>

                {/* ── Mode A: Student Sign In ── */}
                {studentMode === 'login' && (
                  <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
                    <div>
                      <label htmlFor="student-login-identifier" className="label">
                        Student Roll No. or Email
                      </label>
                      <input
                        id="student-login-identifier"
                        type="text"
                        autoComplete="username"
                        placeholder={`e.g. ${rollPlaceholder} or student@smdl.ac.in`}
                        value={loginForm.identifier}
                        onChange={e => setLoginForm(p => ({ ...p, identifier: e.target.value }))}
                        className={`input ${errors.identifier ? 'input-error' : ''}`}
                      />
                      {errors.identifier && <p className="text-brand-danger text-xs mt-1">{errors.identifier}</p>}
                    </div>

                    <div>
                      <label htmlFor="student-login-password" className="label">Password</label>
                      <div className="relative">
                        <input
                          id="student-login-password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder="••••••••"
                          value={loginForm.password}
                          onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                          className={`input pr-11 ${errors.password ? 'input-error' : ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(s => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {errors.password && <p className="text-brand-danger text-xs mt-1">{errors.password}</p>}
                    </div>

                    <button
                      id="student-login-btn"
                      type="submit"
                      disabled={loading}
                      className="btn-primary w-full btn-lg mt-2"
                    >
                      {loading ? (
                        <><div className="spinner w-4 h-4 border-2" /> Signing in...</>
                      ) : (
                        <><LogIn size={18} /> Sign In to {selectedCourse.code || 'Student'}</>
                      )}
                    </button>

                    <div className="text-center pt-2">
                      <p className="text-xs text-brand-muted">
                        Don&apos;t have an account yet?{' '}
                        <button
                          type="button"
                          id="link-switch-create-account"
                          onClick={() => {
                            setStudentMode('create')
                            setErrors({})
                          }}
                          className="text-brand-accent hover:underline font-semibold"
                        >
                          Create {selectedCourse.code || 'Student'} Account
                        </button>
                      </p>
                    </div>
                  </form>
                )}

                {/* ── Mode B: Student Create Account ── */}
                {studentMode === 'create' && (
                  <form onSubmit={handleRegisterSubmit} noValidate className="space-y-3.5">
                    <div className="bg-brand-accent/10 border border-brand-accent/25 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
                      <span className="text-white font-medium">
                        Registering for: <span className="text-brand-accent font-bold">{selectedCourse.name}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => document.getElementById('student-branch-select')?.focus()}
                        className="text-[11px] text-brand-accent underline hover:text-white"
                      >
                        Change
                      </button>
                    </div>

                    <div>
                      <label htmlFor="reg-quick-name" className="label">Full Name</label>
                      <input
                        id="reg-quick-name"
                        type="text"
                        placeholder="e.g. Rahul Sharma"
                        value={regForm.full_name}
                        onChange={e => setRegForm(p => ({ ...p, full_name: e.target.value }))}
                        className={`input ${errors.full_name ? 'input-error' : ''}`}
                      />
                      {errors.full_name && <p className="text-brand-danger text-xs mt-1">{errors.full_name}</p>}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label htmlFor="reg-quick-roll" className="label">Roll No.</label>
                        <input
                          id="reg-quick-roll"
                          type="text"
                          placeholder={rollPlaceholder}
                          value={regForm.roll_number}
                          onChange={e => setRegForm(p => ({ ...p, roll_number: e.target.value }))}
                          className={`input ${errors.roll_number ? 'input-error' : ''}`}
                        />
                        {errors.roll_number && <p className="text-brand-danger text-xs mt-1">{errors.roll_number}</p>}
                      </div>

                      <div>
                        <label htmlFor="reg-quick-class" className="label">Class</label>
                        <select
                          id="reg-quick-class"
                          value={regForm.class}
                          onChange={e => setRegForm(p => ({ ...p, class: e.target.value }))}
                          className="input"
                        >
                          <option value="FY">FY</option>
                          <option value="SY">SY</option>
                          <option value="TY">TY</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="reg-quick-div" className="label">Division</label>
                        <select
                          id="reg-quick-div"
                          value={regForm.division}
                          onChange={e => setRegForm(p => ({ ...p, division: e.target.value }))}
                          className="input"
                        >
                          <option value="A">Div A</option>
                          <option value="B">Div B</option>
                          <option value="C">Div C</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="reg-quick-email" className="label">Email</label>
                        <input
                          id="reg-quick-email"
                          type="email"
                          placeholder="student@smdl.ac.in"
                          value={regForm.email}
                          onChange={e => setRegForm(p => ({ ...p, email: e.target.value }))}
                          className={`input ${errors.email ? 'input-error' : ''}`}
                        />
                        {errors.email && <p className="text-brand-danger text-xs mt-1">{errors.email}</p>}
                      </div>

                      <div>
                        <label htmlFor="reg-quick-phone" className="label">Mobile</label>
                        <input
                          id="reg-quick-phone"
                          type="tel"
                          placeholder="10-digit number"
                          value={regForm.phone}
                          onChange={e => setRegForm(p => ({ ...p, phone: e.target.value }))}
                          className={`input ${errors.phone ? 'input-error' : ''}`}
                        />
                        {errors.phone && <p className="text-brand-danger text-xs mt-1">{errors.phone}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="reg-quick-pwd" className="label">Password</label>
                        <input
                          id="reg-quick-pwd"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Min 8 chars"
                          value={regForm.password}
                          onChange={e => setRegForm(p => ({ ...p, password: e.target.value }))}
                          className={`input ${errors.password ? 'input-error' : ''}`}
                        />
                        {errors.password && <p className="text-brand-danger text-xs mt-1">{errors.password}</p>}
                      </div>

                      <div>
                        <label htmlFor="reg-quick-confirm" className="label">Confirm</label>
                        <input
                          id="reg-quick-confirm"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Repeat"
                          value={regForm.confirm_password}
                          onChange={e => setRegForm(p => ({ ...p, confirm_password: e.target.value }))}
                          className={`input ${errors.confirm_password ? 'input-error' : ''}`}
                        />
                        {errors.confirm_password && <p className="text-brand-danger text-xs mt-1">{errors.confirm_password}</p>}
                      </div>
                    </div>

                    <button
                      id="student-create-account-btn"
                      type="submit"
                      disabled={loading}
                      className="btn-primary w-full btn-lg mt-2"
                    >
                      {loading ? (
                        <><div className="spinner w-4 h-4 border-2" /> Creating account...</>
                      ) : (
                        <><UserPlus size={18} /> Create {selectedCourse.code || 'Student'} Account</>
                      )}
                    </button>

                    <div className="text-center pt-1">
                      <p className="text-xs text-brand-muted">
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setStudentMode('login')
                            setErrors({})
                          }}
                          className="text-brand-accent hover:underline font-semibold"
                        >
                          Sign In here
                        </button>
                      </p>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════ FACULTY / TEACHER WORKFLOW ═══════════════════ */}
          {activeRole === 'teacher' && (
            <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
              <div className="text-xs text-brand-muted bg-brand-dark/50 p-3 rounded-xl border border-brand-border/60">
                👨‍🏫 Faculty Portal: Login with your registered email or Employee ID.
              </div>

              <div>
                <label htmlFor="teacher-login-id" className="label">Email or Employee ID</label>
                <input
                  id="teacher-login-id"
                  type="text"
                  placeholder="e.g. TCH-1001 or faculty@smdl.ac.in"
                  value={loginForm.identifier}
                  onChange={e => setLoginForm(p => ({ ...p, identifier: e.target.value }))}
                  className={`input ${errors.identifier ? 'input-error' : ''}`}
                />
                {errors.identifier && <p className="text-brand-danger text-xs mt-1">{errors.identifier}</p>}
              </div>

              <div>
                <label htmlFor="teacher-login-pwd" className="label">Password</label>
                <div className="relative">
                  <input
                    id="teacher-login-pwd"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={loginForm.password}
                    onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                    className={`input pr-11 ${errors.password ? 'input-error' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="text-brand-danger text-xs mt-1">{errors.password}</p>}
              </div>

              <button
                id="teacher-login-btn"
                type="submit"
                disabled={loading}
                className="btn-primary w-full btn-lg"
              >
                {loading ? (
                  <><div className="spinner w-4 h-4 border-2" /> Signing in...</>
                ) : (
                  <><LogIn size={18} /> Sign In as Faculty</>
                )}
              </button>

              <div className="divider mt-4" />
              <p className="text-center text-xs text-brand-muted">
                New Faculty Member?{' '}
                <Link
                  to="/register"
                  state={{ role: 'teacher' }}
                  className="text-brand-accent hover:underline font-medium"
                >
                  Submit Teacher Application
                </Link>
              </p>
            </form>
          )}

          {/* ═══════════════════ ADMIN WORKFLOW ═══════════════════ */}
          {activeRole === 'admin' && (
            <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
              <div className="text-xs text-brand-muted bg-brand-dark/50 p-3 rounded-xl border border-brand-border/60">
                🛡️ Administrator Portal: Full control over timetable, classes & records.
              </div>

              <div>
                <label htmlFor="admin-login-email" className="label">Admin Email</label>
                <input
                  id="admin-login-email"
                  type="email"
                  placeholder="admin@smdl.ac.in"
                  value={loginForm.identifier}
                  onChange={e => setLoginForm(p => ({ ...p, identifier: e.target.value }))}
                  className={`input ${errors.identifier ? 'input-error' : ''}`}
                />
                {errors.identifier && <p className="text-brand-danger text-xs mt-1">{errors.identifier}</p>}
              </div>

              <div>
                <label htmlFor="admin-login-pwd" className="label">Password</label>
                <div className="relative">
                  <input
                    id="admin-login-pwd"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={loginForm.password}
                    onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                    className={`input pr-11 ${errors.password ? 'input-error' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="text-brand-danger text-xs mt-1">{errors.password}</p>}
              </div>

              <button
                id="admin-login-btn"
                type="submit"
                disabled={loading}
                className="btn-primary w-full btn-lg"
              >
                {loading ? (
                  <><div className="spinner w-4 h-4 border-2" /> Signing in...</>
                ) : (
                  <><LogIn size={18} /> Sign In as Administrator</>
                )}
              </button>

              <button
                type="button"
                id="quick-admin-login-btn"
                onClick={quickAdminLogin}
                disabled={loading}
                className="btn-secondary w-full text-xs py-2 mt-2"
              >
                ⚡ 1-Click Instant Admin Login
              </button>
            </form>
          )}

        </div>

        {/* Quick Demo Credentials Footer Card */}
        <div className="mt-4 card-sm border border-brand-accent/20 bg-brand-accent/5 p-3.5 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-white text-xs flex items-center gap-1.5">
              <span>⚡</span> Quick Testing Accounts
            </p>
            <span className="text-[10px] text-brand-accent bg-brand-accent/15 px-2 py-0.5 rounded-full font-medium">
              Ready to test
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => {
                setActiveRole('student')
                setStudentMode('login')
                setSelectedCourseId(courses[0]?.id || DEFAULT_COURSES[0].id)
                setLoginForm({ identifier: 'CS-2024-001', password: 'password123' })
                setErrors({})
                toast.success('Auto-filled Demo Student (Aarav - BSC CS)!')
              }}
              className="text-left bg-brand-dark/70 p-2 rounded-lg border border-brand-border/60 hover:border-brand-accent/50 transition-colors"
            >
              <p className="font-semibold text-white">Student Demo</p>
              <p className="text-brand-muted">Roll: <span className="text-brand-accent font-mono">CS-2024-001</span></p>
            </button>

            <button
              type="button"
              onClick={quickAdminLogin}
              className="text-left bg-brand-dark/70 p-2 rounded-lg border border-brand-border/60 hover:border-brand-accent/50 transition-colors"
            >
              <p className="font-semibold text-white">Admin Demo</p>
              <p className="text-brand-muted"><span className="text-brand-accent font-mono">admin@smdl.ac.in</span></p>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

