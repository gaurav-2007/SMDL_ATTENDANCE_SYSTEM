import { useState } from 'react'
import {
  GraduationCap, User, Mail, Phone, Hash, BookOpen,
  Calendar, ShieldCheck, CheckCircle2, Copy, Check,
  Sparkles, Award, Clock, MapPin, Building2, Briefcase
} from 'lucide-react'
import { Modal, Badge, Button } from '../ui'
import toast from 'react-hot-toast'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  } catch {
    return dateStr
  }
}

export default function UserProfileModal({ isOpen, onClose, user, stats }) {
  const [copied, setCopied] = useState(false)

  if (!user) return null

  const isStudent = user.role === 'student'
  const isTeacher = user.role === 'teacher'
  const isAdmin = user.role === 'admin'

  const rollNumber = user.roll_number || user.profile?.roll_number || '—'
  const courseName = user.course || user.profile?.course || 'Undergraduate Degree'
  const courseCode = user.course_code || user.profile?.course_code || ''
  const divisionName = user.division || user.profile?.division || '—'
  const className = user.class || user.profile?.class || ''
  const email = user.email || '—'
  const phone = user.phone || user.profile?.phone || 'Not Provided'
  const registeredAt = formatDate(user.created_at)

  const overallPct = stats?.percentage != null ? stats.percentage : null
  const isSafe = overallPct != null ? overallPct >= 75 : true

  function handleCopyRoll() {
    if (!rollNumber || rollNumber === '—') return
    navigator.clipboard.writeText(rollNumber)
    setCopied(true)
    toast.success('Roll number copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-xl"
      showClose={true}
    >
      <div className="space-y-5 -mt-1">
        {/* ── DIGITAL ID CARD BANNER ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white p-5 sm:p-6 shadow-lg">
          {/* Subtle watermark logo pattern */}
          <div className="absolute -right-6 -bottom-6 w-36 h-36 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="absolute right-4 top-4 opacity-15 pointer-events-none">
            <GraduationCap className="w-24 h-24 text-white" />
          </div>

          {/* Top College Header */}
          <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-xs">
                <GraduationCap className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-[11px] font-bold tracking-wider uppercase text-indigo-100">SMDL College</p>
                <p className="text-[9px] text-indigo-200 tracking-tight">Smart Attendance System</p>
              </div>
            </div>

            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-xs uppercase tracking-wider text-white border border-white/25">
              {isStudent ? 'Student ID' : isTeacher ? 'Faculty ID' : 'Admin ID'}
            </span>
          </div>

          {/* User Hero Section */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 relative z-10">
            {/* Avatar Circle with initials */}
            <div className="relative shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white text-indigo-700 font-bold font-display text-2xl sm:text-3xl flex items-center justify-center shadow-md ring-4 ring-white/20">
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-indigo-700 flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              </div>
            </div>

            {/* Name & Academic Tag */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-bold font-display text-white tracking-tight leading-snug">
                  {user.name || 'Student Name'}
                </h3>
              </div>

              {isStudent && (
                <p className="text-xs sm:text-sm text-indigo-100 font-medium mt-0.5">
                  {courseName} {courseCode ? `(${courseCode})` : ''}
                </p>
              )}

              {isTeacher && (
                <p className="text-xs sm:text-sm text-indigo-100 font-medium mt-0.5">
                  {user.designation || 'Faculty'} · {user.department || 'Academic Department'}
                </p>
              )}

              {/* Status & Roll pill */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {isStudent && (
                  <button
                    type="button"
                    onClick={handleCopyRoll}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/20 hover:bg-black/30 border border-white/20 text-xs font-mono font-semibold text-white transition-colors cursor-pointer"
                    title="Click to copy roll number"
                  >
                    <Hash className="w-3 h-3 text-indigo-200" />
                    <span>Roll: {rollNumber}</span>
                    {copied ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3 opacity-60" />}
                  </button>
                )}

                {isTeacher && user.employee_id && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/20 border border-white/20 text-xs font-mono font-semibold text-white">
                    <Briefcase className="w-3 h-3 text-indigo-200" />
                    <span>Emp ID: {user.employee_id}</span>
                  </span>
                )}

                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-[11px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{user.account_status || 'ACTIVE'}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── ACADEMIC INFORMATION ── */}
        {isStudent && (
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-brand" />
              <span>Academic Enrollment</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-bg border border-line">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block">Roll Number</span>
                <span className="text-sm font-bold font-display text-ink mt-0.5 block truncate">{rollNumber}</span>
              </div>

              <div className="p-3 rounded-xl bg-bg border border-line">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block">Class & Div</span>
                <span className="text-sm font-bold font-display text-ink mt-0.5 block truncate">
                  {className ? `${className} - ` : ''}{divisionName}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-bg border border-line col-span-2 sm:col-span-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block">Program / Code</span>
                <span className="text-sm font-bold font-display text-brand mt-0.5 block truncate">
                  {courseCode || courseName}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── CONTACT & REGISTRATION DETAILS ── */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-brand" />
            <span>Registration & Contact Details</span>
          </h4>

          <div className="divide-y divide-line/70 rounded-xl border border-line bg-surface overflow-hidden">
            <div className="p-3 sm:px-4 flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2 text-muted shrink-0">
                <User className="w-3.5 h-3.5 text-brand" />
                <span>Full Name</span>
              </span>
              <span className="font-semibold text-ink text-right truncate">{user.name}</span>
            </div>

            <div className="p-3 sm:px-4 flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2 text-muted shrink-0">
                <Mail className="w-3.5 h-3.5 text-brand" />
                <span>Email Address</span>
              </span>
              <span className="font-semibold text-ink text-right truncate flex items-center gap-1.5">
                <span>{email}</span>
                <Badge variant="present" size="sm">Verified</Badge>
              </span>
            </div>

            <div className="p-3 sm:px-4 flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2 text-muted shrink-0">
                <Phone className="w-3.5 h-3.5 text-brand" />
                <span>Phone / Mobile</span>
              </span>
              <span className="font-semibold text-ink text-right">{phone}</span>
            </div>

            <div className="p-3 sm:px-4 flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2 text-muted shrink-0">
                <Calendar className="w-3.5 h-3.5 text-brand" />
                <span>Registered Date</span>
              </span>
              <span className="font-semibold text-ink text-right">{registeredAt}</span>
            </div>

            <div className="p-3 sm:px-4 flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2 text-muted shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-brand" />
                <span>System Role</span>
              </span>
              <span className="font-semibold text-ink capitalize text-right">
                <Badge variant="brand" size="sm">{user.role}</Badge>
              </span>
            </div>
          </div>
        </div>

        {/* ── ATTENDANCE STANDING SNAPSHOT (If student with stats) ── */}
        {isStudent && overallPct != null && (
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-bg to-brand/[0.04] border border-line flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Attendance Standing</span>
              <p className="text-xs text-ink font-semibold">
                {stats.attended ?? 0} attended of {stats.total_lectures ?? 0} sessions
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold font-display text-ink tabular-nums">{overallPct}%</span>
              <Badge variant={isSafe ? 'present' : 'absent'} size="sm">
                {isSafe ? 'Safe' : 'Defaulter'}
              </Badge>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-line">
          <Button variant="secondary" onClick={onClose} size="sm">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
