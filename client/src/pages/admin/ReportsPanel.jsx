import { useEffect, useState, useCallback } from 'react'
import {
  BarChart2, Download, Filter, Calendar, Users,
  BookOpen, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle, Clock, RefreshCw
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'

export default function ReportsPanel() {
  const [stats, setStats]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [lowAtt, setLowAtt]     = useState([])
  const [period, setPeriod]     = useState('30')

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/attendance/reports/overview?days=${period}`)
      setStats(data.data)
      setLowAtt(data.data?.low_attendance || [])
    } catch {
      // fallback with admin stats
      try {
        const [tRes, sRes, lRes] = await Promise.all([
          api.get('/admin/teachers'),
          api.get('/admin/students'),
          api.get('/lectures'),
        ])
        const teachers  = tRes.data.data?.teachers || []
        const students  = sRes.data.data?.students || []
        const lectures  = lRes.data.data?.lectures || []
        setStats({
          total_teachers:   teachers.length,
          active_teachers:  teachers.filter(t => t.status === 'ACTIVE').length,
          total_students:   students.length,
          active_students:  students.filter(s => s.users?.status === 'ACTIVE').length,
          total_lectures:   lectures.length,
          completed_lectures: lectures.filter(l => l.status === 'COMPLETED').length,
          avg_attendance:   null,
          low_attendance:   [],
        })
      } catch {
        toast.error('Could not load reports')
      }
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { fetchStats() }, [fetchStats])

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Reports & Analytics</h2>
          <p className="page-subtitle">College-wide attendance overview</p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            id="period-filter"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="form-input py-2 text-sm"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <button onClick={fetchStats} className="btn btn-ghost btn-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-10 h-10 border-4 border-white/10 border-t-brand-accent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
              label="Total Teachers"
              value={stats?.total_teachers}
              sub={`${stats?.active_teachers} active`}
              Icon={Users}
              color="text-blue-400"
              bg="bg-blue-500/10"
            />
            <KpiCard
              label="Total Students"
              value={stats?.total_students}
              sub={`${stats?.active_students} active`}
              Icon={Users}
              color="text-purple-400"
              bg="bg-purple-500/10"
            />
            <KpiCard
              label="Lectures Held"
              value={stats?.completed_lectures ?? stats?.total_lectures}
              sub="completed lectures"
              Icon={BookOpen}
              color="text-green-400"
              bg="bg-green-500/10"
            />
            <KpiCard
              label="Avg Attendance"
              value={stats?.avg_attendance != null ? `${stats.avg_attendance.toFixed(1)}%` : 'N/A'}
              sub="across all lectures"
              Icon={BarChart2}
              color="text-brand-accent"
              bg="bg-brand-accent/10"
            />
          </div>

          {/* Attendance Health */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="card">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle size={17} className="text-yellow-400" />
                Low Attendance Alert
                <span className="ml-auto badge badge-warning">&lt; 75%</span>
              </h3>
              {lowAtt.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle size={32} className="mx-auto text-green-400 mb-2" />
                  <p className="text-green-400 font-medium">All students above 75%</p>
                  <p className="text-brand-muted text-sm mt-1">No alerts right now 🎉</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {lowAtt.map(s => (
                    <div key={s.student_id} className="flex items-center gap-3 p-2 rounded-lg bg-red-500/5 border border-red-500/20">
                      <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 text-xs font-bold">
                        {s.name?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{s.name}</p>
                        <p className="text-brand-muted text-xs">{s.division} · {s.course}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-red-400 font-bold text-sm">{s.percentage?.toFixed(1)}%</p>
                        <p className="text-brand-muted text-xs">{s.attended}/{s.total}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <TrendingUp size={17} className="text-green-400" />
                System Overview
              </h3>
              <div className="space-y-4">
                <ProgressBar
                  label="Teacher Activation"
                  value={stats?.total_teachers ? (stats.active_teachers / stats.total_teachers * 100) : 0}
                  color="bg-blue-500"
                  textColor="text-blue-400"
                />
                <ProgressBar
                  label="Student Activation"
                  value={stats?.total_students ? (stats.active_students / stats.total_students * 100) : 0}
                  color="bg-purple-500"
                  textColor="text-purple-400"
                />
                <ProgressBar
                  label="Lecture Completion"
                  value={stats?.total_lectures ? ((stats.completed_lectures ?? 0) / stats.total_lectures * 100) : 0}
                  color="bg-green-500"
                  textColor="text-green-400"
                />
                {stats?.avg_attendance != null && (
                  <ProgressBar
                    label="Avg Attendance Rate"
                    value={stats.avg_attendance}
                    color="bg-brand-accent"
                    textColor="text-brand-accent"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Summary info */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} className="text-brand-muted" />
              <p className="text-brand-muted text-sm">Last updated: {new Date().toLocaleTimeString('en-IN')}</p>
            </div>
            <p className="text-brand-muted text-xs">
              Note: Full attendance analytics require active lecture sessions with marked attendance.
              Schedule lectures and have teachers/students mark attendance to see detailed reports here.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function KpiCard({ label, value, sub, Icon, color, bg }) {
  return (
    <div className="stat-card flex-col items-start gap-3">
      <div className={`stat-icon ${bg} ${color}`}><Icon size={20} /></div>
      <div>
        <p className={`text-2xl font-bold ${color}`}>{value ?? '—'}</p>
        <p className="text-white text-sm font-medium mt-0.5">{label}</p>
        <p className="text-brand-muted text-xs mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

function ProgressBar({ label, value, color, textColor }) {
  const pct = Math.min(100, Math.max(0, value || 0))
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-brand-muted text-xs">{label}</span>
        <span className={`text-xs font-semibold ${textColor}`}>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
