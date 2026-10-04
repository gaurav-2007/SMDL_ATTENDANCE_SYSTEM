import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, ShieldCheck, CheckCircle2, AlertCircle, ArrowLeft, KeyRound } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [verifyingToken, setVerifyingToken] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [tokenErrorMessage, setTokenErrorMessage] = useState('')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errors, setErrors] = useState({})

  // Validate reset token on mount
  useEffect(() => {
    let mounted = true

    async function checkToken() {
      if (!token) {
        if (mounted) {
          setVerifyingToken(false)
          setTokenValid(false)
          setTokenErrorMessage('This password reset link is invalid or has expired.')
        }
        return
      }

      try {
        const { data } = await api.get(`/auth/reset-password/validate?token=${encodeURIComponent(token)}`)
        if (mounted) {
          if (data?.valid) {
            setTokenValid(true)
          } else {
            setTokenValid(false)
            setTokenErrorMessage(data?.message || 'This password reset link is invalid or has expired.')
          }
        }
      } catch (err) {
        if (mounted) {
          setTokenValid(false)
          setTokenErrorMessage(
            err.response?.data?.message || 'This password reset link is invalid or has expired.'
          )
        }
      } finally {
        if (mounted) setVerifyingToken(false)
      }
    }

    checkToken()
    return () => { mounted = false }
  }, [token])

  function validate() {
    const e = {}
    if (!password) {
      e.password = 'Password is required'
    } else if (password.length < 8) {
      e.password = 'Password must be at least 8 characters'
    }

    if (!confirmPassword) {
      e.confirm_password = 'Confirm password is required'
    } else if (password !== confirmPassword) {
      e.confirm_password = 'Passwords do not match'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      await api.post('/auth/reset-password', {
        token,
        password,
        confirm_password: confirmPassword,
      })

      setSuccess(true)
      toast.success('Password changed successfully!')
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update password. Link may have expired.'
      toast.error(msg)
      setErrors({ form: msg })
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid')) {
        setTokenValid(false)
        setTokenErrorMessage(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-dark bg-dot-pattern flex items-center justify-center p-4 py-8 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary-700/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-brand-accent/15 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-brand shadow-xl shadow-primary-900/50 mb-3 transition-transform hover:scale-105">
            {success ? (
              <CheckCircle2 size={32} className="text-white" />
            ) : (
              <KeyRound size={32} className="text-white" />
            )}
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            {success ? 'Password Updated' : 'Reset Your Password'}
          </h1>
          <p className="text-brand-muted mt-1 text-sm font-medium">
            SES&apos;s S. M. Dadasaheb Limaye College, Kalamboli
          </p>
        </div>

        <div className="card shadow-2xl border-brand-border/80 p-6 sm:p-8">
          {/* Loading verification state */}
          {verifyingToken ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-10 h-10 border-4 border-white/20 border-t-brand-accent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-brand-muted animate-pulse font-medium">
                Validating security link...
              </p>
            </div>
          ) : !tokenValid ? (
            /* Invalid or Expired Link state (Section 8) */
            <div className="text-center space-y-4 py-3">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 mb-1">
                <AlertCircle size={28} />
              </div>

              <h2 className="text-lg font-bold text-white">Invalid or Expired Link</h2>
              
              <p className="text-xs text-brand-muted leading-relaxed">
                {tokenErrorMessage || 'This password reset link is invalid or has expired.'}
              </p>

              <div className="pt-3 flex flex-col gap-2.5">
                <Link
                  to="/forgot-password"
                  id="request-new-reset-link-btn"
                  className="btn-primary w-full text-xs font-semibold py-2.5"
                >
                  Request a New Reset Link
                </Link>

                <Link
                  to="/login"
                  className="btn-secondary w-full text-xs font-semibold py-2.5 flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft size={14} /> Back to Sign In
                </Link>
              </div>
            </div>
          ) : success ? (
            /* Successful password update state (Section 10) */
            <div className="text-center space-y-4 py-3 animate-slide-up">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mb-1">
                <CheckCircle2 size={30} />
              </div>

              <h2 className="text-xl font-bold text-white">Password Updated Successfully</h2>

              <p className="text-xs text-brand-muted leading-relaxed">
                Your password has been changed successfully. You can now log in with your new password.
              </p>

              <div className="pt-3">
                <button
                  type="button"
                  id="go-to-login-btn"
                  onClick={() => navigate('/login', { replace: true })}
                  className="btn-primary w-full btn-lg font-bold shadow-lg shadow-primary-900/40"
                >
                  Go to Login
                </button>
              </div>
            </div>
          ) : (
            /* Password Reset Input Form (Section 6 & 7) */
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <p className="text-xs text-brand-muted leading-relaxed">
                Please enter a new password that is at least 8 characters long.
              </p>

              {errors.form && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0 text-rose-400" />
                  <span>{errors.form}</span>
                </div>
              )}

              <div>
                <label htmlFor="new-password" className="label">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value)
                      if (errors.password) setErrors(p => ({ ...p, password: '' }))
                    }}
                    className={`input pr-11 ${errors.password ? 'input-error' : ''}`}
                    disabled={loading}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-brand-danger text-xs mt-1.5 flex items-center gap-1 font-medium">
                    <AlertCircle size={13} /> {errors.password}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="confirm-new-password" className="label">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="confirm-new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={e => {
                      setConfirmPassword(e.target.value)
                      if (errors.confirm_password) setErrors(p => ({ ...p, confirm_password: '' }))
                    }}
                    className={`input pr-11 ${errors.confirm_password ? 'input-error' : ''}`}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.confirm_password && (
                  <p className="text-brand-danger text-xs mt-1.5 flex items-center gap-1 font-medium">
                    <AlertCircle size={13} /> {errors.confirm_password}
                  </p>
                )}
              </div>

              <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-2.5 text-[11px] text-sky-300 flex items-center gap-2">
                <ShieldCheck size={16} className="shrink-0 text-sky-400" />
                <span>Password must be minimum 8 characters with letters and numbers.</span>
              </div>

              <button
                type="submit"
                id="update-password-submit-btn"
                disabled={loading}
                className="btn-primary w-full btn-lg font-bold shadow-lg shadow-primary-900/40 mt-2"
              >
                {loading ? (
                  <>
                    <div className="spinner w-4 h-4 border-2" />
                    <span>Updating password...</span>
                  </>
                ) : (
                  <>
                    <KeyRound size={18} />
                    <span>Update Password</span>
                  </>
                )}
              </button>

              <div className="divider mt-5" />

              <div className="text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-brand-accent hover:underline font-semibold"
                >
                  <ArrowLeft size={14} /> Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
