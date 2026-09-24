import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, ShieldCheck, Mail, AlertCircle, GraduationCap, ArrowLeft, RefreshCw, CheckCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

export default function PendingApproval() {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(false)

  async function checkApprovalStatus() {
    setChecking(true)
    try {
      const updated = await refreshUser()
      if (!updated) {
        toast.error('Could not connect to server. Try again.')
        return
      }
      if (updated.account_status === 'ACTIVE') {
        toast.success('🎉 Your account has been approved! Redirecting to dashboard...')
        setTimeout(() => navigate('/teacher', { replace: true }), 1200)
      } else if (updated.account_status === 'REJECTED') {
        toast.error('Your account was rejected. Please contact the administrator.')
      } else {
        toast('Still pending. Please wait for the admin to approve your account.', {
          icon: '⏳',
          duration: 4000,
        })
      }
    } catch {
      toast.error('Failed to check status. Please try again.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-dark bg-dot-pattern flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-yellow-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-500/15 border border-yellow-500/30 mb-4 animate-pulse">
            <Clock size={36} className="text-yellow-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Account Pending</h1>
          <p className="text-brand-muted mt-2 text-sm">Waiting for admin approval</p>
        </div>

        <div className="card text-center">
          <div className="bg-yellow-500/10 border border-yellow-500/25 rounded-2xl p-6 mb-6">
            <ShieldCheck size={36} className="text-yellow-400 mx-auto mb-3" />
            <p className="text-white font-semibold text-lg">
              Your account is awaiting administrator approval
            </p>
            <div className="mt-3 inline-flex items-center gap-2 bg-brand-dark/80 rounded-lg px-4 py-2">
              <span className="text-brand-muted text-xs">Account Status:</span>
              <span className="text-yellow-400 text-sm font-bold bg-yellow-500/15 px-2 py-0.5 rounded-full">
                PENDING
              </span>
            </div>
          </div>

          <div className="space-y-3 text-left mb-6">
            {user && (
              <>
                <div className="flex items-center gap-3 text-sm">
                  <GraduationCap size={16} className="text-brand-accent flex-shrink-0" />
                  <div>
                    <p className="text-brand-muted text-xs">Registered as</p>
                    <p className="text-white font-medium">Teacher — {user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Mail size={16} className="text-brand-accent flex-shrink-0" />
                  <div>
                    <p className="text-brand-muted text-xs">What happens next</p>
                    <p className="text-white">An admin will review your registration and approve or reject it.</p>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="bg-brand-dark/60 rounded-xl p-4 mb-6 border border-brand-border">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="text-brand-muted flex-shrink-0 mt-0.5" />
              <p className="text-brand-muted text-xs leading-relaxed">
                Please contact the college administrator if you believe this is taking longer than expected.
                Do not create multiple accounts.
              </p>
            </div>
          </div>

          {/* Check Status Button */}
          <button
            id="check-approval-status-btn"
            type="button"
            onClick={checkApprovalStatus}
            disabled={checking}
            className="btn-primary w-full mb-3"
          >
            {checking ? (
              <><RefreshCw size={16} className="animate-spin" /> Checking...</>
            ) : (
              <><CheckCircle size={16} /> Check Approval Status</>
            )}
          </button>

          <button
            type="button"
            id="pending-go-login-btn"
            onClick={() => {
              logout()
              navigate('/login', { replace: true })
            }}
            className="btn-secondary w-full"
          >
            <ArrowLeft size={16} /> Go to Login
          </button>
        </div>
      </div>
    </div>
  )
}
