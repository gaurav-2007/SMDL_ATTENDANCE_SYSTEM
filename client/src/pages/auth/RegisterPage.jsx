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

function FieldInput({ id, label, name, type = 'text', placeholder, value, onChange, error, optional, disabled }) {
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
        disabled={disabled}
        className={`input ${error ? 'input-error' : ''} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      />
      {error && <p className="text-brand-danger text-xs mt-1">{error}</p>}
    </div>
  )
}

export default function RegisterPage() {
  const { register, sendOtp, verifyOtp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [role, setRole] = useState(location.state?.role || 'student')
  const [courses, setCourses] = useState(DEFAULT_COURSES)
  const [divisions, setDivisions] = useState([])
  const [loadingAcademic, setLoadingAcademic] = useState(false)

  // Multi-step flow: 'form' -> 'otp'
  const [step, setStep] = useState('form')
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const [verifiedToken, setVerifiedToken] = useState(null)

  const otpInputsRef = useRef([])

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

  // Resend OTP countdown timer
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

  function switchRole(r) {
    if (step === 'otp') return // don't switch role midway through OTP verification
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
    setOtpError('')
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
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email address required'
    if (!form.password) e.password = 'Password required'
    else if (form.password.length < 8) e.password = 'Min 8 characters'
    if (form.password !== form.confirm_password) e.confirm_password = 'Passwords do not match'
    if (!form.phone?.trim()) e.phone = 'Phone number required'

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

  /**
   * Step 1: Validate form details and send OTP to user's email
   */
  async function handleProceedToOtp(e) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    setOtpError('')

    try {
      const email = form.email.trim().toLowerCase()
      await sendOtp(email, role, {
        roll_number: form.roll_number?.trim(),
        employee_id: form.employee_id?.trim(),
      })

      setResendTimer(45)
      setOtpDigits(['', '', '', '', '', ''])
      setStep('otp')
      toast.success(`Verification code sent to ${email}. Check your Gmail inbox!`)
      
      // Auto-focus first OTP input on next tick
      setTimeout(() => {
        otpInputsRef.current[0]?.focus()
      }, 100)
    } catch (err) {
      console.error('Send OTP error:', err)
      const msg = err.response?.data?.message || err.message || 'Failed to send OTP verification email.'
      toast.error(msg)
      if (msg.toLowerCase().includes('email')) setErrors(p => ({ ...p, email: msg }))
      if (msg.toLowerCase().includes('roll')) setErrors(p => ({ ...p, roll_number: msg }))
      if (msg.toLowerCase().includes('employee')) setErrors(p => ({ ...p, employee_id: msg }))
    } finally {
      setLoading(false)
    }
  }

  /**
   * Resend OTP code with rate limit handling
   */
  async function handleResendOtp() {
    if (resendTimer > 0 || otpLoading) return
    setOtpLoading(true)
    setOtpError('')

    try {
      const email = form.email.trim().toLowerCase()
      await sendOtp(email, role, {
        roll_number: form.roll_number?.trim(),
        employee_id: form.employee_id?.trim(),
      })

      setResendTimer(45)
      toast.success('A fresh OTP has been sent to your email.')
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to resend code.'
      toast.error(msg)
      setOtpError(msg)
    } finally {
      setOtpLoading(false)
    }
  }

  /**
   * Handle changes in the 6 individual OTP input boxes
   */
  function handleOtpChange(index, value) {
    const clean = value.replace(/\D/g, '')
    const newDigits = [...otpDigits]

    // Handle pasting the full code (e.g., "654321")
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

    // Move to next box if character entered
    if (clean && index < 5) {
      otpInputsRef.current[index + 1]?.focus()
    }
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus()
    }
  }

  /**
   * Step 2: Verify OTP and finalize student/teacher registration
   */
  async function handleVerifyAndRegister(e) {
    if (e) e.preventDefault()
    const enteredCode = otpDigits.join('').trim()
    if (enteredCode.length !== 6) {
      setOtpError('Please enter the complete 6-digit verification code.')
      return
    }

    setOtpLoading(true)
    setOtpError('')

    try {
      const email = form.email.trim().toLowerCase()

      // 1. Verify OTP with server
      const vRes = await verifyOtp(email, enteredCode)
      const token = vRes?.data?.otp_token
      setVerifiedToken(token)

      // 2. Submit user registration with verified email
      const payload = {
        ...form,
        name: form.full_name?.trim(),
        full_name: form.full_name?.trim(),
        email,
        phone: form.phone?.trim() || undefined,
        roll_number: form.roll_number?.trim(),
        employee_id: form.employee_id?.trim(),
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

  return (
    <div className="min-h-screen bg-brand-dark bg-dot-pattern flex items-center justify-center p-4 py-10 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary-700/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-brand-accent/15 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-brand shadow-xl shadow-primary-900/50 mb-4 transition-transform hover:scale-105">
            {step === 'otp' ? (
              <ShieldCheck size={34} className="text-white animate-bounce-short" />
            ) : (
              <GraduationCap size={32} className="text-white" />
            )}
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            {step === 'otp' ? 'Verify Your Email' : 'Create Account'}
          </h1>
          <p className="text-brand-muted mt-1 text-sm font-medium">
            SES&apos;s S. M. Dadasaheb Limaye College &bull; Attendance Portal
          </p>
        </div>

        {/* STEP 1: Registration Form */}
        {step === 'form' && (
          <div className="card p-6 sm:p-8 animate-slide-up shadow-2xl border border-brand-border/80">
            {/* Role toggle */}
            <div className="flex gap-2 mb-6 bg-brand-card/90 border border-brand-border rounded-2xl p-1.5 backdrop-blur-sm">
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
                    role === key
                      ? 'bg-gradient-brand text-white shadow-md shadow-primary-900/40'
                      : 'text-brand-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>

            <form onSubmit={handleProceedToOtp} className="space-y-4">
              <FieldInput
                id="reg-name"
                label="Full Name"
                name="full_name"
                placeholder={role === 'student' ? 'e.g. Rahul Sharma' : 'e.g. Prof. Girish Kumbhar'}
                value={form.full_name}
                onChange={change}
                error={errors.full_name}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldInput
                  id="reg-email"
                  label="Email Address"
                  name="email"
                  type="email"
                  placeholder="name@gmail.com"
                  value={form.email}
                  onChange={change}
                  error={errors.email}
                />
                <FieldInput
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
                    <label htmlFor="reg-course" className="label flex items-center justify-between">
                      <span>Course / Department</span>
                      {loadingAcademic && <span className="text-[10px] text-brand-muted animate-pulse">Loading departments...</span>}
                    </label>
                    <select
                      id="reg-course"
                      name="course_id"
                      value={form.course_id || ''}
                      onChange={handleBranchChange}
                      className={`input ${errors.branch ? 'input-error' : ''}`}
                    >
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                    {errors.branch && <p className="text-brand-danger text-xs mt-1">{errors.branch}</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="reg-roll" className="label">Roll Number</label>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FieldInput
                      id="reg-emp-id"
                      label="Employee ID"
                      name="employee_id"
                      placeholder="TCH-1001"
                      value={form.employee_id || ''}
                      onChange={change}
                      error={errors.employee_id}
                    />
                    <div>
                      <label htmlFor="reg-dept" className="label">Department</label>
                      <select
                        id="reg-dept"
                        name="department"
                        value={form.department || ''}
                        onChange={change}
                        className={`input ${errors.department ? 'input-error' : ''}`}
                      >
                        <option value="">Select dept.</option>
                        {TEACHER_DEPARTMENTS.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      {errors.department && <p className="text-brand-danger text-xs mt-1">{errors.department}</p>}
                    </div>
                  </div>

                  <FieldInput
                    id="reg-designation"
                    label="Designation"
                    name="designation"
                    placeholder="e.g. Assistant Professor / Head of Department"
                    value={form.designation || ''}
                    onChange={change}
                    error={errors.designation}
                    optional
                  />
                </div>
              )}

              {/* Password */}
              <div>
                <label htmlFor="reg-password" className="label">Password</label>
                <div className="relative">
                  <input
                    id="reg-password"
                    name="password"
                    type={show ? 'text' : 'password'}
                    placeholder="Min 8 characters"
                    autoComplete="new-password"
                    value={form.password || ''}
                    onChange={change}
                    className={`input pr-11 ${errors.password ? 'input-error' : ''}`}
                  />
                  <button
                    type="button"
                    id="toggle-reg-password"
                    onClick={() => setShow(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-white transition-colors"
                  >
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="text-brand-danger text-xs mt-1">{errors.password}</p>}
              </div>

              <div>
                <label htmlFor="reg-confirm" className="label">Confirm Password</label>
                <input
                  id="reg-confirm"
                  name="confirm_password"
                  type={show ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  value={form.confirm_password || ''}
                  onChange={change}
                  className={`input ${errors.confirm_password ? 'input-error' : ''}`}
                />
                {errors.confirm_password && <p className="text-brand-danger text-xs mt-1">{errors.confirm_password}</p>}
              </div>

              {/* Teacher notice */}
              {role === 'teacher' && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 flex items-start gap-2">
                  <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-400" />
                  <span>Teacher registrations require <strong>Admin verification &amp; approval</strong> before login access is activated.</span>
                </div>
              )}

              {/* Security info badge */}
              <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3 text-xs text-sky-300 flex items-center gap-2">
                <ShieldCheck size={16} className="shrink-0 text-sky-400" />
                <span>A 6-digit OTP verification code will be sent to your email to verify authenticity.</span>
              </div>

              <button
                id="register-submit-btn"
                type="submit"
                disabled={loading || loadingAcademic}
                className="btn-primary w-full btn-lg mt-2 group"
              >
                {loading ? (
                  <>
                    <div className="spinner w-4 h-4 border-2" />
                    <span>Sending Verification Code...</span>
                  </>
                ) : (
                  <>
                    <Mail size={18} className="transition-transform group-hover:scale-110" />
                    <span>Verify Email &amp; Create Account</span>
                  </>
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
                className="text-brand-accent hover:underline font-semibold"
              >
                Sign in
              </Link>
            </p>
          </div>
        )}

        {/* STEP 2: OTP Verification Card */}
        {step === 'otp' && (
          <div className="card p-6 sm:p-8 animate-slide-up shadow-2xl border border-brand-border/90 relative">
            {/* Back button to edit details */}
            <button
              type="button"
              id="back-to-form-btn"
              onClick={() => {
                setStep('form')
                setOtpError('')
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-muted hover:text-white transition-colors mb-4"
            >
              <ArrowLeft size={14} /> Back to Edit Details
            </button>

            {/* Recipient Email Callout */}
            <div className="bg-brand-dark/70 border border-brand-border rounded-2xl p-4 text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-600/20 border border-primary-500/30 text-primary-400 mb-2">
                <Mail size={22} />
              </div>
              <p className="text-xs text-brand-muted">We sent a 6-digit verification code to</p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-base font-bold text-white tracking-wide">{form.email}</span>
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  title="Change email"
                  className="text-brand-accent hover:text-sky-300 p-1"
                >
                  <Edit3 size={14} />
                </button>
              </div>
              <p className="text-[11px] text-brand-muted mt-1.5">
                Role: <span className="capitalize font-semibold text-sky-400">{role}</span> &bull; Valid for 10 minutes
              </p>
            </div>

            <form onSubmit={handleVerifyAndRegister} className="space-y-6">
              <div>
                <label className="label text-center block mb-3 font-semibold text-white">
                  Enter 6-Digit Verification Code
                </label>

                {/* 6 Digit Input Boxes */}
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
                  <p className="text-brand-danger text-xs text-center mt-2 flex items-center justify-center gap-1">
                    <AlertCircle size={13} /> {otpError}
                  </p>
                )}
              </div>

              {/* Resend Code Section */}
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

              {/* Submit Button */}
              <button
                id="verify-otp-submit-btn"
                type="submit"
                disabled={otpLoading || otpDigits.join('').length !== 6}
                className="btn-primary w-full btn-lg font-bold shadow-lg shadow-primary-900/40"
              >
                {otpLoading ? (
                  <>
                    <div className="spinner w-4 h-4 border-2" />
                    <span>Verifying &amp; Creating Account...</span>
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
              Make sure to check your spam/junk folder if the email doesn&apos;t appear within a minute.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
