import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import TeacherLectureReview from './TeacherLectureReview'
import MyClasses from './MyClasses'
import ReportsPanel from '../admin/ReportsPanel'
import AnnouncementsPanel from '../admin/AnnouncementsPanel'
import {
  BookOpen, ClipboardList, BarChart2, Users, Bell,
  ChevronRight, MessageSquare, Clock, Play, Sparkles, CheckCircle2,
  Calendar, MapPin, Zap, AlertCircle
} from 'lucide-react'
import api from '../../lib/api'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Badge, Button, StatCard, Skeleton
} from '../../components/ui'

function TeacherOverview() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [todayData, setTodayData] = useState(null)
  const [profileData, setProfileData] = useState(null)
  const [loadingSchedule, setLoadingSchedule] = useState(true)

  useEffect(() => {
    async function loadToday() {
      try {
        const [todayRes, meRes] = await Promise.allSettled([
          api.get('/lectures/today'),
          api.get('/auth/me'),
        ])
        if (todayRes.status === 'fulfilled') {
          setTodayData(todayRes.value?.data?.data || null)
        }
        if (meRes.status === 'fulfilled') {
          setProfileData(meRes.value?.data?.data || null)
        }
      } catch (e) {
        // silent fail for overview banner
      } finally {
        setLoadingSchedule(false)
      }
    }
    loadToday()
  }, [])

  const cards = [
    { to: '/teacher/classes',    label: 'My Classes & Timetable', Icon: BookOpen,      variant: 'brand',   desc: 'Dynamic daily schedule & official weekly timetable' },
    { to: '/teacher/attendance', label: 'Attendance Review',      Icon: ClipboardList, variant: 'present', desc: 'Live roster, selfie proofs, manual override' },
    { to: '/teacher/reports',    label: 'Reports & Register',     Icon: BarChart2,     variant: 'grace',   desc: 'Class analytics and student attendance percentages' },
    { to: '/teacher/announce',   label: 'Announcements',          Icon: Bell,          variant: 'neutral', desc: 'Send circulars and notices to student batches' },
  ]

  const featuredLecture = todayData?.current_lecture || todayData?.next_lecture || todayData?.my_lectures?.[0] || todayData?.all_lectures?.[0]
  const isOngoing = featuredLecture?.status === 'ONGOING'

  // Teacher profile details (fallback to user from auth context)
  const teacherProfile = profileData?.profile || user?.profile || {}
  const empId = teacherProfile.employee_id || user?.employee_id || 'TCH-1001'
  const dept = teacherProfile.department || user?.department || 'Computer Science'
  const designation = teacherProfile.designation || user?.designation || 'Faculty Member'
  const status = profileData?.status || user?.status || user?.account_status || 'ACTIVE'
  const assignedSubjects = teacherProfile.assigned_subjects || user?.assigned_subjects || []
  const assignedClasses = teacherProfile.assigned_classes || user?.assigned_classes || []

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-line">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-ink tracking-tight flex items-center gap-2">
            <span>Welcome, {user?.name?.split(' ')[0] || user?.full_name?.split(' ')[0] || 'Teacher'}</span>
            <span className="text-lg">👋</span>
          </h2>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            Faculty Dashboard · Department of {dept} · SMDL College
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-line rounded-lg text-xs self-start sm:self-auto shadow-xs">
          <Clock className="w-3.5 h-3.5 text-brand" />
          <span className="font-semibold text-ink">{todayData?.day_name || 'Today'}</span>
          <span className="text-muted">•</span>
          <span className="font-mono text-muted">{todayData?.date || ''}</span>
        </div>
      </div>

      {/* ── TEACHER PROFILE & ASSIGNMENTS CARD ── */}
      <Card className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          {/* Identity Info */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/20 text-brand flex items-center justify-center font-display font-bold text-lg shrink-0">
              {(user?.name || user?.full_name || 'T')[0]?.toUpperCase()}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold font-display text-ink">
                  {user?.name || user?.full_name || 'Faculty Member'}
                </h3>
                <Badge variant={status === 'ACTIVE' ? 'present' : 'grace'} size="sm">
                  {status === 'ACTIVE' ? 'Active & Approved' : 'Pending Verification'}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="font-mono font-semibold text-brand bg-brand/5 border border-brand/15 px-1.5 py-0.5 rounded">
                  ID: {empId}
                </span>
                <span>•</span>
                <span className="text-ink font-medium">{designation}</span>
                <span>•</span>
                <span>Department of {dept}</span>
              </div>
            </div>
          </div>

          {/* Quick Academic Assignment Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="bg-bg border border-line rounded-lg px-3 py-2 text-left">
              <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">Assigned Classes</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {assignedClasses.length > 0 ? (
                  assignedClasses.map((cls, i) => (
                    <Badge key={i} variant="neutral" size="sm">{cls}</Badge>
                  ))
                ) : (
                  <Badge variant="neutral" size="sm">FYBSc CS - Div A</Badge>
                )}
              </div>
            </div>

            <div className="bg-bg border border-line rounded-lg px-3 py-2 text-left">
              <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">Assigned Subjects</p>
              <p className="text-sm font-bold font-display text-ink mt-0.5">
                {assignedSubjects.length > 0 ? assignedSubjects.length : '3'} Curriculums
              </p>
            </div>
          </div>
        </div>

        {/* Assigned Subjects Pills */}
        <div className="mt-4 pt-3.5 border-t border-line">
          <p className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-2 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-brand" />
            <span>Official Curriculum Subjects Assigned to You:</span>
          </p>

          <div className="flex flex-wrap gap-1.5">
            {assignedSubjects.length > 0 ? (
              assignedSubjects.map((subj, idx) => (
                <div
                  key={subj.id || idx}
                  className="px-2.5 py-1 rounded-md bg-bg border border-line flex items-center gap-1.5 text-xs text-ink"
                >
                  <span className="font-mono font-bold text-brand">{subj.code}</span>
                  <span className="text-muted truncate max-w-[200px]">{subj.name}</span>
                  {subj.code?.includes('(P)') && (
                    <Badge variant="neutral" size="sm" className="text-[9px] py-0 px-1">Lab</Badge>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-muted italic">
                Subject mappings will load automatically from the college curriculum database.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* ── FEATURED TODAY'S LECTURE CARD ── */}
      {featuredLecture && (
        <Card className={`p-5 border-2 ${
          isOngoing
            ? 'border-present/50 bg-present/5'
            : 'border-brand/30 bg-surface'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                {isOngoing ? (
                  <Badge variant="live" pulseDot size="sm">
                    LECTURE IN PROGRESS NOW
                  </Badge>
                ) : (
                  <Badge variant="grace" size="sm">
                    UPCOMING TIMETABLE SLOT
                  </Badge>
                )}
                <span className="text-xs font-mono font-semibold text-muted bg-bg border border-line px-2 py-0.5 rounded">
                  {featuredLecture.start_time?.slice(0, 5)} - {featuredLecture.end_time?.slice(0, 5)}
                </span>
              </div>

              <h3 className="text-base sm:text-lg font-bold font-display text-ink leading-tight">
                {featuredLecture.subject?.code ? `${featuredLecture.subject.code}: ` : ''}{featuredLecture.subject?.name}
              </h3>

              <p className="text-xs text-muted flex items-center gap-2 flex-wrap">
                <span>{featuredLecture.division?.name || 'Class'} Div {featuredLecture.division?.division_name || 'A'}</span>
                <span>•</span>
                <span>Faculty: <strong className="text-ink">{featuredLecture.teacher?.full_name || user?.name}</strong></span>
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <Button
                variant={isOngoing ? 'success' : 'primary'}
                size="md"
                onClick={() => navigate('/teacher/attendance', { state: { lectureId: featuredLecture.id } })}
                className="font-semibold shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current mr-1.5" />
                <span>{isOngoing ? 'Live Roster' : 'Open Attendance'}</span>
              </Button>

              <Button
                variant="outline"
                size="md"
                onClick={() => navigate('/teacher/classes')}
              >
                Full Schedule
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ── QUICK NAVIGATION CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(({ to, label, Icon, variant, desc }) => (
          <Card
            key={label}
            hoverable
            onClick={() => navigate(to)}
            className="p-4 flex items-start gap-3.5 cursor-pointer group"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
              variant === 'present'
                ? 'bg-present/10 text-present border-present/20'
                : variant === 'brand'
                ? 'bg-brand/10 text-brand border-brand/20'
                : variant === 'grace'
                ? 'bg-grace/10 text-grace border-grace/20'
                : 'bg-bg text-muted border-line'
            }`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink group-hover:text-brand transition-colors truncate">
                {label}
              </p>
              <p className="text-xs text-muted mt-0.5 line-clamp-2 leading-relaxed">{desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted group-hover:text-brand transition-colors shrink-0 mt-1" />
          </Card>
        ))}
      </div>

      {/* ── QUICK WORKFLOW & CLASSROOM TIPS ── */}
      <Card className="p-5">
        <CardHeader className="p-0 pb-3 border-b-0">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-brand" />
            <CardTitle className="text-base">Classroom Attendance Workflow</CardTitle>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-lg bg-bg border border-line text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold text-ink">
              <span className="w-5 h-5 rounded-full bg-brand/10 text-brand flex items-center justify-center text-[11px] font-bold">1</span>
              <span>Daily Class Schedule</span>
            </div>
            <p className="text-muted leading-relaxed pl-7">
              View your scheduled slots in <strong className="text-ink">My Classes</strong> or click Start Lecture to launch an ad-hoc session.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-bg border border-line text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold text-ink">
              <span className="w-5 h-5 rounded-full bg-present/10 text-present flex items-center justify-center text-[11px] font-bold">2</span>
              <span>Live Selfie Verification</span>
            </div>
            <p className="text-muted leading-relaxed pl-7">
              Review live student check-ins and tap thumbnails in <strong className="text-ink">Attendance Review</strong> to view captured facial proofs.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-bg border border-line text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold text-ink">
              <span className="w-5 h-5 rounded-full bg-grace/10 text-grace flex items-center justify-center text-[11px] font-bold">3</span>
              <span>Phone-less Students</span>
            </div>
            <p className="text-muted leading-relaxed pl-7">
              Directly check-in students who don't have a phone using the 1-click <strong className="text-ink">Mark (No Phone)</strong> button.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default function TeacherDashboard() {
  return (
    <DashboardLayout>
      <Routes>
        <Route index element={<TeacherOverview />} />
        <Route path="classes" element={<MyClasses />} />
        <Route path="attendance" element={<TeacherLectureReview />} />
        <Route path="reports" element={<ReportsPanel />} />
        <Route path="announce" element={<AnnouncementsPanel />} />
        <Route path="*" element={<Navigate to="/teacher" replace />} />
      </Routes>
    </DashboardLayout>
  )
}
