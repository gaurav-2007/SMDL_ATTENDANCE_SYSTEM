import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  UserPlus,
  GraduationCap,
  BookOpen,
  Building2,
  Mail,
  ShieldCheck,
  ArrowLeft,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Edit3
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import api from '../../lib/api'
import { Card, Badge, Button, Input, Select, Tabs } from '../../components/ui'

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

export default function RegisterPage() {
  const { register, sendOtp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [role, setRole] = useState(location.state?.role || 'student')
  const [courses, setCourses] = useState(DEFAULT_COURSES)
  const [divisionsByCourse, setDivisionsByCourse] = useState({})
  const [loadingAcademic, setLoadingAcademic] = useState(true)

  const [form, setForm] = useState(role === 'student' ? INITIAL_STUDENT : INITIAL_TEACHER)
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  // Two-step flow: 'form' -> 'otp'
  const [step, setStep] = useState('form')
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const otpInputsRef = useRef([])

  // Load courses and divisions
  useEffect(() => {
    let mounted = true
    async function loadAcademic() {
      try {
        setLoadingAcademic(true)
        const [cRes, dRes] = await Promise.allSettled([
          api.get('/academic/courses'),
          api.get('/academic/divisions'),
        ])

        if (!mounted) return

        let loadedCourses = DEFAULT_COURSES
        if (cRes.status === 'fulfilled' && cRes.value?.data?.data?.courses?.length > 0) {
          loadedCourses = cRes.value.data.data.courses
          setCourses(loadedCourses)
        }

        const divMap = {}
        if (dRes.status === 'fulfilled' && dRes.value?.data?.data?.divisions) {
          dRes.value.data.data.divisions.forEach(d => {
            if (!divMap[d.course_id]) divMap[d.course_id] = []
            divMap[d.course_id].push(d)
          })
          setDivisionsByCourse(divMap)
        }

        if (role === 'student' && loadedCourses.length > 0) {
          const defaultC = loadedCourses[0]
          const matchedDivs = divMap[defaultC.id] || []
          setForm(f => ({
            ...f,
            course_id: f.course_id || defaultC.id,
            branch: f.branch || defaultC.department || defaultC.name,
            division_id: f.division_id || (matchedDivs[0]?.id || ''),
          }))
        }
      } catch (err) {
        console.error('Failed to load academic data:', err)
      } finally {
        if (mounted) setLoadingAcademic(false)
      }
    }

    loadAcademic()
    return () => { mounted = false }
  }, [role])

  // Timer countdown for OTP resend
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

  function switchRole(newRole) {
    if (newRole === role) return
    setRole(newRole)
    setErrors({})
    setStep('form')
    setOtpDigits(['', '', '', '', '', ''])
    setOtpError('')

    if (newRole === 'student') {
      const defaultC = courses[0] || DEFAULT_COURSES[0]
      const matchedDivs = divisionsByCourse[defaultC.id] || []
      setForm({
        ...INITIAL_STUDENT,
        course_id: defaultC.id,
        branch: defaultC.department || defaultC.name,
        division_id: matchedDivs[0]?.id || '',
      })
    } else {
      setForm(INITIAL_TEACHER)
    }
  }

  function change(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
    if (errors[name]) setErrors(errs => ({ ...errs, [name]: '' }))
  }

  function handleBranchChange(e) {
    const courseId = e.target.value
    const found = courses.find(c => c.id === courseId)
    const matchedDivs = divisionsByCourse[courseId] || []
    setForm(f => ({
      ...f,
      course_id: courseId,
      branch: found?.department || found?.name || '',
      division_id: matchedDivs[0]?.id || '',
    }))
    if (errors.branch) setErrors(errs => ({ ...errs, branch: '' }))
  }

  function validateForm() {
    const errs = {}
    if (!form.full_name.trim()) errs.full_name = 'Full name is required'
    if (!form.email.trim()) {
      errs.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      errs.email = 'Invalid email address format'
    }

    if (!form.password) {
      errs.password = 'Password is required'
    } else if (form.password.length < 8) {
      errs.password = 'Password must be at least 8 characters'
    }

    if (form.password !== form.confirm_password) {
      errs.confirm_password = 'Passwords do not match'
    }

    if (role === 'student') {
      if (!form.course_id && !form.branch) errs.branch = 'Please select a course/department'
      if (!form.roll_number?.trim()) {
        errs.roll_number = 'Roll number is required'
      } else if (!/^[A-Za-z0-9\-]+$/.test(form.roll_number.trim())) {
        errs.roll_number = 'Alphanumeric and hyphen only (e.g. CS-2024-001)'
      }
      if (!form.class) errs.class = 'Class year is required'
      if (!form.division) errs.division = 'Division is required'
    } else if (role === 'teacher') {
      if (!form.employee_id?.trim()) errs.employee_id = 'Employee ID is required'
      if (!form.department?.trim()) errs.department = 'Department is required'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleProceedToOtp(e) {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    setOtpError('')

    try {
      await sendOtp({
        email: form.email.trim().toLowerCase(),
        role,
        purpose: 'REGISTER',
      })

      setStep('otp')
      setResendTimer(60)
      setOtpDigits(['', '', '', '', '', ''])
      toast.success(`Verification code sent to ${form.email}! Please check your inbox.`)

      setTimeout(() => {
        if (otpInputsRef.current[0]) otpInputsRef.current[0].focus()
      }, 100)
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to send OTP code. Please try again.'
      toast.error(msg)
      setErrors({ email: msg })
    } finally {
      setLoading(false)
    }
  }

  function handleOtpChange(index, value) {
    const char = value.replace(/[^0-9]/g, '').slice(-1)
    const newDigits = [...otpDigits]
    newDigits[index] = char
    setOtpDigits(newDigits)
    if (otpError) setOtpError('')

    if (char && index < 5 && otpInputsRef.current[index + 1]) {
      otpInputsRef.current[index + 1].focus()
    }
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1].focus()
    }
  }

  async function handleResendOtp() {
    if (resendTimer > 0 || otpLoading) return
    setOtpLoading(true)
    setOtpError('')
    try {
      await sendOtp({
        email: form.email.trim().toLowerCase(),
        role,
        purpose: 'REGISTER',
      })
      setResendTimer(60)
      setOtpDigits(['', '', '', '', '', ''])
      toast.success('A new verification code has been dispatched to your email.')
      if (otpInputsRef.current[0]) otpInputsRef.current[0].focus()
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not resend OTP. Please wait before retrying.'
      setOtpError(msg)
      toast.error(msg)
    } finally {
      setOtpLoading(false)
    }
  }

  async function handleVerifyAndRegister(e) {
    e.preventDefault()
    const enteredCode = otpDigits.join('')
    if (enteredCode.length !== 6) {
      setOtpError('Please enter the full 6-digit verification code.')
      return
    }

    setOtpLoading(true)
    setOtpError('')

    try {
      const verifyRes = await api.post('/auth/verify-otp', {
        email: form.email.trim().toLowerCase(),
        otp: enteredCode,
        purpose: 'REGISTER',
      })

      const token = verifyRes.data?.data?.token || verifyRes.data?.token
      if (!token) throw new Error('Verification completed but authorization token was missing')

      const payload = {
        ...form,
        email: form.email.trim().toLowerCase(),
        roll_number: form.roll_number?.trim().toUpperCase(),
        branch: form.branch,
        department: form.branch || form.department,
        designation: form.designation?.trim() || undefined,
        course_id: form.course_id || undefined,
        division_id: form.division_id || undefined,
        otp: enteredCode,
        otp_token: token,
      }
      delete payload.confirm_password

      await register(role, payload)

      if (role === 'student') {
        toast.success(`Account verified & created successfully for ${form.branch || 'Student'}! You can now log in.`)
        navigate('/login', {
          state: {
            role: 'student',
            selectedCourseId: form.course_id,
            prefillEmail: form.roll_number?.trim() || form.email?.trim(),
          }
        })
      } else {
        toast.success('Email verified! Teacher application submitted. Wait for Admin approval before logging in.', { duration: 6500 })
        navigate('/login', { state: { role: 'teacher' } })
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

  const selectedCourse = courses.find(c => c.id === form.course_id) || DEFAULT_COURSES.find(c => c.id === form.course_id)
  const rollPrefixPlaceholder = selectedCourse?.code ? `${selectedCourse.code.replace('BSC-', '')}-2026-001` : 'CS-2024-001'

  const roleTabs = [
    { id: 'student', label: 'Student Account' },
    { id: 'teacher', label: 'Faculty / Teacher' },
  ]

  return (
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center p-4 py-8 relative antialiased">
      <div className="w-full max-w-lg animate-fade-in space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 text-brand shadow-xs mx-auto">
            {step === 'otp' ? (
              <ShieldCheck className="w-6 h-6" />
            ) : (
              <GraduationCap className="w-6 h-6" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-ink tracking-tight">
              {step === 'otp' ? 'Verify Your Email' : 'Create an Account'}
            </h1>
            <p className="text-xs text-muted mt-0.5">
              SES&apos;s S. M. Dadasaheb Limaye College &bull; Student &amp; Faculty Registration
            </p>
          </div>
        </div>

        {/* STEP 1: Registration Form */}
        {step === 'form' && (
          <Card className="p-6 sm:p-7 shadow-sm space-y-5">
            {/* Role Switcher Tabs */}
            <Tabs
              tabs={roleTabs}
              activeTab={role}
              onChange={switchRole}
              fullWidth
            />

            <form onSubmit={handleProceedToOtp} className="space-y-4">
              <Input
                id="reg-name"
                label="Full Legal Name"
                placeholder={role === 'student' ? 'e.g. Rahul Sharma' : 'e.g. Prof. Girish Kumbhar'}
                value={form.full_name}
                onChange={change}
                name="full_name"
                error={errors.full_name}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  id="reg-email"
                  label="Email Address"
                  name="email"
                  type="email"
                  placeholder="name@gmail.com"
                  value={form.email}
                  onChange={change}
                  error={errors.email}
                  required
                />
                <Input
                  id="reg-phone"
                  label="Phone Number"
                  name="phone"
                  type="tel"
                  placeholder="9876543210"
                  value={form.phone}
                  onChange={change}
                  error={errors.phone}
                />
              </div>

              {/* Student specific fields */}
              {role === 'student' ? (
                <>
                  <div>
                    <label htmlFor="reg-course" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5 flex items-center justify-between">
                      <span>Course / Academic Branch</span>
                      {loadingAcademic && <span className="text-[10px] text-muted animate-pulse">Loading curriculum...</span>}
                    </label>
                    <select
                      id="reg-course"
                      name="course_id"
                      value={form.course_id || ''}
                      onChange={handleBranchChange}
                      className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 shadow-xs cursor-pointer"
                    >
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                    {errors.branch && <p className="text-absent text-xs mt-1">{errors.branch}</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input
                      id="reg-roll"
                      label="Roll Number"
                      name="roll_number"
                      placeholder={rollPrefixPlaceholder}
                      value={form.roll_number || ''}
                      onChange={change}
                      error={errors.roll_number}
                      required
                    />

                    <div>
                      <label htmlFor="reg-class" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                        Year
                      </label>
                      <select
                        id="reg-class"
                        name="class"
                        value={form.class || 'FY'}
                        onChange={change}
                        className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 shadow-xs cursor-pointer"
                      >
                        <option value="FY">FY (1st Year)</option>
                        <option value="SY">SY (2nd Year)</option>
                        <option value="TY">TY (3rd Year)</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="reg-division" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                        Division
                      </label>
                      <select
                        id="reg-division"
                        name="division"
                        value={form.division || 'A'}
                        onChange={change}
                        className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 shadow-xs cursor-pointer"
                      >
                        <option value="A">Division A</option>
                        <option value="B">Division B</option>
                        <option value="C">Division C</option>
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      id="reg-emp-id"
                      label="Employee ID"
                      name="employee_id"
                      placeholder="TCH-1001"
                      value={form.employee_id || ''}
                      onChange={change}
                      error={errors.employee_id}
                      required
                    />
                    <div>
                      <label htmlFor="reg-dept" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                        Department
                      </label>
                      <select
                        id="reg-dept"
                        name="department"
                        value={form.department || ''}
                        onChange={change}
                        className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 shadow-xs cursor-pointer"
                      >
                        <option value="">Select dept.</option>
                        {TEACHER_DEPARTMENTS.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      {errors.department && <p className="text-absent text-xs mt-1">{errors.department}</p>}
                    </div>
                  </div>

                  <Input
                    id="reg-designation"
                    label="Designation"
                    name="designation"
                    placeholder="e.g. Assistant Professor / Head of Department"
                    value={form.designation || ''}
                    onChange={change}
                    error={errors.designation}
                  />
                </div>
              )}

              {/* Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  id="reg-password"
                  label="Password"
                  name="password"
                  type={show ? 'text' : 'password'}
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                  value={form.password || ''}
                  onChange={change}
                  error={errors.password}
                  required
                  rightElement={
                    <button
                      type="button"
                      id="toggle-reg-password"
                      onClick={() => setShow(s => !s)}
                      className="text-muted hover:text-ink p-1"
                    >
                      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />

                <Input
                  id="reg-confirm"
                  label="Confirm Password"
                  name="confirm_password"
                  type={show ? 'text' : 'password'}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  value={form.confirm_password || ''}
                  onChange={change}
                  error={errors.confirm_password}
                  required
                />
              </div>

              {/* Security info banner */}
              <div className="bg-bg border border-line rounded-lg p-2.5 text-xs text-muted flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand shrink-0" />
                <span>A 6-digit verification code will be sent to your email to verify authenticity.</span>
              </div>

              <Button
                id="register-submit-btn"
                type="submit"
                variant="primary"
                size="md"
                disabled={loading || loadingAcademic}
                loading={loading}
                className="w-full font-semibold shadow-xs"
              >
                <Mail className="w-4 h-4 mr-1.5" />
                <span>Verify Email &amp; Create Account</span>
              </Button>
            </form>

            <div className="border-t border-line pt-3 text-center text-xs text-muted">
              Already have an account?{' '}
              <Link
                to="/login"
                id="go-to-login"
                state={{
                  role,
                  selectedCourseId: form.course_id,
                  branch: form.branch,
                }}
                className="text-brand font-semibold hover:underline ml-1"
              >
                Sign In
              </Link>
            </div>
          </Card>
        )}

        {/* STEP 2: OTP Verification Card */}
        {step === 'otp' && (
          <Card className="p-6 sm:p-7 shadow-sm space-y-5 animate-fade-in">
            <button
              type="button"
              id="back-to-form-btn"
              onClick={() => {
                setStep('form')
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
                <p className="text-xs text-muted">We sent a 6-digit verification code to</p>
                <div className="flex items-center justify-center gap-1.5 mt-0.5">
                  <span className="text-sm font-semibold font-mono text-ink">{form.email}</span>
                  <button
                    type="button"
                    onClick={() => setStep('form')}
                    title="Change email"
                    className="text-brand hover:opacity-80 p-0.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <Badge variant="brand" size="sm">
                Role: <span className="capitalize ml-1">{role}</span> &bull; Valid for 10 minutes
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
                size="md"
                loading={otpLoading}
                disabled={otpLoading || otpDigits.join('').length !== 6}
                className="w-full font-semibold shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                <span>Verify &amp; Create Account</span>
              </Button>
            </form>

            <p className="text-center text-[11px] text-muted border-t border-line pt-3">
              Make sure to check your Spam/Junk folder if the email does not appear in your inbox.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
