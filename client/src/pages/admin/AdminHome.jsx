import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, UserCheck, UserX, Clock, TrendingUp, RefreshCw,
  CheckCircle2, XCircle, GraduationCap, MapPin, Save, RotateCcw,
  ArrowRight, ShieldCheck, Settings
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Badge, Button, Input, StatCard, Skeleton, EmptyState
} from '../../components/ui'

export default function AdminHome() {
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState(null)

  // Geofence configuration state
  const [geofenceForm, setGeofenceForm] = useState({ latitude: '', longitude: '', radius: '' })
  const [activeGeofence, setActiveGeofence] = useState({ latitude: '19.02479', longitude: '73.10159', radius: '100' })
  const [loadingGeofence, setLoadingGeofence] = useState(false)
  const [savingGeofence, setSavingGeofence] = useState(false)

  const fetchGeofence = useCallback(async () => {
    setLoadingGeofence(true)
    try {
      const { data } = await api.get('/admin/config')
      const s = data.data?.settings || {}
      const current = {
        latitude: s.college_latitude || '19.02479',
        longitude: s.college_longitude || '73.10159',
        radius: s.geofence_radius_meters || '100',
      }
      setActiveGeofence(current)
      setGeofenceForm(current)
    } catch {
      // Keep defaults on fetch error
    } finally {
      setLoadingGeofence(false)
    }
  }, [])

  useEffect(() => {
    fetchGeofence()
  }, [fetchGeofence])

  async function handleSaveGeofence(e) {
    e.preventDefault()
    const lat = parseFloat(geofenceForm.latitude)
    const lon = parseFloat(geofenceForm.longitude)
    const rad = parseInt(geofenceForm.radius, 10)

    if (isNaN(lat) || lat < -90 || lat > 90) {
      toast.error('Latitude must be a valid number between -90 and 90')
      return
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      toast.error('Longitude must be a valid number between -180 and 180')
      return
    }
    if (isNaN(rad) || rad <= 0 || !/^\d+$/.test(String(geofenceForm.radius).trim())) {
      toast.error('Radius must be a positive integer greater than 0')
      return
    }
    if (rad > 50000) {
      toast.error('Radius cannot exceed 50,000 meters')
      return
    }

    setSavingGeofence(true)
    try {
      await api.put('/admin/config', {
        college_latitude: String(lat),
        college_longitude: String(lon),
        geofence_radius_meters: String(rad),
      })
      toast.success('Geofence settings updated successfully!')
      const updated = { latitude: String(lat), longitude: String(lon), radius: String(rad) }
      setActiveGeofence(updated)
      setGeofenceForm(updated)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update geofence settings')
    } finally {
      setSavingGeofence(false)
    }
  }

  function handleResetGeofence() {
    setGeofenceForm(activeGeofence)
    toast.success('Reset to current active configuration')
  }

  const fetchTeachers = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/teachers')
      const list = data.data?.teachers || data.data?.all || []
      setTeachers(list)
    } catch {
      toast.error('Failed to load teacher data')
      setTeachers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTeachers()
  }, [fetchTeachers])

  const stats = {
    total: teachers.length,
    active: teachers.filter(t => (t.status || t.account_status) === 'ACTIVE').length,
    pending: teachers.filter(t => (t.status || t.account_status) === 'PENDING').length,
    rejected: teachers.filter(t => (t.status || t.account_status) === 'REJECTED').length,
  }

  const pendingTeachers = teachers.filter(t => (t.status || t.account_status) === 'PENDING')

  async function approve(teacherId, teacherName) {
    setActingId(teacherId)
    try {
      await api.post(`/admin/teachers/${teacherId}/approve`)
      toast.success(`✅ ${teacherName} approved! They can now log in.`)
      setTeachers(prev => prev.map(t =>
        t.id === teacherId ? { ...t, status: 'ACTIVE', account_status: 'ACTIVE' } : t
      ))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approval failed')
    } finally {
      setActingId(null)
    }
  }

  async function reject(teacherId, teacherName) {
    const reason = window.prompt(`Reason for rejecting ${teacherName} (required):`)
    if (reason === null) return
    if (!reason.trim()) {
      toast.error('Rejection reason is required')
      return
    }
    setActingId(teacherId)
    try {
      await api.post(`/admin/teachers/${teacherId}/reject`, { reason })
      toast.success(`${teacherName} rejected.`)
      setTeachers(prev => prev.map(t =>
        t.id === teacherId ? { ...t, status: 'REJECTED', account_status: 'REJECTED' } : t
      ))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rejection failed')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-line">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-ink tracking-tight">
            Administrator Console
          </h2>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            Institution management, faculty credential approval, and geofence boundary configuration
          </p>
        </div>

        <Button
          id="refresh-dashboard-btn"
          variant="outline"
          size="sm"
          onClick={fetchTeachers}
          disabled={loading}
          loading={loading}
          className="self-start sm:self-auto h-9"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          <span>Refresh</span>
        </Button>
      </div>

      {/* ── 4 STAT CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Faculty"
          value={loading ? '—' : stats.total}
          subtitle="Registered teachers"
          icon={Users}
        />
        <StatCard
          title="Active Teachers"
          value={loading ? '—' : stats.active}
          subtitle="Full access granted"
          icon={UserCheck}
        />
        <StatCard
          title="Pending Approvals"
          value={loading ? '—' : stats.pending}
          subtitle="Requires admin action"
          icon={Clock}
          badge={
            stats.pending > 0 ? (
              <Badge variant="grace" size="sm">{stats.pending} Action Needed</Badge>
            ) : undefined
          }
        />
        <StatCard
          title="Rejected Accounts"
          value={loading ? '—' : stats.rejected}
          subtitle="Denied registrations"
          icon={UserX}
        />
      </div>

      {/* ── PENDING TEACHER APPROVALS ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-grace" />
            <CardTitle className="text-base">Pending Teacher Approvals</CardTitle>
            {!loading && stats.pending > 0 && (
              <Badge variant="grace" size="sm">{stats.pending}</Badge>
            )}
          </div>
          <Link to="/admin/teachers" className="text-xs text-brand font-semibold hover:underline inline-flex items-center gap-1">
            <span>View All Faculty</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          ) : pendingTeachers.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="All Caught Up!"
              description="No pending teacher approval requests in the registration queue."
            />
          ) : (
            <div className="divide-y divide-line">
              {pendingTeachers.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-grace/10 border border-grace/20 text-grace font-bold text-sm flex items-center justify-center shrink-0">
                      {(t.name || t.full_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">
                        {t.name || t.full_name}
                      </p>
                      <p className="text-xs text-muted truncate">{t.email}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap text-xs">
                        {t.employee_id && (
                          <span className="font-mono text-brand bg-brand/5 border border-brand/15 px-1.5 py-0.5 rounded font-semibold text-[11px]">
                            ID: {t.employee_id}
                          </span>
                        )}
                        {t.department && (
                          <span className="text-muted flex items-center gap-1 text-[11px]">
                            <GraduationCap className="w-3 h-3 text-muted" />
                            {t.department}
                          </span>
                        )}
                        {t.registered_at && (
                          <span className="text-muted text-[11px]">
                            Registered: {new Date(t.registered_at).toLocaleDateString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      id={`home-approve-${t.id}`}
                      variant="success"
                      size="sm"
                      onClick={() => approve(t.id, t.name || t.full_name)}
                      disabled={actingId === t.id}
                      loading={actingId === t.id}
                      className="h-8"
                    >
                      <UserCheck className="w-3.5 h-3.5 mr-1" />
                      <span>Approve</span>
                    </Button>
                    <Button
                      id={`home-reject-${t.id}`}
                      variant="danger"
                      size="sm"
                      onClick={() => reject(t.id, t.name || t.full_name)}
                      disabled={actingId === t.id}
                      className="h-8"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      <span>Reject</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── QUICK MANAGEMENT ACTIONS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link to="/admin/teachers" className="block">
          <Card hoverable className="p-4 flex items-center justify-between group">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/20 text-brand flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink group-hover:text-brand transition-colors">
                  Faculty Management
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {loading ? '...' : `${stats.pending} pending · ${stats.active} active faculty`}
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted group-hover:text-brand transition-colors shrink-0" />
          </Card>
        </Link>

        <Link to="/admin/students" className="block">
          <Card hoverable className="p-4 flex items-center justify-between group">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-present/10 border border-present/20 text-present flex items-center justify-center shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink group-hover:text-brand transition-colors">
                  Student Database &amp; Cohorts
                </p>
                <p className="text-xs text-muted mt-0.5">View enrolled student cohorts, roll numbers &amp; records</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted group-hover:text-brand transition-colors shrink-0" />
          </Card>
        </Link>
      </div>

      {/* ── ATTENDANCE GEOFENCE SETTINGS ── */}
      <Card id="geofence-settings-card">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-brand" />
              <CardTitle className="text-base">Campus Geofence Configuration</CardTitle>
            </div>
            <CardDescription className="text-xs mt-0.5">
              Define college GPS coordinates and physical radius threshold for student attendance validation.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchGeofence}
            disabled={loadingGeofence}
            className="text-xs h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingGeofence ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Active Configuration Info */}
          <div className="p-3.5 rounded-lg bg-bg border border-line">
            <p className="text-[10px] uppercase font-semibold text-muted tracking-wider mb-2">
              Current Live Campus Boundary
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-muted block text-[11px]">Latitude:</span>
                <span className="font-mono font-semibold text-ink">{activeGeofence.latitude || '19.02479'}° N</span>
              </div>
              <div>
                <span className="text-muted block text-[11px]">Longitude:</span>
                <span className="font-mono font-semibold text-ink">{activeGeofence.longitude || '73.10159'}° E</span>
              </div>
              <div>
                <span className="text-muted block text-[11px]">Authorized Radius:</span>
                <span className="font-semibold text-brand font-mono">{activeGeofence.radius || '100'} meters</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSaveGeofence} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                id="geo-latitude"
                label="College Latitude"
                type="number"
                step="any"
                required
                value={geofenceForm.latitude}
                onChange={(e) => setGeofenceForm((prev) => ({ ...prev, latitude: e.target.value }))}
                placeholder="19.02479"
                helperText="Valid range: -90.0 to +90.0"
              />

              <Input
                id="geo-longitude"
                label="College Longitude"
                type="number"
                step="any"
                required
                value={geofenceForm.longitude}
                onChange={(e) => setGeofenceForm((prev) => ({ ...prev, longitude: e.target.value }))}
                placeholder="73.10159"
                helperText="Valid range: -180.0 to +180.0"
              />

              <Input
                id="geo-radius"
                label="Allowed Radius (Meters)"
                type="number"
                min="1"
                step="1"
                required
                value={geofenceForm.radius}
                onChange={(e) => setGeofenceForm((prev) => ({ ...prev, radius: e.target.value }))}
                placeholder="100"
                helperText="Default: 100 meters (maximum 50,000)"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-line">
              <Button
                id="save-geofence-btn"
                type="submit"
                variant="primary"
                size="sm"
                disabled={savingGeofence}
                loading={savingGeofence}
                className="font-semibold shadow-xs"
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                <span>Save Geofence Settings</span>
              </Button>

              <Button
                id="reset-geofence-btn"
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetGeofence}
                disabled={savingGeofence}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                <span>Reset to Saved</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
