import { useState } from 'react'
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn, GraduationCap } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'


export default function LoginPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [form,    setForm]    = useState({ email: '', password: '' })
  const [show,    setShow]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors,  setErrors]  = useState({})

  // If already logged in, redirect declaratively
  if (user) {
    const roleMap = { admin: '/admin', teacher: '/teacher', student: '/student' }
    return <Navigate to={roleMap[user.role] || '/'} replace />
  }


  const from = location.state?.from?.pathname || null

  function validate() {
    const e = {}
    const email = (form.email || '').trim()
    const password = (form.password || '').trim()
    if (!email)    e.email    = 'Email or username required'
    if (!password) e.password = 'Password required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      let email = (form.email || '').trim()
      if (email.toLowerCase() === 'admin') {
        email = 'admin@smdl.ac.in'
      }
      const password = (form.password || '').trim()

      const loggedUser = await login(email, password)
      toast.success(`Welcome back, ${loggedUser?.name || 'User'}!`)
      const roleMap = { admin: '/admin', teacher: '/teacher', student: '/student' }
      navigate(from || roleMap[loggedUser?.role] || '/', { replace: true })
    } catch (err) {
      console.error('Login error:', err)
      const msg = !err.response
        ? 'Cannot connect to backend server. Make sure port 5000 is running.'
        : (err.response?.data?.message || 'Login failed. Check credentials.')
      toast.error(msg)
      if (err.response?.status === 401) setErrors({ password: 'Invalid email or password' })
    } finally {
      setLoading(false)
    }
  }

  async function quickAdminLogin() {
    setForm({ email: 'admin@smdl.ac.in', password: 'admin@123' })
    setErrors({})
    setLoading(true)
    try {
      const loggedUser = await login('admin@smdl.ac.in', 'admin@123')
      toast.success(`Welcome back, ${loggedUser?.name || 'SMDL Admin'}!`)
      navigate('/admin', { replace: true })
    } catch (err) {
      console.error('Quick admin login error:', err)
      const msg = err.response?.data?.message || 'Login failed. Check credentials.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="min-h-screen bg-brand-dark bg-dot-pattern flex items-center justify-center p-4">
      {/* Glow background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary-700/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-brand-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-brand shadow-xl shadow-primary-900/50 mb-4">
            <GraduationCap size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">SMDL Attendance</h1>
          <p className="text-brand-muted mt-1 text-sm">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="card">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="login-email" className="label">Email address</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@smdl.ac.in"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className={`input ${errors.email ? 'input-error' : ''}`}
              />
              {errors.email && <p className="text-brand-danger text-xs mt-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="login-password" className="label">Password</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className={`input pr-11 ${errors.password ? 'input-error' : ''}`}
                />
                <button
                  type="button"
                  id="toggle-password-visibility"
                  onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-white transition-colors"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-brand-danger text-xs mt-1">{errors.password}</p>}
            </div>

            {/* Submit */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="btn-primary w-full btn-lg"
            >
              {loading ? (
                <><div className="spinner w-4 h-4 border-2" /> Signing in...</>
              ) : (
                <><LogIn size={18} /> Sign In</>
              )}
            </button>
          </form>

          {/* Divider + Register link */}
          <div className="divider mt-6" />
          <p className="text-center text-sm text-brand-muted">
            Don&apos;t have an account?{' '}
            <Link to="/register" id="go-to-register" className="text-brand-accent hover:underline font-medium">
              Register here
            </Link>
          </p>
        </div>

        {/* Demo credentials card */}
        <div className="mt-4 card-sm border border-brand-accent/25 bg-brand-accent/5 p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-white text-xs flex items-center gap-1.5">
              <span>⚡</span> Demo Account (Admin)
            </p>
            <span className="text-[10px] text-brand-accent bg-brand-accent/15 px-2 py-0.5 rounded-full font-medium">
              1-Click Ready
            </span>
          </div>

          <div className="bg-brand-dark/60 rounded-lg p-2.5 border border-brand-border flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-white font-medium">admin@smdl.ac.in</p>
              <p className="text-[11px] text-brand-muted">Password: <span className="font-mono text-brand-accent">admin@123</span></p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                id="auto-fill-admin-btn"
                onClick={() => {
                  setForm({ email: 'admin@smdl.ac.in', password: 'admin@123' })
                  setErrors({})
                  toast.success('Admin details auto-filled!')
                }}
                className="btn-secondary btn-sm text-xs py-1 px-2.5"
                title="Fill in the login form"
              >
                Auto-fill
              </button>
              <button
                type="button"
                id="quick-login-admin-btn"
                onClick={quickAdminLogin}
                disabled={loading}
                className="btn-primary btn-sm text-xs py-1 px-2.5 shadow-sm"
                title="Log in directly as Admin"
              >
                ⚡ Instant Login
              </button>
            </div>
          </div>

          <p className="text-[11px] text-brand-muted text-center">
            Or register a new account as Student or Teacher below
          </p>
        </div>
      </div>
    </div>
  )
}
