import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KeyRound, Mail, ArrowLeft, CheckCircle2, AlertCircle, Eye, EyeOff, ShieldCheck, RotateCw } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { Card, Button, Input } from '../../components/ui'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // In-app Recovery Form state (Step 2)
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resendTimer, setResendTimer] = useState(60)

  // Countdown timer for code resend
  useEffect(() => {
    let interval = null
    if (submitted && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(t => (t > 0 ? t - 1 : 0))
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [submitted, resendTimer])

  async function handleSendLink(e) {
    if (e && e.preventDefault) e.preventDefault()
    const cleanEmail = email.trim().toLowerCase()

    if (!cleanEmail) {
      setError('Please enter your email address.')
      return
    }

    if (!/\S+@\S+\.\S+/.test(cleanEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    setError('')
    setLoading(true)

    try {
      await api.post('/auth/forgot-password', { email: cleanEmail })
      setSubmitted(true)
      setResendTimer(60)
      setResetError('')
      toast.success('6-Digit recovery code sent to your email!')
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong. Please try again later.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault()
    const cleanCode = resetCode.trim()

    if (!cleanCode) {
      setResetError('Please enter the 6-digit recovery code from your email.')
      return
    }
    if (cleanCode.length !== 6 && cleanCode.length < 4) {
      setResetError('Recovery code must be 6 digits.')
      return
    }

    if (!newPassword) {
      setResetError('New password is required.')
      return
    }
    if (newPassword.length < 8) {
      setResetError('Password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.')
      return
    }

    setResetError('')
    setResetLoading(true)

    try {
      await api.post('/auth/reset-password', {
        token: cleanCode,
        password: newPassword,
        confirm_password: confirmPassword,
      })

      toast.success('Password changed successfully! You can now log in.')
      navigate('/login', {
        replace: true,
        state: { prefillEmail: email.trim().toLowerCase() }
      })
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid or expired recovery code. Please check your email or request a new code.'
      setResetError(msg)
      toast.error(msg)
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center p-4 py-8 relative antialiased">
      <div className="w-full max-w-md animate-fade-in space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 text-brand shadow-xs">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-ink tracking-tight">Forgot Password</h1>
            <p className="text-xs text-muted mt-0.5">
              SES&apos;s S. M. Dadasaheb Limaye College · Account Recovery
            </p>
          </div>
        </div>

        <Card className="p-6 sm:p-7 shadow-sm">
          {submitted ? (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center gap-3 p-3 bg-present/10 border border-present/30 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-present shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink font-semibold truncate">Code sent to: {email}</p>
                  <p className="text-[11px] text-muted">Check your inbox or spam folder</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false)
                    setResetError('')
                  }}
                  className="text-[11px] text-brand hover:underline font-semibold shrink-0"
                >
                  Change
                </button>
              </div>

              {resetError && (
                <div className="flex items-center gap-2 p-3 bg-absent/10 border border-absent/30 rounded-xl text-xs text-absent">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              <form onSubmit={handleResetPassword} noValidate className="space-y-4">
                <div>
                  <label htmlFor="recovery-code" className="block text-xs font-semibold text-ink mb-1.5">
                    6-Digit Recovery Code
                  </label>
                  <div className="relative">
                    <input
                      id="recovery-code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="e.g. 482910"
                      value={resetCode}
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6)
                        setResetCode(val)
                        if (resetError) setResetError('')
                      }}
                      className="w-full px-3.5 py-2.5 bg-bg border border-line rounded-lg text-ink text-center tracking-[6px] font-mono font-bold text-lg focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
                      autoFocus
                      required
                    />
                  </div>
                  <p className="text-[11px] text-muted mt-1 text-center">
                    Valid for 15 minutes. Enter the numeric code from your email.
                  </p>
                </div>

                <div>
                  <label htmlFor="new-password" className="block text-xs font-semibold text-ink mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={e => {
                        setNewPassword(e.target.value)
                        if (resetError) setResetError('')
                      }}
                      className="w-full px-3.5 py-2.5 pr-10 bg-bg border border-line rounded-lg text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm-new-password" className="block text-xs font-semibold text-ink mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirm-new-password"
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Re-type your new password"
                      value={confirmPassword}
                      onChange={e => {
                        setConfirmPassword(e.target.value)
                        if (resetError) setResetError('')
                      }}
                      className="w-full px-3.5 py-2.5 pr-10 bg-bg border border-line rounded-lg text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  id="reset-password-btn"
                  variant="primary"
                  size="md"
                  loading={resetLoading}
                  disabled={resetLoading || resetCode.length < 4 || newPassword.length < 8}
                  className="w-full font-semibold shadow-xs mt-2"
                >
                  <ShieldCheck className="w-4 h-4 mr-1.5" />
                  <span>Update Password</span>
                </Button>

                <div className="flex items-center justify-between pt-2 border-t border-line text-xs">
                  <button
                    type="button"
                    disabled={resendTimer > 0 || loading}
                    onClick={() => handleSendLink()}
                    className="inline-flex items-center gap-1 text-brand hover:underline font-semibold disabled:text-muted disabled:no-underline"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span>{resendTimer > 0 ? `Resend code (${resendTimer}s)` : 'Resend Code'}</span>
                  </button>

                  <Link to="/login" className="text-muted hover:text-ink hover:underline">
                    Back to Sign In
                  </Link>
                </div>
              </form>
            </div>
          ) : (
            <form onSubmit={handleSendLink} noValidate className="space-y-4">
              <p className="text-xs text-muted leading-relaxed">
                Enter your registered college email address and we&apos;ll send you a 6-digit verification code to reset your password.
              </p>

              <div>
                <Input
                  id="forgot-email"
                  label="Registered Email Address"
                  type="email"
                  autoComplete="email"
                  placeholder="e.g. rahul.sharma@gmail.com"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value)
                    if (error) setError('')
                  }}
                  error={error}
                  disabled={loading}
                  icon={Mail}
                  autoFocus
                  required
                />
              </div>

              <Button
                type="submit"
                id="send-reset-link-btn"
                variant="primary"
                size="md"
                loading={loading}
                disabled={loading}
                className="w-full font-semibold shadow-xs"
              >
                <Mail className="w-4 h-4 mr-1.5" />
                <span>Send Recovery Code</span>
              </Button>

              <div className="border-t border-line pt-3 text-center">
                <Link
                  to="/login"
                  id="back-to-login-link"
                  className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline font-semibold"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Remember your password? Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
