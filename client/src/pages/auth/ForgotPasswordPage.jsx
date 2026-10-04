import { useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
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
      toast.success('Password reset instructions sent to your email.')
    } catch (err) {
      // Even if network or rate limit, handle gracefully
      const msg = err.response?.data?.message || 'Something went wrong. Please try again later.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-dark bg-dot-pattern flex items-center justify-center p-4 py-8 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary-700/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-brand-accent/15 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-brand shadow-xl shadow-primary-900/50 mb-3 transition-transform hover:scale-105">
            <KeyRound size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Forgot Password</h1>
          <p className="text-brand-muted mt-1 text-sm font-medium">
            SES&apos;s S. M. Dadasaheb Limaye College &bull; Student &amp; Faculty Recovery
          </p>
        </div>

        <div className="card shadow-2xl border-brand-border/80 p-6 sm:p-8">
          {submitted ? (
            <div className="text-center space-y-4 animate-slide-up">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mb-1">
                <CheckCircle2 size={28} />
              </div>

              <h2 className="text-xl font-bold text-white">Check Your Inbox</h2>

              <div className="bg-brand-dark/70 border border-brand-border rounded-xl p-4 text-xs text-brand-muted leading-relaxed text-left">
                <p className="text-white font-medium mb-1">If an account exists for this email, a password reset link has been sent. Please check your inbox.</p>
                <p className="mt-2 text-[11px] text-slate-400">
                  The link is valid for <strong>15 minutes</strong>. If you do not see the email, please check your Spam or Junk folder.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false)
                    setEmail('')
                  }}
                  className="btn-secondary w-full text-xs font-semibold py-2.5"
                >
                  Send another link
                </button>

                <Link
                  to="/login"
                  className="btn-primary w-full text-xs font-semibold py-2.5 flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft size={14} /> Back to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <p className="text-xs text-brand-muted leading-relaxed">
                Enter your registered email address and we&apos;ll send you a link to reset your password.
              </p>

              <div>
                <label htmlFor="forgot-email" className="label">
                  Registered Email Address
                </label>
                <div className="relative">
                  <input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    placeholder="e.g. yourname@gmail.com"
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value)
                      if (error) setError('')
                    }}
                    className={`input ${error ? 'input-error' : ''}`}
                    disabled={loading}
                    autoFocus
                  />
                </div>
                {error && (
                  <p className="text-brand-danger text-xs mt-1.5 flex items-center gap-1 font-medium">
                    <AlertCircle size={13} /> {error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                id="send-reset-link-btn"
                disabled={loading}
                className="btn-primary w-full btn-lg font-bold shadow-lg shadow-primary-900/40 mt-2"
              >
                {loading ? (
                  <>
                    <div className="spinner w-4 h-4 border-2" />
                    <span>Sending reset link...</span>
                  </>
                ) : (
                  <>
                    <Mail size={18} />
                    <span>Send Reset Link</span>
                  </>
                )}
              </button>

              <div className="divider mt-5" />

              <div className="text-center">
                <Link
                  to="/login"
                  id="back-to-login-link"
                  className="inline-flex items-center gap-1.5 text-xs text-brand-accent hover:underline font-semibold"
                >
                  <ArrowLeft size={14} /> Remember your password? Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
