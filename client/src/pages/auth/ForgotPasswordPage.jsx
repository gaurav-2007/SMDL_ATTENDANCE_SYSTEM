import { useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { Card, Button, Input } from '../../components/ui'

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
      const msg = err.response?.data?.message || 'Something went wrong. Please try again later.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
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
            <div className="text-center space-y-4 animate-fade-in">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-present/15 text-present border border-present/30 mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <h2 className="text-lg font-bold font-display text-ink">Check Your Inbox</h2>

              <div className="bg-bg border border-line rounded-lg p-3.5 text-xs text-muted leading-relaxed text-left space-y-1.5">
                <p className="text-ink font-medium">If an account exists for this email, password reset instructions have been dispatched.</p>
                <p className="text-[11px] text-muted">
                  The security link is valid for <strong>15 minutes</strong>. If you do not see it in your inbox, please verify your Spam/Junk folder.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    setSubmitted(false)
                    setEmail('')
                  }}
                  className="w-full"
                >
                  Send another link
                </Button>

                <Link to="/login" className="w-full">
                  <Button variant="primary" size="md" className="w-full">
                    <ArrowLeft className="w-4 h-4 mr-1.5" />
                    <span>Back to Sign In</span>
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <p className="text-xs text-muted leading-relaxed">
                Enter your registered college email address and we&apos;ll send you a secure link to reset your credentials.
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
                <span>Send Reset Link</span>
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
