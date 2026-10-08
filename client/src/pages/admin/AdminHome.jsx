import { useEffect, useState, useCallback } from 'react'
import { Users, UserCheck, UserX, Clock, TrendingUp, RefreshCw, CheckCircle, XCircle, GraduationCap, MapPin, Save, RotateCcw } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'

export default function AdminHome() {
  const [teachers, setTeachers] = useState([])
  const [loading,  setLoading]  = useState(true)
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
      // Backend returns data.data.teachers (alias for 'all')
      const list = data.data?.teachers || data.data?.all || []
      setTeachers(list)
    } catch {
      toast.error('Failed to load teacher data')
      setTeachers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTeachers() }, [fetchTeachers])

  const stats = {
    total:    teachers.length,
    active:   teachers.filter(t => (t.status || t.account_status) === 'ACTIVE').length,
    pending:  teachers.filter(t => (t.status || t.account_status) === 'PENDING').length,
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
    if (reason === null) return // user cancelled
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

  const cards = [
    { label: 'Total Teachers',   value: stats.total,    Icon: Users,     color: 'bg-blue-500/20 text-blue-400' },
    { label: 'Active Teachers',  value: stats.active,   Icon: UserCheck, color: 'bg-green-500/20 text-green-400' },
    { label: 'Pending Approval', value: stats.pending,  Icon: Clock,     color: 'bg-yellow-500/20 text-yellow-400' },
    { label: 'Rejected',         value: stats.rejected, Icon: UserX,     color: 'bg-red-500/20 text-red-400' },
  ]

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="page-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="page-title">Admin Dashboard</h2>
          <p className="page-subtitle">SMDL College — Overview</p>
        </div>
        <button
          id="refresh-dashboard-btn"
          onClick={fetchTeachers}
          className="btn-secondary btn-sm gap-1"
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, Icon, color }) => (
          <div key={label} className="stat-card">
            <div className={`stat-icon ${color}`}><Icon size={22} /></div>
            <div>
              <p className="text-2xl font-bold text-white">
                {loading ? <span className="text-brand-muted">—</span> : value}
              </p>
              <p className="text-brand-muted text-xs mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pending Teacher Approvals */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Clock size={18} className="text-yellow-400" />
            Pending Teacher Approvals
            {!loading && stats.pending > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-bold">
                {stats.pending}
              </span>
            )}
          </h3>
          <a href="/admin/teachers" className="text-brand-accent text-xs hover:underline">
            View All Teachers →
          </a>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="spinner w-8 h-8 border-4" />
          </div>
        ) : pendingTeachers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center">
              <CheckCircle size={28} className="text-green-400" />
            </div>
            <div className="text-center">
              <p className="text-white font-medium">All caught up!</p>
              <p className="text-brand-muted text-sm mt-1">No pending teacher approval requests.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingTeachers.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20 hover:border-yellow-500/40 transition-colors"
              >
                {/* Teacher Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {(t.name || t.full_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold truncate">
                      {t.name || t.full_name}
                    </p>
                    <p className="text-brand-muted text-xs truncate">{t.email}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {t.employee_id && (
                        <span className="text-xs font-mono text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded">
                          {t.employee_id}
                        </span>
                      )}
                      {t.department && (
                        <span className="text-xs text-brand-muted flex items-center gap-1">
                          <GraduationCap size={11} />
                          {t.department}
                        </span>
                      )}
                      {t.registered_at && (
                        <span className="text-xs text-brand-muted">
                          Registered: {new Date(t.registered_at).toLocaleDateString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    id={`home-approve-${t.id}`}
                    onClick={() => approve(t.id, t.name || t.full_name)}
                    disabled={actingId === t.id}
                    className="btn-success btn-sm gap-1"
                  >
                    {actingId === t.id
                      ? <div className="spinner w-3 h-3" />
                      : <UserCheck size={14} />}
                    Approve
                  </button>
                  <button
                    id={`home-reject-${t.id}`}
                    onClick={() => reject(t.id, t.name || t.full_name)}
                    disabled={actingId === t.id}
                    className="btn-danger btn-sm gap-1"
                  >
                    <XCircle size={14} />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <TrendingUp size={18} className="text-brand-accent" />
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a href="/admin/teachers" className="card-sm hover:border-brand-accent transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-yellow-500/20 text-yellow-400 w-10 h-10">
                <Clock size={18} />
              </div>
              <div>
                <p className="text-white font-semibold text-sm group-hover:text-brand-accent transition-colors">
                  Teacher Management
                </p>
                <p className="text-brand-muted text-xs">
                  {loading ? '...' : `${stats.pending} pending · ${stats.active} active`}
                </p>
              </div>
            </div>
          </a>
          <a href="/admin/students" className="card-sm hover:border-brand-accent transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-blue-500/20 text-blue-400 w-10 h-10">
                <Users size={18} />
              </div>
              <div>
                <p className="text-white font-semibold text-sm group-hover:text-brand-accent transition-colors">
                  Student Management
                </p>
                <p className="text-brand-muted text-xs">View and manage student accounts</p>
              </div>
            </div>
          </a>
        </div>
      </div>

      {/* Attendance Geofence Settings */}
      <div className="card" id="geofence-settings-card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-white font-semibold flex items-center gap-2">
              <MapPin size={18} className="text-brand-accent" />
              Attendance Geofence Settings
            </h3>
            <p className="text-brand-muted text-xs mt-0.5">
              Configure college GPS coordinates and the allowed physical radius for student attendance verification.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchGeofence}
            disabled={loadingGeofence}
            className="btn-ghost btn-sm gap-1"
          >
            <RefreshCw size={13} className={loadingGeofence ? 'animate-spin' : ''} />
            Refresh Settings
          </button>
        </div>

        {/* Current Active Configuration Status */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-brand-border/80 mb-5">
          <p className="text-xs uppercase font-semibold text-brand-muted tracking-wider mb-2">
            Current Active Configuration
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-brand-card/90 p-3 rounded-lg border border-brand-border">
              <span className="text-brand-muted text-xs block">Active Latitude</span>
              <span className="text-white font-mono font-semibold text-sm">
                {activeGeofence.latitude || '19.02479'}
              </span>
            </div>
            <div className="bg-brand-card/90 p-3 rounded-lg border border-brand-border">
              <span className="text-brand-muted text-xs block">Active Longitude</span>
              <span className="text-white font-mono font-semibold text-sm">
                {activeGeofence.longitude || '73.10159'}
              </span>
            </div>
            <div className="bg-brand-card/90 p-3 rounded-lg border border-brand-border">
              <span className="text-brand-muted text-xs block">Allowed Radius</span>
              <span className="text-brand-accent font-mono font-bold text-sm">
                {activeGeofence.radius || '100'} meters
              </span>
            </div>
          </div>
        </div>

        {/* Geofence Form */}
        <form onSubmit={handleSaveGeofence} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="geo-latitude" className="block text-xs font-medium text-brand-muted mb-1.5">
                College Latitude <span className="text-brand-danger">*</span>
              </label>
              <input
                id="geo-latitude"
                type="number"
                step="any"
                required
                value={geofenceForm.latitude}
                onChange={(e) => setGeofenceForm((prev) => ({ ...prev, latitude: e.target.value }))}
                placeholder="19.02479"
                className="input font-mono text-sm"
              />
              <span className="text-[11px] text-brand-muted/70 mt-1 block">Valid range: -90.0 to +90.0</span>
            </div>

            <div>
              <label htmlFor="geo-longitude" className="block text-xs font-medium text-brand-muted mb-1.5">
                College Longitude <span className="text-brand-danger">*</span>
              </label>
              <input
                id="geo-longitude"
                type="number"
                step="any"
                required
                value={geofenceForm.longitude}
                onChange={(e) => setGeofenceForm((prev) => ({ ...prev, longitude: e.target.value }))}
                placeholder="73.10159"
                className="input font-mono text-sm"
              />
              <span className="text-[11px] text-brand-muted/70 mt-1 block">Valid range: -180.0 to +180.0</span>
            </div>

            <div>
              <label htmlFor="geo-radius" className="block text-xs font-medium text-brand-muted mb-1.5">
                Allowed Radius (Meters) <span className="text-brand-danger">*</span>
              </label>
              <input
                id="geo-radius"
                type="number"
                min="1"
                step="1"
                required
                value={geofenceForm.radius}
                onChange={(e) => setGeofenceForm((prev) => ({ ...prev, radius: e.target.value }))}
                placeholder="100"
                className="input font-mono text-sm"
              />
              <span className="text-[11px] text-brand-muted/70 mt-1 block">Default: 100 meters</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              id="save-geofence-btn"
              type="submit"
              disabled={savingGeofence}
              className="btn-primary btn-sm gap-1.5"
            >
              {savingGeofence ? (
                <>
                  <div className="spinner w-3.5 h-3.5" />
                  <span>Saving Settings...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Save Geofence Settings</span>
                </>
              )}
            </button>

            <button
              id="reset-geofence-btn"
              type="button"
              onClick={handleResetGeofence}
              disabled={savingGeofence}
              className="btn-secondary btn-sm gap-1.5"
            >
              <RotateCcw size={14} />
              <span>Reset to Current Saved</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
