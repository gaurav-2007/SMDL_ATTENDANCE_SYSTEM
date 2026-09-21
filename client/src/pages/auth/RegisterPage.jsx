import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, UserPlus, GraduationCap, BookOpen } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

const DEPARTMENTS = ['Computer Science','Information Technology','Electronics','Mechanical','Civil','Commerce','Arts','Science']

const INITIAL_STUDENT = {
  full_name: '', email: '', password: '', confirm_password: '',
  roll_number: '', class: '', division: '', phone: '',
}
const INITIAL_TEACHER = {
  full_name: '', email: '', password: '', confirm_password: '',
  employee_id: '', department: '', phone: '',
}

// ✅ FIXED: Defined OUTSIDE RegisterPage to prevent focus loss on re-render
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
  const [role,    setRole]    = useState('student')
  const [form,    setForm]    = useState(INITIAL_STUDENT)
  const [show,    setShow]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors,  setErrors]  = useState({})

  function switchRole(r) {
    setRole(r)
    setForm(r === 'student' ? INITIAL_STUDENT : INITIAL_TEACHER)
    setErrors({})
  }

  function change(e) {
    const { name, value } = e.target
    setForm(p => ({ ...p, [name]: value }))
    if (errors[name]) setErrors(p => ({ ...p, [name]: undefined }))
  }

  function validate() {
    const e = {}
    if (!form.full_name?.trim())    e.full_name    = 'Full name required'
    if (!form.email?.trim())        e.email        = 'Email required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email'
    if (!form.password)             e.password     = 'Password required'
    else if (form.password.length < 8) e.password  = 'Min 8 characters'
    if (form.password !== form.confirm_password)  e.confirm_password = 'Passwords do not match'
    if (!form.phone?.trim())        e.phone        = 'Phone required'

    if (role === 'student') {
      if (!form.roll_number?.trim()) e.roll_number = 'Roll number required'
      if (!form.class?.trim())       e.class       = 'Class required'
      if (!form.division?.trim())    e.division    = 'Division required'
    } else {
      if (!form.employee_id?.trim()) e.employee_id = 'Employee ID required'
      if (!form.department)          e.department  = 'Department required'
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
      }
      delete payload.confirm_password
      await register(role, payload)
      if (role === 'student') {
        toast.success('Account created! You can now log in.')
        navigate('/login')
      } else {
        toast.success('Registration submitted! Wait for Admin approval before logging in.', { duration: 6000 })
        navigate('/login')
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
          <p className="text-brand-muted mt-1 text-sm">SMDL College Attendance System</p>
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

            <FieldInput
              id="reg-full-name" label="Full Name" name="full_name"
              placeholder="Your full name" value={form.full_name || ''}
              onChange={change} error={errors.full_name}
            />
            <FieldInput
              id="reg-email" label="Email" name="email" type="email"
              placeholder="you@smdl.ac.in" value={form.email || ''}
              onChange={change} error={errors.email}
            />
            <FieldInput
              id="reg-phone" label="Phone" name="phone" type="tel"
              placeholder="10-digit mobile number" value={form.phone || ''}
              onChange={change} error={errors.phone}
            />

            {role === 'student' ? (
              <div className="grid grid-cols-3 gap-3">
                <FieldInput
                  id="reg-roll" label="Roll No." name="roll_number"
                  placeholder="CS-2024-001" value={form.roll_number || ''}
                  onChange={change} error={errors.roll_number}
                />
                <FieldInput
                  id="reg-class" label="Class" name="class"
                  placeholder="FY / SY / TY" value={form.class || ''}
                  onChange={change} error={errors.class}
                />
                <FieldInput
                  id="reg-division" label="Division" name="division"
                  placeholder="A / B / C" value={form.division || ''}
                  onChange={change} error={errors.division}
                />
              </div>
            ) : (
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
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {errors.department && <p className="text-brand-danger text-xs mt-1">{errors.department}</p>}
                </div>
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
              disabled={loading}
              className="btn-primary w-full btn-lg mt-2"
            >
              {loading ? (
                <><div className="spinner w-4 h-4 border-2" /> Creating account...</>
              ) : (
                <><UserPlus size={18} /> {role === 'student' ? 'Create Student Account' : 'Submit Teacher Application'}</>
              )}
            </button>
          </form>

          <div className="divider mt-6" />
          <p className="text-center text-sm text-brand-muted">
            Already have an account?{' '}
            <Link to="/login" id="go-to-login" className="text-brand-accent hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
