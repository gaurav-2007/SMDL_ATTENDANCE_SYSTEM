import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  LogIn,
  GraduationCap,
  Building2,
  UserPlus,
  BookOpen,
  ShieldCheck,
  Check,
  Mail,
  ArrowLeft,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Edit3
} from 'lucide-react'
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

export default function LoginPage() {
  const { login, register, sendOtp, verifyOtp, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // State: Role selector ('student' | 'teacher' | 'admin')
  const [activeRole, setActiveRole] = useState(location.state?.role || 'student')
  // Sub-tab toggles: 'login' vs 'create'
  const [studentMode, setStudentMode] = useState(location.state?.mode || 'login')
  const [teacherMode, setTeacherMode] = useState('login')

  // Live Courses / Branches from API
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

  // Teacher Registration Form state
  const [teacherRegForm, setTeacherRegForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    employee_id: '',
    department: '',
    designation: '',
    password: '',
    confirm_password: '',
  })

  // In-place OTP Verification state
  const [otpStep, setOtpStep] = useState(false)
  const [otpEmail, setOtpEmail] = useState('')
  const [otpRole, setOtpRole] = useState('student') // 'student' | 'teacher'
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const [cachedPayload, setCachedPayload] = useState(null)
  const otpInputsRef = useRef([])

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

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval = null
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(t => (t > 0 ? t - 1 : 0))
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [resendTimer])

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
      const extra = activeRole === 'student'
        ? { branch: selectedCourse.name, course_id: selectedCourse.id }
        : {}

      const loggedUser = await login(loginForm.identifier.trim(), loginForm.password, extra)

      toast.success(`Welcome back, ${loggedUser?.name || 'User'}!`)

      if (loggedUser.role === 'admin') {
        navigate('/admin', { replace: true })
      } else if (loggedUser.role === 'teacher') {
        if (loggedUser.account_status === 'PENDING') {
          navigate('/pending-approval', { replace: true })
        } else {
          navigate('/teacher', { replace: true })
        }
      } else {
        navigate('/student', { replace: true })
      }
    } catch (err) {
      console.error('Login error:', err)
      const msg = err.response?.data?.message || err.message || 'Login failed. Check your credentials.'
      toast.error(msg)
      if (err.response?.status === 401) {
        setErrors({ password: 'Invalid credentials. Check roll number/email & password.' })
      }
    } finally {
      setLoading(false)
    }
  }

  // Validate Student Registration Form
  function validateStudentRegister() {
    const e = {}
    if (!regForm.full_name?.trim()) e.full_name = 'Full name required'
    if (!regForm.roll_number?.trim()) e.roll_number = 'Roll number required'
    if (!regForm.email?.trim()) e.email = 'Email required'
    else if (!/\S+@\S+\.\S+/.test(regForm.email)) e.email = 'Valid email address required'
    if (!regForm.phone?.trim()) e.phone = 'Phone number required'
    if (!regForm.password) e.password = 'Password required'
    else if (regForm.password.length < 8) e.password = 'Min 8 characters'
    if (regForm.password !== regForm.confirm_password) e.confirm_password = 'Passwords do not match'

    setErrors(e)
    return Object.keys(e).length === 0
  }

  // Validate Teacher Registration Form
  function validateTeacherRegister() {
    const e = {}
    if (!teacherRegForm.full_name?.trim()) e.full_name = 'Full name required'
    if (!teacherRegForm.employee_id?.trim()) e.employee_id = 'Employee ID required'
    if (!teacherRegForm.department) e.department = 'Department required'
    if (!teacherRegForm.email?.trim()) e.email = 'Email required'
    else if (!/\S+@\S+\.\S+/.test(teacherRegForm.email)) e.email = 'Valid email address required'
    if (!teacherRegForm.phone?.trim()) e.phone = 'Phone number required'
    if (!teacherRegForm.password) e.password = 'Password required'
    else if (teacherRegForm.password.length < 8) e.password = 'Min 8 characters'
    if (teacherRegForm.password !== teacherRegForm.confirm_password) e.confirm_password = 'Passwords do not match'

    setErrors(e)
    return Object.keys(e).length === 0
  }

  // Step 1 for Student: Validate & Send Real OTP
  async function handleStudentProceedToOtp(e) {
    if (e) e.preventDefault()
    if (!validateStudentRegister()) return
    setLoading(true)
    setOtpError('')

    const email = regForm.email.trim().toLowerCase()
    try {
      await sendOtp(email, 'student', {
        roll_number: regForm.roll_number.trim(),
      })

      const payload = {
        name: regForm.full_name?.trim(),
        full_name: regForm.full_name?.trim(),
        email,
        phone: regForm.phone?.trim(),
        roll_number: regForm.roll_number?.trim(),
        course_id: selectedCourse.id,
        branch: selectedCourse.name,
        department: selectedCourse.name,
        class: regForm.class,
        division: regForm.division,
        password: regForm.password,
      }

      setCachedPayload(payload)
      setOtpEmail(email)
      setOtpRole('student')
      setResendTimer(45)
      setOtpDigits(['', '', '', '', '', ''])
      setOtpStep(true)
      toast.success(`Verification code sent to ${email}. Check your Gmail inbox!`)

      setTimeout(() => {
        otpInputsRef.current[0]?.focus()
      }, 100)
    } catch (err) {
      console.error('Send OTP error:', err)
      const msg = err.response?.data?.message || err.message || 'Failed to send OTP.'
      toast.error(msg)
      if (msg.toLowerCase().includes('email')) setErrors(p => ({ ...p, email: msg }))
      if (msg.toLowerCase().includes('roll')) setErrors(p => ({ ...p, roll_number: msg }))
    } finally {
      setLoading(false)
    }
  }

  // Step 1 for Teacher: Validate & Send Real OTP
  async function handleTeacherProceedToOtp(e) {
    if (e) e.preventDefault()
    if (!validateTeacherRegister()) return
    setLoading(true)
    setOtpError('')

    const email = teacherRegForm.email.trim().toLowerCase()
    try {
      await sendOtp(email, 'teacher', {
        employee_id: teacherRegForm.employee_id.trim(),
      })

      const payload = {
        name: teacherRegForm.full_name?.trim(),
        full_name: teacherRegForm.full_name?.trim(),
        email,
        phone: teacherRegForm.phone?.trim(),
        employee_id: teacherRegForm.employee_id?.trim(),
        department: teacherRegForm.department,
        designation: teacherRegForm.designation?.trim() || undefined,
        password: teacherRegForm.password,
      }

      setCachedPayload(payload)
      setOtpEmail(email)
      setOtpRole('teacher')
      setResendTimer(45)
      setOtpDigits(['', '', '', '', '', ''])
      setOtpStep(true)
      toast.success(`Verification code sent to ${email}. Check your Gmail inbox!`)

      setTimeout(() => {
        otpInputsRef.current[0]?.focus()
      }, 100)
    } catch (err) {
      console.error('Send OTP error:', err)
      const msg = err.response?.data?.message || err.message || 'Failed to send OTP.'
      toast.error(msg)
      if (msg.toLowerCase().includes('email')) setErrors(p => ({ ...p, email: msg }))
      if (msg.toLowerCase().includes('employee')) setErrors(p => ({ ...p, employee_id: msg }))
    } finally {
      setLoading(false)
    }
  }

  // Resend OTP in modal
  async function handleResendOtp() {
    if (resendTimer > 0 || otpLoading) return
    setOtpLoading(true)
    setOtpError('')
    try {
      const extra = otpRole === 'student'
        ? { roll_number: cachedPayload?.roll_number }
        : { employee_id: cachedPayload?.employee_id }

      await sendOtp(otpEmail, otpRole, extra)
      setResendTimer(45)
      toast.success('A fresh OTP has been sent to your Gmail inbox.')
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to resend code.'
      toast.error(msg)
      setOtpError(msg)
    } finally {
      setOtpLoading(false)
    }
  }

  // Handle OTP digit box input
  function handleOtpChange(index, value) {
    const clean = value.replace(/\D/g, '')
    const newDigits = [...otpDigits]

    // Handle pasting the full code
    if (clean.length > 1) {
      const pasted = clean.slice(0, 6).split('')
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || ''
      }
      setOtpDigits(newDigits)
      setOtpError('')
      const nextIdx = Math.min(pasted.length, 5)
      otpInputsRef.current[nextIdx]?.focus()
      return
    }

    newDigits[index] = clean.slice(-1)
    setOtpDigits(newDigits)
    setOtpError('')

    if (clean && index < 5) {
      otpInputsRef.current[index + 1]?.focus()
    }
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus()
    }
  }

  // Step 2: Verify OTP and finalize Registration
  async function handleVerifyAndRegister(e) {
    if (e) e.preventDefault()
    const enteredCode = otpDigits.join('').trim()
    if (enteredCode.length !== 6) {
      setOtpError('Please enter the full 6-digit verification code.')
      return
    }

    setOtpLoading(true)
    setOtpError('')

    try {
      // 1. Verify OTP with server
      const vRes = await verifyOtp(otpEmail, enteredCode)
      const token = vRes?.data?.otp_token

      // 2. Submit user registration with verified token & otp
      const finalPayload = {
        ...cachedPayload,
        otp: enteredCode,
        otp_token: token,
      }

      await register(otpRole, finalPayload)

      if (otpRole === 'student') {
        toast.success(`Email verified! Account created for ${selectedCourse.name}. Logging you in...`)
        // Auto log in with newly verified credentials
        await login(cachedPayload.roll_number, cachedPayload.password)
        navigate('/student', { replace: true })
      } else {
        toast.success('Email verified! Teacher application submitted. Wait for Admin approval.', { duration: 6500 })
        setOtpStep(false)
        setTeacherMode('login')
        setLoginForm({ identifier: cachedPayload.email, password: '' })
      }
    } catch (err) {
      console.error('Registration/OTP error:', err)
      const msg = err.response?.data?.message || err.message || 'Verification failed. Please check the code.'
      setOtpError(msg)
      toast.error(msg)
    } finally {
      setOtpLoading(false)
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
    <div className="min-h-screen bg-brand-dark bg-dot-pattern flex items-center justify-center p-4 py-8 relative overflow-hidden">
      {/* Glow background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary-700/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-brand-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg animate-slide-up">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-brand shadow-xl shadow-primary-900/50 mb-3 transition-transform hover:scale-105">
            {otpStep ? (
              <ShieldCheck size={32} className="text-white" />
            ) : (
              <GraduationCap size={32} className="text-white" />
            )}
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            {otpStep ? 'Email Verification' : 'SMDL Attendance'}
          </h1>
          <p className="text-brand-muted mt-1 text-sm font-medium">SES&apos;s S. M. Dadasaheb Limaye College, Kalamboli</p>
        </div>

        {/* ── INLINE OTP VERIFICATION STEP ── */}
        {otpStep ? (
          <div className="card shadow-2xl border-brand-border/90 p-6 sm:p-8 animate-slide-up">
            <button
              type="button"
              id="back-to-form-btn"
              onClick={() => {
                setOtpStep(false)
                setOtpError('')
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-muted hover:text-white transition-colors mb-4"
            >
              <ArrowLeft size={14} /> Back to Edit Details
            </button>

            <div className="bg-brand-dark/70 border border-brand-border rounded-2xl p-4 text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-600/20 border border-primary-500/30 text-primary-400 mb-2">
                <Mail size={22} />
              </div>
              <p className="text-xs text-brand-muted">A 6-digit verification code has been sent to</p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-base font-bold text-white tracking-wide">{otpEmail}</span>
                <button
                  type="button"
                  onClick={() => setOtpStep(false)}
                  title="Change email"
                  className="text-brand-accent hover:text-sky-300 p-1"
                >
                  <Edit3 size={14} />
                </button>
              </div>
              <p className="text-[11px] text-brand-muted mt-1.5">
                Role: <span className="capitalize font-semibold text-sky-400">{otpRole}</span> &bull; Valid for 10 minutes
              </p>
            </div>

            <form onSubmit={handleVerifyAndRegister} className="space-y-6">
              <div>
                <label className="label text-center block mb-3 font-semibold text-white">
                  Enter 6-Digit Verification Code
                </label>

                <div className="flex justify-center gap-2 sm:gap-3">
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={el => (otpInputsRef.current[index] = el)}
                      id={`otp-input-${index}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={digit}
                      onChange={e => handleOtpChange(index, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(index, e)}
                      autoComplete="one-time-code"
                      className={`w-11 h-13 sm:w-13 sm:h-15 text-center text-xl sm:text-2xl font-bold font-mono rounded-xl bg-brand-dark/80 border text-white transition-all shadow-inner focus:outline-none ${
                        otpError
                          ? 'border-brand-danger focus:ring-2 focus:ring-brand-danger/40'
                          : digit
                          ? 'border-primary-500 bg-primary-950/20 text-sky-300 ring-1 ring-primary-500/50'
                          : 'border-brand-border focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30'
                      }`}
                    />
                  ))}
                </div>

                {otpError && (
                  <p className="text-brand-danger text-xs text-center mt-2.5 flex items-center justify-center gap-1 font-medium">
                    <AlertCircle size={14} /> {otpError}
                  </p>
                )}
              </div>

              <div className="text-center text-xs">
                {resendTimer > 0 ? (
                  <span className="text-brand-muted">
                    Didn&apos;t get the code? Resend in{' '}
                    <span className="text-white font-mono font-semibold">{resendTimer}s</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    id="resend-otp-btn"
                    disabled={otpLoading}
                    onClick={handleResendOtp}
                    className="inline-flex items-center gap-1.5 text-brand-accent hover:underline font-semibold"
                  >
                    <RotateCw size={13} className={otpLoading ? 'animate-spin' : ''} />
                    Resend Verification Code
                  </button>
                )}
              </div>

              <button
                id="verify-otp-submit-btn"
                type="submit"
                disabled={otpLoading || otpDigits.join('').length !== 6}
                className="btn-primary w-full btn-lg font-bold shadow-lg shadow-primary-900/40"
              >
                {otpLoading ? (
                  <>
                    <div className="spinner w-4 h-4 border-2" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Verify &amp; Complete Registration</span>
                  </>
                )}
              </button>
            </form>

            <div className="divider mt-6" />
            <p className="text-center text-xs text-brand-muted">
              Check your Gmail inbox and Spam/Junk folder for the OTP code.
            </p>
          </div>
        ) : (
          <>
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
                          <div className="flex items-center justify-between mb-1">
                            <label htmlFor="student-login-password" className="label mb-0">Password</label>
                            <Link
                              to="/forgot-password"
                              className="text-xs text-brand-accent hover:underline font-medium"
                            >
                              Forgot Password?
                            </Link>
                          </div>
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

                    {/* ── Mode B: Student Create Account (with Real Email OTP) ── */}
                    {studentMode === 'create' && (
                      <form onSubmit={handleStudentProceedToOtp} noValidate className="space-y-3.5">
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
                          <label htmlFor="reg-quick-fullname" className="label">Full Name</label>
                          <input
                            id="reg-quick-fullname"
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
                            <label htmlFor="reg-quick-roll" className="label">Roll No</label>
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
                            <label htmlFor="reg-quick-email" className="label">Gmail / Email Address</label>
                            <input
                              id="reg-quick-email"
                              type="email"
                              placeholder="name@gmail.com"
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

                        <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-2.5 text-xs text-sky-300 flex items-center gap-2">
                          <Mail size={16} className="shrink-0 text-sky-400" />
                          <span>We will send a 6-digit OTP verification code to your Gmail address.</span>
                        </div>

                        <button
                          id="student-create-account-btn"
                          type="submit"
                          disabled={loading}
                          className="btn-primary w-full btn-lg mt-2 group"
                        >
                          {loading ? (
                            <><div className="spinner w-4 h-4 border-2" /> Sending OTP to Gmail...</>
                          ) : (
                            <><Mail size={18} className="transition-transform group-hover:scale-110" /> Verify Email &amp; Create Account</>
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
                <div className="space-y-4">
                  {/* Teacher Subtabs: Sign In vs Create Account */}
                  <div className="flex items-center justify-between border-b border-brand-border/60 pb-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
                      Faculty Portal Access
                    </div>
                    <div className="flex gap-1 bg-brand-dark/60 p-1 rounded-xl border border-brand-border/40">
                      <button
                        type="button"
                        id="teacher-subtab-login"
                        onClick={() => {
                          setTeacherMode('login')
                          setErrors({})
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          teacherMode === 'login'
                            ? 'bg-brand-accent text-brand-dark shadow-sm'
                            : 'text-brand-muted hover:text-white'
                        }`}
                      >
                        Sign In
                      </button>
                      <button
                        type="button"
                        id="teacher-subtab-create"
                        onClick={() => {
                          setTeacherMode('create')
                          setErrors({})
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          teacherMode === 'create'
                            ? 'bg-brand-accent text-brand-dark shadow-sm'
                            : 'text-brand-muted hover:text-white'
                        }`}
                      >
                        Create Account
                      </button>
                    </div>
                  </div>

                  {/* ── Mode A: Teacher Sign In ── */}
                  {teacherMode === 'login' && (
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
                        <div className="flex items-center justify-between mb-1">
                          <label htmlFor="teacher-login-pwd" className="label mb-0">Password</label>
                          <Link
                            to="/forgot-password"
                            className="text-xs text-brand-accent hover:underline font-medium"
                          >
                            Forgot Password?
                          </Link>
                        </div>
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
                        <button
                          type="button"
                          onClick={() => {
                            setTeacherMode('create')
                            setErrors({})
                          }}
                          className="text-brand-accent hover:underline font-semibold"
                        >
                          Register / Create Faculty Account
                        </button>
                      </p>
                    </form>
                  )}

                  {/* ── Mode B: Teacher Create Account (with Real Email OTP) ── */}
                  {teacherMode === 'create' && (
                    <form onSubmit={handleTeacherProceedToOtp} noValidate className="space-y-3.5">
                      <div>
                        <label htmlFor="teacher-reg-fullname" className="label">Full Name</label>
                        <input
                          id="teacher-reg-fullname"
                          type="text"
                          placeholder="e.g. Prof. Girish Kumbhar"
                          value={teacherRegForm.full_name}
                          onChange={e => setTeacherRegForm(p => ({ ...p, full_name: e.target.value }))}
                          className={`input ${errors.full_name ? 'input-error' : ''}`}
                        />
                        {errors.full_name && <p className="text-brand-danger text-xs mt-1">{errors.full_name}</p>}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="teacher-reg-empid" className="label">Employee ID</label>
                          <input
                            id="teacher-reg-empid"
                            type="text"
                            placeholder="TCH-1001"
                            value={teacherRegForm.employee_id}
                            onChange={e => setTeacherRegForm(p => ({ ...p, employee_id: e.target.value }))}
                            className={`input ${errors.employee_id ? 'input-error' : ''}`}
                          />
                          {errors.employee_id && <p className="text-brand-danger text-xs mt-1">{errors.employee_id}</p>}
                        </div>

                        <div>
                          <label htmlFor="teacher-reg-dept" className="label">Department</label>
                          <select
                            id="teacher-reg-dept"
                            value={teacherRegForm.department}
                            onChange={e => setTeacherRegForm(p => ({ ...p, department: e.target.value }))}
                            className={`input ${errors.department ? 'input-error' : ''}`}
                          >
                            <option value="">Select Dept</option>
                            {TEACHER_DEPARTMENTS.map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                          {errors.department && <p className="text-brand-danger text-xs mt-1">{errors.department}</p>}
                        </div>
                      </div>

                      <div>
                        <label htmlFor="teacher-reg-desig" className="label">
                          Designation <span className="text-brand-muted text-xs">(optional)</span>
                        </label>
                        <input
                          id="teacher-reg-desig"
                          type="text"
                          placeholder="e.g. Assistant Professor / HOD"
                          value={teacherRegForm.designation}
                          onChange={e => setTeacherRegForm(p => ({ ...p, designation: e.target.value }))}
                          className="input"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="teacher-reg-email" className="label">Gmail / Email</label>
                          <input
                            id="teacher-reg-email"
                            type="email"
                            placeholder="faculty@gmail.com"
                            value={teacherRegForm.email}
                            onChange={e => setTeacherRegForm(p => ({ ...p, email: e.target.value }))}
                            className={`input ${errors.email ? 'input-error' : ''}`}
                          />
                          {errors.email && <p className="text-brand-danger text-xs mt-1">{errors.email}</p>}
                        </div>

                        <div>
                          <label htmlFor="teacher-reg-phone" className="label">Phone</label>
                          <input
                            id="teacher-reg-phone"
                            type="tel"
                            placeholder="9876543210"
                            value={teacherRegForm.phone}
                            onChange={e => setTeacherRegForm(p => ({ ...p, phone: e.target.value }))}
                            className={`input ${errors.phone ? 'input-error' : ''}`}
                          />
                          {errors.phone && <p className="text-brand-danger text-xs mt-1">{errors.phone}</p>}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="teacher-reg-pwd" className="label">Password</label>
                          <input
                            id="teacher-reg-pwd"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Min 8 chars"
                            value={teacherRegForm.password}
                            onChange={e => setTeacherRegForm(p => ({ ...p, password: e.target.value }))}
                            className={`input ${errors.password ? 'input-error' : ''}`}
                          />
                          {errors.password && <p className="text-brand-danger text-xs mt-1">{errors.password}</p>}
                        </div>

                        <div>
                          <label htmlFor="teacher-reg-confirm" className="label">Confirm</label>
                          <input
                            id="teacher-reg-confirm"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Repeat"
                            value={teacherRegForm.confirm_password}
                            onChange={e => setTeacherRegForm(p => ({ ...p, confirm_password: e.target.value }))}
                            className={`input ${errors.confirm_password ? 'input-error' : ''}`}
                          />
                          {errors.confirm_password && <p className="text-brand-danger text-xs mt-1">{errors.confirm_password}</p>}
                        </div>
                      </div>

                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-xs text-amber-300 flex items-start gap-2">
                        <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-400" />
                        <span>Teacher registration requires email verification and admin approval before login.</span>
                      </div>

                      <button
                        id="teacher-create-account-btn"
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full btn-lg mt-2 group"
                      >
                        {loading ? (
                          <><div className="spinner w-4 h-4 border-2" /> Sending OTP to Gmail...</>
                        ) : (
                          <><Mail size={18} className="transition-transform group-hover:scale-110" /> Verify Email &amp; Submit Application</>
                        )}
                      </button>

                      <div className="text-center pt-1">
                        <p className="text-xs text-brand-muted">
                          Already registered?{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setTeacherMode('login')
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
              )}

              {/* ═══════════════════ ADMIN WORKFLOW ═══════════════════ */}
              {activeRole === 'admin' && (
                <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
                  <div className="text-xs text-brand-muted bg-brand-dark/50 p-3 rounded-xl border border-brand-border/60">
                    🛡️ Administrator Portal: Full control over timetable, classes &amp; records.
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
                      <><div className="spinner w-4 h-4 border-2" /> Authenticating...</>
                    ) : (
                      <><LogIn size={18} /> Sign In to Admin Console</>
                    )}
                  </button>

                  <div className="pt-2">
                    <button
                      type="button"
                      id="quick-admin-login-btn"
                      onClick={quickAdminLogin}
                      disabled={loading}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-brand-accent bg-brand-accent/10 border border-brand-accent/30 hover:bg-brand-accent/20 transition-all flex items-center justify-center gap-2"
                    >
                      <span>⚡ 1-Click Demo Admin Login (admin@smdl.ac.in)</span>
                    </button>
                  </div>
                </form>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  )
}
