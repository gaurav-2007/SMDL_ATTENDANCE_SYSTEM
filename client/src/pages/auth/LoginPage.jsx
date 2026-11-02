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
  Mail,
  ArrowLeft,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Wifi,
  Server,
  KeyRound
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Capacitor } from '@capacitor/core'
import { useAuth } from '../../context/AuthContext'
import api, { getBaseURL, setCustomApiUrl, normalizeApiUrl, isPrivateLanHost } from '../../lib/api'
import { Button, Input, Select, Card, Badge, Modal, Tabs } from '../../components/ui'

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
  const { login, logout, register, sendOtp, verifyOtp, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // State: Role selector ('student' | 'teacher' | 'admin')
  const [activeRole, setActiveRole] = useState(location.state?.role || 'student')
  // Sub-tab toggles: 'login' vs 'create'
  const [studentMode, setStudentMode] = useState(location.state?.mode || 'login')
  const [teacherMode, setTeacherMode] = useState('login')

  // Server IP / URL Configuration for Mobile APK & Network
  const [showServerModal, setShowServerModal] = useState(false)
  const [serverUrlInput, setServerUrlInput] = useState(getBaseURL())
  const [testingServer, setTestingServer] = useState(false)

  async function testAndSaveServerUrl(urlToSave) {
    if (!urlToSave?.trim()) {
      toast.error('Please enter a backend API URL')
      return
    }
    setTestingServer(true)
    try {
      const clean = normalizeApiUrl(urlToSave)
      if (!clean) {
        toast.error('Invalid URL format. Example: http://10.226.108.19:5000/api')
        setTestingServer(false)
        return
      }

      const parsed = new URL(clean)
      if (parsed.protocol === 'http:' && !isPrivateLanHost(parsed.hostname)) {
        toast.error('Public URLs must use HTTPS. HTTP is only permitted for local LAN / private IP addresses.')
        setTestingServer(false)
        return
      }

      // Health check probe with 7-second timeout (Requirement 5)
      const res = await axios.get(`${clean}/health`, { timeout: 7000 })
      if (res.data && res.data.success === true) {
        setCustomApiUrl(clean)
        setServerUrlInput(clean)
        toast.success(`Connected to server! (${clean})`)
        setShowServerModal(false)
      } else {
        toast.error('Server responded but health check failed (missing success status)')
      }
    } catch (err) {
      if (err.code === 'ECONNABORTED' || err.message?.toLowerCase().includes('timeout')) {
        toast.error('Connection timed out (7s). Please verify phone and server are on the same Wi-Fi network.')
      } else if (err.response) {
        toast.error(`Server returned HTTP ${err.response.status}: ${err.response.statusText || 'Health check error'}`)
      } else {
        toast.error(`Cannot connect to server: ${err.message || 'Network unreachable'}`)
      }
    } finally {
      setTestingServer(false)
    }
  }

  function handleResetDefaultServer() {
    setCustomApiUrl(null)
    const defaultUrl = getBaseURL()
    setServerUrlInput(defaultUrl || '')
    if (defaultUrl) {
      toast.success(`Reset to default server IP: ${defaultUrl}`)
    } else {
      toast.success('Cleared custom server IP. Please configure an active server.')
    }
    setShowServerModal(false)
  }

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

  // If already logged in, redirect safely via useEffect
  useEffect(() => {
    if (user) {
      if (user.role === 'teacher' && user.account_status === 'PENDING') {
        navigate('/pending-approval', { replace: true })
      } else {
        const roleMap = { admin: '/admin', teacher: '/teacher', student: '/student' }
        navigate(roleMap[user.role] || '/', { replace: true })
      }
    }
  }, [user, navigate])

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

    // If native Capacitor and no server URL is configured, prompt configuration
    if (!getBaseURL() && Capacitor.isNativePlatform()) {
      toast.error('Server URL is not configured. Please tap "Server" below to configure your server IP.')
      setServerUrlInput('')
      setShowServerModal(true)
      return
    }

    setLoading(true)
    try {
      const extra = {
        role: activeRole,
        ...(activeRole === 'student' ? { branch: selectedCourse.name, course_id: selectedCourse.id } : {})
      }

      const loggedUser = await login(loginForm.identifier.trim(), loginForm.password, extra)

      // Double-check role matching on frontend
      if (loggedUser.role !== activeRole) {
        if (logout) await logout()
        const actualLabel = loggedUser.role === 'teacher' ? 'Faculty' : loggedUser.role === 'admin' ? 'Admin' : 'Student'
        toast.error(`Access Denied: This account is registered as a ${actualLabel}. Please switch to the ${actualLabel} login tab.`)
        return
      }

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

  // Dynamic roll placeholder based on selected course
  const rollPlaceholder = selectedCourse?.code
    ? `${selectedCourse.code.replace('BSC-', '')}-2026-001`
    : 'CS-2024-001'

  const roleTabs = [
    { id: 'student', label: 'Student', icon: BookOpen },
    { id: 'teacher', label: 'Faculty', icon: UserPlus },
    { id: 'admin', label: 'Admin', icon: ShieldCheck },
  ]

  const modeTabs = [
    { id: 'login', label: 'Sign In' },
    { id: 'create', label: 'Create Account' },
  ]

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col justify-center items-center p-4 py-8 sm:py-12 relative">
      <div className="w-full max-w-md space-y-6">

        {/* ── HEADER & BRANDING ── */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 text-brand shadow-xs">
            {otpStep ? (
              <ShieldCheck className="w-6 h-6" />
            ) : (
              <GraduationCap className="w-6 h-6" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-ink tracking-tight">
              {otpStep ? 'Email Verification' : 'SMDL Attendance System'}
            </h1>
            <p className="text-xs text-muted mt-0.5">
              SES&apos;s S. M. Dadasaheb Limaye College, Kalamboli
            </p>
          </div>
        </div>

        {/* ── INLINE OTP VERIFICATION STEP ── */}
        {otpStep ? (
          <Card className="p-6 sm:p-7 space-y-5 animate-slide-up">
            <button
              type="button"
              id="back-to-form-btn"
              onClick={() => {
                setOtpStep(false)
                setOtpError('')
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Edit Details
            </button>

            <div className="bg-bg border border-line rounded-lg p-4 text-center space-y-2">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand/10 text-brand">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted">A 6-digit verification code has been sent to</p>
                <div className="flex items-center justify-center gap-1.5 mt-0.5">
                  <span className="text-sm font-semibold font-mono text-ink">{otpEmail}</span>
                  <button
                    type="button"
                    onClick={() => setOtpStep(false)}
                    title="Change email"
                    className="text-brand hover:opacity-80 p-0.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <Badge variant="brand" size="sm">
                Role: <span className="capitalize ml-1">{otpRole}</span> &bull; 10 min validity
              </Badge>
            </div>

            <form onSubmit={handleVerifyAndRegister} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted text-center">
                  Enter 6-Digit Code
                </label>

                <div className="flex justify-center gap-2 sm:gap-2.5">
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
                      className={`w-11 h-12 text-center text-xl font-bold font-mono rounded-lg bg-surface border text-ink transition-colors duration-150 focus:outline-none ${
                        otpError
                          ? 'border-absent focus:ring-2 focus:ring-absent/20'
                          : digit
                          ? 'border-brand ring-1 ring-brand/30'
                          : 'border-line focus:border-brand focus:ring-2 focus:ring-brand/20'
                      }`}
                    />
                  ))}
                </div>

                {otpError && (
                  <p className="text-xs text-absent text-center flex items-center justify-center gap-1 font-medium mt-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {otpError}
                  </p>
                )}
              </div>

              <div className="text-center text-xs">
                {resendTimer > 0 ? (
                  <span className="text-muted">
                    Didn&apos;t receive code? Resend in{' '}
                    <span className="font-mono font-semibold text-ink">{resendTimer}s</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    id="resend-otp-btn"
                    disabled={otpLoading}
                    onClick={handleResendOtp}
                    className="inline-flex items-center gap-1.5 text-brand hover:underline font-semibold"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${otpLoading ? 'animate-spin' : ''}`} />
                    Resend Verification Code
                  </button>
                )}
              </div>

              <Button
                id="verify-otp-submit-btn"
                type="submit"
                variant="primary"
                size="lg"
                loading={otpLoading}
                disabled={otpLoading || otpDigits.join('').length !== 6}
                className="w-full"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Verify &amp; Create Account
              </Button>
            </form>

            <p className="text-center text-[11px] text-muted border-t border-line pt-4">
              Check your inbox and Spam/Junk folder for the OTP message.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Role Switcher Tabs */}
            <Tabs
              tabs={roleTabs}
              activeTab={activeRole}
              onChange={key => {
                setActiveRole(key)
                setErrors({})
                setLoginForm({ identifier: '', password: '' })
              }}
              fullWidth
            />

            {/* Main Surface Card */}
            <Card className="p-6 sm:p-7 space-y-5">

              {/* ═══════════════════ STUDENT WORKFLOW ═══════════════════ */}
              {activeRole === 'student' && (
                <div className="space-y-4">
                  {/* Step 1: Department / Course Selection */}
                  <div className="bg-bg border border-line rounded-lg p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                        <Building2 className="w-3.5 h-3.5 text-brand" />
                        <span>Step 1: Select Academic Branch</span>
                      </div>
                      <Badge variant="brand" size="sm">
                        {selectedCourse.code || 'BRANCH'}
                      </Badge>
                    </div>

                    <Select
                      id="student-branch-select"
                      value={selectedCourseId}
                      onChange={e => {
                        setSelectedCourseId(e.target.value)
                        setErrors({})
                      }}
                    >
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code || 'Dept'})
                        </option>
                      ))}
                    </Select>

                    {/* Quick Course Chips */}
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
                          className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                            selectedCourseId === c.id
                              ? 'bg-brand text-white font-semibold'
                              : 'bg-surface border border-line text-muted hover:text-ink hover:border-brand/40'
                          }`}
                        >
                          {c.code || c.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Step 2: Mode Toggle (Sign In vs Create Account) */}
                  <div className="space-y-4 pt-1">
                    <div className="flex items-center justify-between border-b border-line pb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                        Step 2: Access Portal
                      </span>
                      <Tabs
                        tabs={modeTabs}
                        activeTab={studentMode}
                        onChange={m => {
                          setStudentMode(m)
                          setErrors({})
                        }}
                      />
                    </div>

                    {/* Mode A: Student Sign In */}
                    {studentMode === 'login' && (
                      <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
                        <Input
                          id="student-login-identifier"
                          label="Roll Number or Email"
                          autoComplete="username"
                          placeholder={`e.g. ${rollPlaceholder} or student@smdl.ac.in`}
                          value={loginForm.identifier}
                          onChange={e => setLoginForm(p => ({ ...p, identifier: e.target.value }))}
                          error={errors.identifier}
                          required
                        />

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label htmlFor="student-login-password" className="block text-xs font-semibold uppercase tracking-wider text-muted">
                              Password <span className="text-absent">*</span>
                            </label>
                            <Link
                              to="/forgot-password"
                              className="text-xs text-brand hover:underline font-medium"
                            >
                              Forgot Password?
                            </Link>
                          </div>
                          <Input
                            id="student-login-password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            placeholder="••••••••"
                            value={loginForm.password}
                            onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                            error={errors.password}
                            rightElement={
                              <button
                                type="button"
                                onClick={() => setShowPassword(s => !s)}
                                className="text-muted hover:text-ink transition-colors p-1"
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            }
                            required
                          />
                        </div>

                        <Button
                          id="student-login-btn"
                          type="submit"
                          variant="primary"
                          size="md"
                          loading={loading}
                          className="w-full mt-2"
                        >
                          <LogIn className="w-4 h-4" />
                          Sign In to {selectedCourse.code || 'Student'}
                        </Button>

                        <div className="text-center pt-2">
                          <p className="text-xs text-muted">
                            Don&apos;t have an account yet?{' '}
                            <button
                              type="button"
                              id="link-switch-create-account"
                              onClick={() => {
                                setStudentMode('create')
                                setErrors({})
                              }}
                              className="text-brand hover:underline font-semibold"
                            >
                              Register here
                            </button>
                          </p>
                        </div>
                      </form>
                    )}

                    {/* Mode B: Student Quick Registration */}
                    {studentMode === 'create' && (
                      <form onSubmit={handleStudentProceedToOtp} noValidate className="space-y-3.5">
                        <div className="bg-bg border border-line rounded-lg px-3 py-2 flex items-center justify-between text-xs">
                          <span className="text-muted">
                            Registering for: <strong className="text-ink">{selectedCourse.name}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => document.getElementById('student-branch-select')?.focus()}
                            className="text-brand hover:underline font-medium"
                          >
                            Change
                          </button>
                        </div>

                        <Input
                          id="reg-quick-fullname"
                          label="Full Name"
                          placeholder="e.g. Rahul Sharma"
                          value={regForm.full_name}
                          onChange={e => setRegForm(p => ({ ...p, full_name: e.target.value }))}
                          error={errors.full_name}
                          required
                        />

                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            id="reg-quick-roll"
                            label="Roll No"
                            placeholder={rollPlaceholder}
                            value={regForm.roll_number}
                            onChange={e => setRegForm(p => ({ ...p, roll_number: e.target.value }))}
                            error={errors.roll_number}
                            required
                          />

                          <Select
                            id="reg-quick-class"
                            label="Class"
                            value={regForm.class}
                            onChange={e => setRegForm(p => ({ ...p, class: e.target.value }))}
                          >
                            <option value="FY">FY</option>
                            <option value="SY">SY</option>
                            <option value="TY">TY</option>
                          </Select>

                          <Select
                            id="reg-quick-div"
                            label="Division"
                            value={regForm.division}
                            onChange={e => setRegForm(p => ({ ...p, division: e.target.value }))}
                          >
                            <option value="A">Div A</option>
                            <option value="B">Div B</option>
                            <option value="C">Div C</option>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            id="reg-quick-email"
                            label="Email Address"
                            type="email"
                            placeholder="name@gmail.com"
                            value={regForm.email}
                            onChange={e => setRegForm(p => ({ ...p, email: e.target.value }))}
                            error={errors.email}
                            required
                          />

                          <Input
                            id="reg-quick-phone"
                            label="Mobile Phone"
                            type="tel"
                            placeholder="10-digit number"
                            value={regForm.phone}
                            onChange={e => setRegForm(p => ({ ...p, phone: e.target.value }))}
                            error={errors.phone}
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            id="reg-quick-pwd"
                            label="Password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Min 8 chars"
                            value={regForm.password}
                            onChange={e => setRegForm(p => ({ ...p, password: e.target.value }))}
                            error={errors.password}
                            required
                          />

                          <Input
                            id="reg-quick-confirm"
                            label="Confirm"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Repeat"
                            value={regForm.confirm_password}
                            onChange={e => setRegForm(p => ({ ...p, confirm_password: e.target.value }))}
                            error={errors.confirm_password}
                            required
                          />
                        </div>

                        <div className="bg-bg border border-line rounded-lg p-2.5 text-xs text-muted flex items-center gap-2">
                          <Mail className="w-4 h-4 text-brand shrink-0" />
                          <span>We will send a 6-digit verification code to your email.</span>
                        </div>

                        <Button
                          id="student-create-account-btn"
                          type="submit"
                          variant="primary"
                          size="md"
                          loading={loading}
                          className="w-full mt-2"
                        >
                          <Mail className="w-4 h-4" />
                          Verify Email &amp; Create Account
                        </Button>

                        <div className="text-center pt-1">
                          <p className="text-xs text-muted">
                            Already registered?{' '}
                            <button
                              type="button"
                              onClick={() => {
                                setStudentMode('login')
                                setErrors({})
                              }}
                              className="text-brand hover:underline font-semibold"
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
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Faculty Portal Access
                    </span>
                    <Tabs
                      tabs={modeTabs}
                      activeTab={teacherMode}
                      onChange={m => {
                        setTeacherMode(m)
                        setErrors({})
                      }}
                    />
                  </div>

                  {/* Mode A: Teacher Sign In */}
                  {teacherMode === 'login' && (
                    <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
                      <div className="text-xs text-muted bg-bg p-3 rounded-lg border border-line">
                        👨‍🏫 Faculty Portal: Login with your registered email or Employee ID.
                      </div>

                      <Input
                        id="teacher-login-id"
                        label="Email or Employee ID"
                        type="text"
                        placeholder="e.g. TCH-1001 or faculty@smdl.ac.in"
                        value={loginForm.identifier}
                        onChange={e => setLoginForm(p => ({ ...p, identifier: e.target.value }))}
                        error={errors.identifier}
                        required
                      />

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label htmlFor="teacher-login-pwd" className="block text-xs font-semibold uppercase tracking-wider text-muted">
                            Password <span className="text-absent">*</span>
                          </label>
                          <Link
                            to="/forgot-password"
                            className="text-xs text-brand hover:underline font-medium"
                          >
                            Forgot Password?
                          </Link>
                        </div>
                        <Input
                          id="teacher-login-pwd"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={loginForm.password}
                          onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                          error={errors.password}
                          rightElement={
                            <button
                              type="button"
                              onClick={() => setShowPassword(s => !s)}
                              className="text-muted hover:text-ink transition-colors p-1"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          }
                          required
                        />
                      </div>

                      <Button
                        id="teacher-login-btn"
                        type="submit"
                        variant="primary"
                        size="md"
                        loading={loading}
                        className="w-full"
                      >
                        <LogIn className="w-4 h-4" />
                        Sign In as Faculty
                      </Button>

                      <div className="text-center pt-2 border-t border-line">
                        <p className="text-xs text-muted">
                          New faculty member?{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setTeacherMode('create')
                              setErrors({})
                            }}
                            className="text-brand hover:underline font-semibold"
                          >
                            Register Faculty Account
                          </button>
                        </p>
                      </div>
                    </form>
                  )}

                  {/* Mode B: Teacher Registration */}
                  {teacherMode === 'create' && (
                    <form onSubmit={handleTeacherProceedToOtp} noValidate className="space-y-3.5">
                      <Input
                        id="teacher-reg-fullname"
                        label="Full Name"
                        placeholder="e.g. Prof. Girish Kumbhar"
                        value={teacherRegForm.full_name}
                        onChange={e => setTeacherRegForm(p => ({ ...p, full_name: e.target.value }))}
                        error={errors.full_name}
                        required
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          id="teacher-reg-empid"
                          label="Employee ID"
                          placeholder="TCH-1001"
                          value={teacherRegForm.employee_id}
                          onChange={e => setTeacherRegForm(p => ({ ...p, employee_id: e.target.value }))}
                          error={errors.employee_id}
                          required
                        />

                        <Select
                          id="teacher-reg-dept"
                          label="Department"
                          value={teacherRegForm.department}
                          onChange={e => setTeacherRegForm(p => ({ ...p, department: e.target.value }))}
                          error={errors.department}
                          required
                        >
                          <option value="">Select Dept</option>
                          {TEACHER_DEPARTMENTS.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </Select>
                      </div>

                      <Input
                        id="teacher-reg-desig"
                        label="Designation (optional)"
                        placeholder="e.g. Assistant Professor / HOD"
                        value={teacherRegForm.designation}
                        onChange={e => setTeacherRegForm(p => ({ ...p, designation: e.target.value }))}
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          id="teacher-reg-email"
                          label="Email Address"
                          type="email"
                          placeholder="faculty@gmail.com"
                          value={teacherRegForm.email}
                          onChange={e => setTeacherRegForm(p => ({ ...p, email: e.target.value }))}
                          error={errors.email}
                          required
                        />

                        <Input
                          id="teacher-reg-phone"
                          label="Mobile Phone"
                          type="tel"
                          placeholder="9876543210"
                          value={teacherRegForm.phone}
                          onChange={e => setTeacherRegForm(p => ({ ...p, phone: e.target.value }))}
                          error={errors.phone}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          id="teacher-reg-pwd"
                          label="Password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Min 8 chars"
                          value={teacherRegForm.password}
                          onChange={e => setTeacherRegForm(p => ({ ...p, password: e.target.value }))}
                          error={errors.password}
                          required
                        />

                        <Input
                          id="teacher-reg-confirm"
                          label="Confirm Password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Repeat"
                          value={teacherRegForm.confirm_password}
                          onChange={e => setTeacherRegForm(p => ({ ...p, confirm_password: e.target.value }))}
                          error={errors.confirm_password}
                          required
                        />
                      </div>

                      <div className="bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/60 rounded-lg p-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <span>Teacher registration requires email verification and admin approval before login.</span>
                      </div>

                      <Button
                        id="teacher-create-account-btn"
                        type="submit"
                        variant="primary"
                        size="md"
                        loading={loading}
                        className="w-full mt-2"
                      >
                        <Mail className="w-4 h-4" />
                        Verify Email &amp; Submit Application
                      </Button>

                      <div className="text-center pt-1">
                        <p className="text-xs text-muted">
                          Already registered?{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setTeacherMode('login')
                              setErrors({})
                            }}
                            className="text-brand hover:underline font-semibold"
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
                  <div className="text-xs text-muted bg-bg p-3 rounded-lg border border-line">
                    🛡️ Administrator Portal: Full control over timetable, classes &amp; records.
                  </div>

                  <Input
                    id="admin-login-email"
                    label="Admin Email"
                    type="email"
                    placeholder="admin@smdl.ac.in"
                    value={loginForm.identifier}
                    onChange={e => setLoginForm(p => ({ ...p, identifier: e.target.value }))}
                    error={errors.identifier}
                    required
                  />

                  <div className="space-y-1">
                    <label htmlFor="admin-login-pwd" className="block text-xs font-semibold uppercase tracking-wider text-muted">
                      Password <span className="text-absent">*</span>
                    </label>
                    <Input
                      id="admin-login-pwd"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={loginForm.password}
                      onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                      error={errors.password}
                      rightElement={
                        <button
                          type="button"
                          onClick={() => setShowPassword(s => !s)}
                          className="text-muted hover:text-ink transition-colors p-1"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      }
                      required
                    />
                  </div>

                  <Button
                    id="admin-login-btn"
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={loading}
                    className="w-full"
                  >
                    <LogIn className="w-4 h-4" />
                    Sign In to Admin Console
                  </Button>
                </form>
              )}

            </Card>
          </div>
        )}

        {/* ── SERVER CONNECTION FOOTER BADGE ── */}
        <div className="flex justify-center">
          <button
            type="button"
            id="server-config-btn"
            onClick={() => {
              setServerUrlInput(getBaseURL() || '')
              setShowServerModal(true)
            }}
            className="inline-flex items-center gap-2 bg-surface hover:bg-bg border border-line rounded-full px-3.5 py-1.5 transition-colors text-xs text-muted shadow-xs cursor-pointer"
          >
            <Wifi className={`w-3.5 h-3.5 shrink-0 ${getBaseURL() ? "text-present animate-pulse" : "text-grace"}`} />
            <span>
              Server: <span className="font-mono text-ink font-semibold">{getBaseURL() || 'Not Configured'}</span>
            </span>
            <span className="text-[10px] bg-bg border border-line px-1.5 py-0.5 rounded text-brand font-medium">
              {getBaseURL() ? 'Settings' : 'Configure'}
            </span>
          </button>
        </div>

        {/* ── SERVER SETTINGS MODAL / BOTTOM-SHEET ── */}
        <Modal
          isOpen={showServerModal}
          onClose={() => setShowServerModal(false)}
          title="Server Configuration"
          description="Enter your backend API URL (e.g. your Laptop/Server IP on the same Wi-Fi network)."
        >
          <div className="space-y-4">
            <Input
              label="Backend API URL"
              type="text"
              id="server-url-input"
              value={serverUrlInput}
              onChange={e => setServerUrlInput(e.target.value)}
              placeholder="http://10.226.108.19:5000/api"
              helperText="Example: http://10.226.108.19:5000/api or https://api.smdl.edu.in/api"
              icon={Server}
            />

            <div className="flex gap-2 justify-end pt-2 border-t border-line">
              <Button
                variant="ghost"
                size="sm"
                id="cancel-server-btn"
                onClick={() => setShowServerModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                id="reset-server-btn"
                onClick={handleResetDefaultServer}
              >
                Reset Default
              </Button>
              <Button
                variant="primary"
                size="sm"
                id="test-save-server-btn"
                loading={testingServer}
                disabled={testingServer}
                onClick={() => testAndSaveServerUrl(serverUrlInput)}
              >
                {testingServer ? 'Connecting...' : 'Test & Save'}
              </Button>
            </div>
          </div>
        </Modal>

      </div>
    </div>
  )
}
