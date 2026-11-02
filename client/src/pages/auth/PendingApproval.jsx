import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, ShieldCheck, Mail, AlertCircle, GraduationCap, ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Card, Badge, Button } from '../../components/ui'

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
    <div className="min-h-screen bg-bg text-ink flex items-center justify-center p-4 py-8 relative antialiased">
      <div className="w-full max-w-md animate-fade-in space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-grace/15 border border-grace/30 text-grace shadow-xs mx-auto">
            <Clock className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-ink tracking-tight">Account Pending Approval</h1>
            <p className="text-xs text-muted mt-0.5">Faculty verification required by college administration</p>
          </div>
        </div>

        <Card className="p-6 sm:p-7 text-center shadow-sm space-y-5">
          <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl p-5 text-center space-y-2">
            <ShieldCheck className="w-8 h-8 text-grace mx-auto" />
            <p className="text-sm font-semibold text-ink">
              Your teacher credentials are being reviewed
            </p>
            <div className="inline-flex items-center gap-2 pt-1">
              <Badge variant="grace" size="md">
                Status: Pending Verification
              </Badge>
            </div>
          </div>

          <div className="space-y-3 text-left text-xs bg-bg border border-line rounded-lg p-3.5">
            {user && (
              <>
                <div className="flex items-center gap-3">
                  <GraduationCap className="w-4 h-4 text-brand shrink-0" />
                  <div>
                    <span className="text-muted block text-[11px]">Registered Account:</span>
                    <span className="font-semibold text-ink">Faculty — {user.email}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-1 border-t border-line/60">
                  <Mail className="w-4 h-4 text-brand shrink-0" />
                  <div>
                    <span className="text-muted block text-[11px]">Next Step:</span>
                    <span className="text-ink">The principal or head admin will verify your department and activate your login.</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <p className="text-[11px] text-muted leading-relaxed">
            Please allow up to 24 hours during working college days. You do not need to register again.
          </p>

          <div className="space-y-2 pt-2">
            <Button
              id="check-approval-status-btn"
              variant="primary"
              size="md"
              onClick={checkApprovalStatus}
              disabled={checking}
              loading={checking}
              className="w-full font-semibold shadow-xs"
            >
              <RefreshCw className="w-4 h-4 mr-1.5" />
              <span>Check Approval Status</span>
            </Button>

            <Button
              id="pending-go-login-btn"
              variant="outline"
              size="md"
              onClick={() => {
                logout()
                navigate('/login', { replace: true })
              }}
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              <span>Back to Login</span>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
