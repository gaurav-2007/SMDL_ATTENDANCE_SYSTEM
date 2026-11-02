import { useEffect, useState, useCallback } from 'react'
import {
  BarChart2, Download, Filter, Calendar, Users,
  BookOpen, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle, Clock, RefreshCw, Printer, FileSpreadsheet,
  ShieldAlert, ArrowRight, UserCheck
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Badge, Button, StatCard, Skeleton, EmptyState
} from '../../components/ui'

export default function ReportsPanel() {
  const [tab, setTab]           = useState('OVERVIEW') // 'OVERVIEW' | 'AUDIT_LOGS'
  const [stats, setStats]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [lowAtt, setLowAtt]     = useState([])
  const [period, setPeriod]     = useState('30')
  const [liveSummary, setLiveSummary] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const [ovRes, liveRes, audRes] = await Promise.allSettled([
        api.get(`/attendance/reports/overview?days=${period}`),
        api.get('/admin/attendance/live-summary'),
        api.get('/admin/attendance/audit-logs'),
      ])

      if (ovRes.status === 'fulfilled') {
        setStats(ovRes.value.data?.data)
        setLowAtt(ovRes.value.data?.data?.low_attendance || [])
      }
      if (liveRes.status === 'fulfilled') {
        setLiveSummary(liveRes.value.data?.data || null)
      }
      if (audRes.status === 'fulfilled') {
        setAuditLogs(audRes.value.data?.data?.logs || [])
      }
    } catch {
      toast.error('Could not load reports')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { fetchStats() }, [fetchStats])

  function exportToCSV() {
    if (!stats) return toast.error('No report data available to export')

    const headers = ['Sr No', 'Student Name', 'Course', 'Division', 'Lectures Attended', 'Total Lectures', 'Attendance %', 'Status']
    const rows = (lowAtt || []).map((s, idx) => [
      idx + 1,
      `"${(s.name || 'Student').replace(/"/g, '""')}"`,
      `"${(s.course || 'General').replace(/"/g, '""')}"`,
      `"${(s.division || 'A').replace(/"/g, '""')}"`,
      s.attended ?? 0,
      s.total ?? 0,
      `${(s.percentage || 0).toFixed(1)}%`,
      s.percentage < 75 ? 'DEFAULTER (<75%)' : 'SAFE'
    ])

    const summaryRows = [
      ['SMDL COLLEGE OF ARTS, SCIENCE & COMMERCE, KALAMBOLI'],
      ['ATTENDANCE REPORT & DEFAULTER REGISTER'],
      [`Generated On: ${new Date().toLocaleString('en-IN')}`],
      [`Filter Range: Last ${period} Days`],
      [`Total Students: ${stats.total_students || 0}`, `Average Attendance: ${stats.avg_attendance ? stats.avg_attendance.toFixed(1) + '%' : 'N/A'}`],
      [`Defaulters Identified: ${lowAtt.length}`],
      [],
      headers
    ]

    const csvContent = '\uFEFF' + [...summaryRows.map(r => r.join(',')), ...rows.map(r => r.join(','))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `SMDL_Attendance_Report_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('📊 Excel / CSV Report downloaded!')
  }

  function printOfficialPDF() {
    if (!stats) return toast.error('No report data available')
    const printWindow = window.open('', '_blank')
    if (!printWindow) return toast.error('Popup blocked. Allow popups to print report.')

    const defaulterRows = (lowAtt || []).map((s, idx) => `
      <tr>
        <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;">${idx + 1}</td>
        <td style="border:1px solid #cbd5e1;padding:8px;font-weight:600;">${s.name}</td>
        <td style="border:1px solid #cbd5e1;padding:8px;">${s.course}</td>
        <td style="border:1px solid #cbd5e1;padding:8px;">${s.division}</td>
        <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;">${s.attended}</td>
        <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;">${s.total}</td>
        <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;color:#dc2626;font-weight:bold;">${(s.percentage || 0).toFixed(1)}%</td>
        <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;color:#dc2626;font-weight:600;">Defaulter</td>
      </tr>
    `).join('')

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>SMDL Attendance Register - Official Report</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 30px; font-size: 13px; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
          .title { font-size: 18px; font-weight: bold; text-transform: uppercase; color: #0f172a; }
          .subtitle { font-size: 13px; color: #475569; margin-top: 4px; }
          .meta-grid { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; margin-bottom: 20px; border-radius: 6px; }
          .meta-item { font-size: 12px; }
          .meta-item strong { color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #0f172a; color: white; border: 1px solid #0f172a; padding: 8px; text-align: left; font-size: 12px; }
          .footer { margin-top: 60px; display: flex; justify-content: space-between; text-align: center; }
          .sig-line { width: 180px; border-top: 1px solid #333; padding-top: 6px; font-weight: bold; font-size: 11px; }
          @media print {
            body { margin: 15mm; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">SMDL COLLEGE OF ARTS, SCIENCE & COMMERCE</div>
          <div class="subtitle">Kalamboli, Navi Mumbai, Maharashtra · Smart Attendance & Academic System</div>
          <div style="font-size:14px;font-weight:bold;margin-top:8px;color:#2563eb;">OFFICIAL ATTENDANCE DEFAULTER REGISTER (&lt; 75%)</div>
        </div>

        <div class="meta-grid">
          <div class="meta-item"><strong>Report Period:</strong> Last ${period} Days</div>
          <div class="meta-item"><strong>Generated On:</strong> ${new Date().toLocaleString('en-IN')}</div>
          <div class="meta-item"><strong>Total Students:</strong> ${stats.total_students || 0}</div>
          <div class="meta-item"><strong>Avg Attendance:</strong> ${stats.avg_attendance ? stats.avg_attendance.toFixed(1) + '%' : 'N/A'}</div>
          <div class="meta-item"><strong style="color:#dc2626;">Defaulters:</strong> ${lowAtt.length}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Student Name</th>
              <th>Course</th>
              <th>Division</th>
              <th>Attended</th>
              <th>Total</th>
              <th>Attendance %</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${defaulterRows || '<tr><td colspan="8" style="text-align:center;padding:20px;border:1px solid #cbd5e1;">No defaulters found in this period.</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          <div class="sig-line">Class In-Charge</div>
          <div class="sig-line">HOD / Academic Dean</div>
          <div class="sig-line">Principal</div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 400);
          }
        </script>
      </body>
      </html>
    `
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-ink tracking-tight">
            Institutional Reports & Analytics
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            College-wide attendance registers, examination eligibility thresholds, and audit trails
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            id="period-filter"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-line bg-surface text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <Button onClick={fetchStats} variant="outline" size="sm" className="gap-1.5" title="Refresh metrics">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button
            onClick={exportToCSV}
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            title="Download CSV spreadsheet"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            <span>Export CSV</span>
          </Button>
          <Button
            onClick={printOfficialPDF}
            variant="primary"
            size="sm"
            className="gap-1.5 text-xs"
            title="Print official register"
          >
            <Printer size={14} />
            <span>Print Register</span>
          </Button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex gap-1.5 p-1 bg-bg border border-line rounded-lg w-fit">
        <button
          onClick={() => setTab('OVERVIEW')}
          className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
            tab === 'OVERVIEW'
              ? 'bg-surface text-ink font-semibold shadow-xs border border-line'
              : 'text-muted hover:text-ink hover:bg-surface/50'
          }`}
        >
          <BarChart2 size={13} /> Analytics & Defaulters
        </button>
        <button
          onClick={() => setTab('AUDIT_LOGS')}
          className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
            tab === 'AUDIT_LOGS'
              ? 'bg-surface text-ink font-semibold shadow-xs border border-line'
              : 'text-muted hover:text-ink hover:bg-surface/50'
          }`}
        >
          <Clock size={13} /> Faculty Overrides Audit Log
          <span className="text-[11px] bg-brand/10 text-brand px-1.5 py-0.2 rounded-full font-semibold">
            {auditLogs.length}
          </span>
        </button>
      </div>

      {loading ? (
        <div className="p-8 space-y-4">
          <Skeleton className="h-28 w-full" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </div>
      ) : tab === 'OVERVIEW' ? (
        <div className="space-y-6">
          {/* Live Today Attendance Oversight Banner */}
          {liveSummary && (
            <Card className="p-4 sm:p-5 border-brand/20 bg-gradient-to-r from-brand-50/50 via-surface to-surface dark:from-brand-950/20 dark:via-surface dark:to-surface">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <h3 className="font-semibold text-ink text-sm sm:text-base">
                    Live Today Attendance Oversight ({liveSummary.date ? new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Today'})
                  </h3>
                </div>
                <Badge variant="live">
                  {liveSummary.today_lectures_count} Active / Scheduled Lectures
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-surface p-3.5 rounded-xl border border-line shadow-2xs">
                  <span className="text-muted text-xs block mb-1">Enrolled Students</span>
                  <span className="text-xl sm:text-2xl font-bold font-mono text-ink">{liveSummary.total_students}</span>
                </div>
                <div className="bg-surface p-3.5 rounded-xl border border-line shadow-2xs">
                  <span className="text-green-700 dark:text-green-400 text-xs font-medium block mb-1">Present Today</span>
                  <span className="text-xl sm:text-2xl font-bold font-mono text-green-700 dark:text-green-400">{liveSummary.present_count}</span>
                </div>
                <div className="bg-surface p-3.5 rounded-xl border border-line shadow-2xs">
                  <span className="text-red-700 dark:text-red-400 text-xs font-medium block mb-1">Absent Today</span>
                  <span className="text-xl sm:text-2xl font-bold font-mono text-red-700 dark:text-red-400">{liveSummary.absent_count}</span>
                </div>
                <div className="bg-surface p-3.5 rounded-xl border border-line shadow-2xs">
                  <span className="text-brand text-xs font-medium block mb-1">Attendance Rate</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl sm:text-2xl font-bold font-mono text-brand">{liveSummary.attendance_percentage}%</span>
                    <span className="text-[11px] text-muted font-medium">({liveSummary.total_marked} marked)</span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* KPI Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              label="Total Faculty"
              value={stats?.total_teachers ?? '—'}
              sub={`${stats?.active_teachers || 0} active accounts`}
              icon={Users}
            />
            <StatCard
              label="Total Students"
              value={stats?.total_students ?? '—'}
              sub={`${stats?.active_students || 0} verified accounts`}
              icon={Users}
            />
            <StatCard
              label="Lectures Conducted"
              value={stats?.completed_lectures ?? stats?.total_lectures ?? '—'}
              sub="Completed sessions"
              icon={BookOpen}
            />
            <StatCard
              label="Average Turnout"
              value={stats?.avg_attendance != null ? `${stats.avg_attendance.toFixed(1)}%` : 'N/A'}
              sub="Across all lectures"
              icon={BarChart2}
            />
          </div>

          {/* Defaulter Alert & System Overview Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Defaulters Card */}
            <Card className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-500" />
                  <h3 className="font-semibold text-ink text-sm sm:text-base">
                    Examination Defaulters Alert
                  </h3>
                </div>
                <Badge variant="absent">&lt; 75% Requirement</Badge>
              </div>

              {lowAtt.length === 0 ? (
                <div className="text-center py-10 bg-bg/50 rounded-xl border border-line">
                  <CheckCircle size={32} className="mx-auto text-green-600 mb-2" />
                  <p className="text-ink font-semibold text-sm">All students above 75% threshold</p>
                  <p className="text-muted text-xs mt-0.5">No attendance deficits detected for this period.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {lowAtt.map(s => (
                    <div
                      key={s.student_id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-red-50/50 border border-red-200 dark:bg-red-950/20 dark:border-red-900/40"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 font-semibold text-xs flex items-center justify-center shrink-0">
                          {s.name?.charAt(0) || 'S'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-ink text-xs truncate">{s.name}</p>
                          <p className="text-[11px] text-muted truncate">{s.division} · {s.course}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold font-mono text-red-600 dark:text-red-400">
                          {s.percentage?.toFixed(1)}%
                        </p>
                        <p className="text-[11px] text-muted font-mono">{s.attended} / {s.total} attended</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* System Performance Progress Bars */}
            <Card className="p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={18} className="text-brand" />
                <h3 className="font-semibold text-ink text-sm sm:text-base">
                  System Health & Onboarding Progress
                </h3>
              </div>

              <div className="space-y-4 pt-1">
                <ProgressBar
                  label="Teacher Onboarding & Activation"
                  value={stats?.total_teachers ? (stats.active_teachers / stats.total_teachers * 100) : 0}
                  color="bg-brand"
                />
                <ProgressBar
                  label="Student Enrollment & Activation"
                  value={stats?.total_students ? (stats.active_students / stats.total_students * 100) : 0}
                  color="bg-indigo-600"
                />
                <ProgressBar
                  label="Lecture Completion Rate"
                  value={stats?.total_lectures ? ((stats.completed_lectures ?? 0) / stats.total_lectures * 100) : 0}
                  color="bg-green-600"
                />
                {stats?.avg_attendance != null && (
                  <ProgressBar
                    label="Overall Institutional Attendance Rate"
                    value={stats.avg_attendance}
                    color="bg-emerald-600"
                  />
                )}
              </div>
            </Card>
          </div>
        </div>
      ) : (
        /* Teacher Overrides Audit Trail Tab */
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-line bg-bg/50 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-ink text-sm">Manual Status Override Ledger</h3>
              <p className="text-xs text-muted mt-0.5">Immutable audit trail of all manual status overrides performed by teachers or administrators</p>
            </div>
            <Badge variant="brand">{auditLogs.length} Entries</Badge>
          </div>

          {auditLogs.length === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title="No manual overrides logged"
              description="All attendance sessions were verified purely through automated geofenced selfie check-ins."
            />
          ) : (
            <div>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-line bg-bg/30 text-xs font-semibold text-muted uppercase tracking-wider">
                      <th className="py-3 px-4">Audit Timestamp</th>
                      <th className="py-3 px-4">Authorized User</th>
                      <th className="py-3 px-4">Transition</th>
                      <th className="py-3 px-4">Reason / Justification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-bg/40 transition-colors">
                        <td className="py-3 px-4 text-xs font-mono text-muted">
                          {log.created_at || log.changed_at ? new Date(log.created_at || log.changed_at).toLocaleString('en-IN') : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-ink text-xs leading-tight">
                            {log.user?.full_name || 'Faculty Member'}
                          </p>
                          <p className="text-[11px] text-muted truncate">{log.user?.email || ''}</p>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-xs font-mono">
                            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[11px] font-semibold">
                              {log.old_status || log.previous_status || 'ABSENT'}
                            </span>
                            <ArrowRight size={12} className="text-muted" />
                            <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[11px] font-semibold">
                              {log.new_status || 'PRESENT'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs text-ink italic">
                            "{log.reason || 'Manual override'}"
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-line">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-ink text-xs">{log.user?.full_name || 'Faculty Member'}</p>
                        <p className="text-[11px] text-muted">{log.user?.email || ''}</p>
                      </div>
                      <span className="text-[11px] font-mono text-muted">
                        {log.created_at || log.changed_at ? new Date(log.created_at || log.changed_at).toLocaleDateString('en-IN') : '—'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-mono bg-bg/50 p-2 rounded border border-line">
                      <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-semibold">
                        {log.old_status || log.previous_status || 'ABSENT'}
                      </span>
                      <ArrowRight size={11} className="text-muted" />
                      <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-semibold">
                        {log.new_status || 'PRESENT'}
                      </span>
                      <span className="text-muted text-[11px] ml-auto truncate italic">
                        "{log.reason || 'Manual override'}"
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

function ProgressBar({ label, value, color }) {
  const pct = Math.min(100, Math.max(0, value || 0))
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-mono font-semibold text-ink">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-bg rounded-full overflow-hidden border border-line/60">
        <div
          className={`h-full ${color} rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
