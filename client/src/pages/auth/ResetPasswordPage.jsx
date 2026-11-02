import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, ShieldCheck, CheckCircle2, AlertCircle, ArrowLeft, KeyRound, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { Card, Button, Input } from '../../components/ui'

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
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center p-4 py-8 relative antialiased">
      <div className="w-full max-w-md animate-fade-in space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 text-brand shadow-xs mx-auto">
            {success ? (
              <CheckCircle2 className="w-6 h-6 text-present" />
            ) : (
              <KeyRound className="w-6 h-6 text-brand" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-ink tracking-tight">
              {success ? 'Password Updated' : 'Reset Your Password'}
            </h1>
            <p className="text-xs text-muted mt-0.5">
              SES&apos;s S. M. Dadasaheb Limaye College, Kalamboli
            </p>
          </div>
        </div>

        <Card className="p-6 sm:p-7 shadow-sm">
          {/* Loading verification state */}
          {verifyingToken ? (
            <div className="py-10 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-brand animate-spin mx-auto" />
              <p className="text-xs text-muted font-medium">
                Validating security link...
              </p>
            </div>
          ) : !tokenValid ? (
            /* Invalid or Expired Link state */
            <div className="text-center space-y-4 py-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-absent/15 text-absent border border-absent/30 mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>

              <h2 className="text-base font-bold font-display text-ink">Invalid or Expired Link</h2>

              <p className="text-xs text-muted leading-relaxed">
                {tokenErrorMessage || 'This password reset link is invalid or has expired.'}
              </p>

              <div className="pt-2 flex flex-col gap-2">
                <Link to="/forgot-password">
                  <Button variant="primary" size="md" className="w-full">
                    Request a New Reset Link
                  </Button>
                </Link>

                <Link to="/login">
                  <Button variant="outline" size="md" className="w-full">
                    <ArrowLeft className="w-4 h-4 mr-1.5" />
                    <span>Back to Sign In</span>
                  </Button>
                </Link>
              </div>
            </div>
          ) : success ? (
            /* Successful password update state */
            <div className="text-center space-y-4 py-2 animate-fade-in">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-present/15 text-present border border-present/30 mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <h2 className="text-lg font-bold font-display text-ink">Password Changed Successfully</h2>

              <p className="text-xs text-muted leading-relaxed">
                Your password credentials have been updated securely. You can now log into your college portal.
              </p>

              <div className="pt-2">
                <Button
                  variant="primary"
                  size="md"
                  id="go-to-login-btn"
                  onClick={() => navigate('/login', { replace: true })}
                  className="w-full font-semibold shadow-xs"
                >
                  Proceed to Login
                </Button>
              </div>
            </div>
          ) : (
            /* Password Reset Input Form */
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <p className="text-xs text-muted leading-relaxed">
                Please enter a new secure password (at least 8 characters).
              </p>

              {errors.form && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-lg p-2.5 text-xs text-absent flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errors.form}</span>
                </div>
              )}

              <div>
                <Input
                  id="new-password"
                  label="New Password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value)
                    if (errors.password) setErrors(p => ({ ...p, password: '' }))
                  }}
                  error={errors.password}
                  disabled={loading}
                  autoFocus
                  required
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="text-muted hover:text-ink p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
              </div>

              <div>
                <Input
                  id="confirm-new-password"
                  label="Confirm New Password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value)
                    if (errors.confirm_password) setErrors(p => ({ ...p, confirm_password: '' }))
                  }}
                  error={errors.confirm_password}
                  disabled={loading}
                  required
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="text-muted hover:text-ink p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
              </div>

              <div className="bg-bg border border-line rounded-lg p-2.5 text-[11px] text-muted flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand shrink-0" />
                <span>Password must be minimum 8 characters with letters &amp; numbers.</span>
              </div>

              <Button
                type="submit"
                id="update-password-submit-btn"
                variant="primary"
                size="md"
                loading={loading}
                disabled={loading}
                className="w-full font-semibold shadow-xs"
              >
                <KeyRound className="w-4 h-4 mr-1.5" />
                <span>Update Password</span>
              </Button>

              <div className="border-t border-line pt-3 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline font-semibold"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
