import { useEffect, useState, useCallback } from 'react'
import {
  BarChart2, Download, Filter, Calendar, Users,
  BookOpen, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle, Clock, RefreshCw, Printer, FileSpreadsheet
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'

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
          <div style="font-size:14px;font-weight:bold;margin-top:8px;color:#2563eb;">OFFICIAL ATTENDANCE DEFAULTER REGISTER (< 75%)</div>
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
    <div className="animate-fade-in">
      <div className="page-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="page-title">Reports & Analytics</h2>
          <p className="page-subtitle">College-wide attendance overview and official defaulter registers</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
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
          <button onClick={fetchStats} className="btn btn-ghost btn-sm" title="Refresh metrics">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={exportToCSV}
            className="btn btn-secondary flex items-center gap-1.5 text-xs !py-2"
            title="Download formatted CSV spreadsheet for Microsoft Excel"
          >
            <FileSpreadsheet size={15} className="text-emerald-400" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={printOfficialPDF}
            className="btn btn-primary flex items-center gap-1.5 text-xs !py-2"
            title="Generate and print official college attendance register sheet"
          >
            <Printer size={15} />
            <span>Print Register</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setTab('OVERVIEW')}
          className={`btn btn-sm ${tab === 'OVERVIEW' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <BarChart2 size={14} /> Analytics & Defaulters
        </button>
        <button
          onClick={() => setTab('AUDIT_LOGS')}
          className={`btn btn-sm ${tab === 'AUDIT_LOGS' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Clock size={14} /> Teacher Overrides Audit Log ({auditLogs.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-10 h-10 border-4 border-white/10 border-t-brand-accent rounded-full animate-spin" />
        </div>
      ) : tab === 'OVERVIEW' ? (
        <>
          {/* Live Today Attendance Oversight Strip (Step 7 / Fix #4) */}
          {liveSummary && (
            <div className="card !p-4 mb-6 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-900/40 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h3 className="text-white font-bold text-sm tracking-wide">
                    Live Attendance Today ({liveSummary.date ? new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' }) : 'Today'})
                  </h3>
                </div>
                <span className="badge badge-info text-xs">
                  {liveSummary.today_lectures_count} Scheduled Lectures Today
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 text-xs block mb-0.5">Total Enrolled Students</span>
                  <span className="text-xl font-bold text-white">{liveSummary.total_students}</span>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-emerald-400 text-xs block mb-0.5">Students Present</span>
                  <span className="text-xl font-bold text-emerald-400">{liveSummary.present_count}</span>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-red-400 text-xs block mb-0.5">Students Absent</span>
                  <span className="text-xl font-bold text-red-400">{liveSummary.absent_count}</span>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-brand-accent text-xs block mb-0.5">Today's Attendance Rate</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-brand-accent">{liveSummary.attendance_percentage}%</span>
                    <span className="text-[11px] text-slate-500">({liveSummary.total_marked} marked)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

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
            <p className="text-brand-muted text-xs leading-relaxed">
              Attendance analytics reflect verified lectures and student check-ins.
              Use the Export CSV and Print Register buttons above to generate official examination eligibility rosters.
            </p>
          </div>
        </>
      ) : (
        /* ══════════════════════════════════════════════════════════════════
           TAB 2: TEACHER OVERRIDES AUDIT LOG (Immutable)
        ══════════════════════════════════════════════════════════════════ */
        <div className="card !p-0 overflow-hidden border border-slate-800">
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-sm">Attendance Override Audit Log</h3>
              <p className="text-slate-400 text-xs">Immutable security record of all manual status overrides made by faculty or admins</p>
            </div>
            <span className="badge badge-info text-xs">{auditLogs.length} Records</span>
          </div>

          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Changed By (Faculty / Admin)</th>
                  <th>Status Transition</th>
                  <th>Audit Reason</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40">
                    <td className="text-slate-400 text-xs font-mono">
                      {log.created_at || log.changed_at ? new Date(log.created_at || log.changed_at).toLocaleString('en-IN') : '—'}
                    </td>
                    <td>
                      <p className="text-white font-medium text-xs">
                        {log.user?.full_name || 'Faculty Member'}
                      </p>
                      <p className="text-slate-500 text-[11px]">{log.user?.email || ''}</p>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="badge badge-danger text-[10px]">{log.old_status || log.previous_status || 'ABSENT'}</span>
                        <span className="text-slate-500">➔</span>
                        <span className="badge badge-active text-[10px]">{log.new_status || 'PRESENT'}</span>
                      </div>
                    </td>
                    <td>
                      <span className="text-slate-300 text-xs italic">
                        "{log.reason || 'Manual override'}"
                      </span>
                    </td>
                  </tr>
                ))}
                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-16 text-slate-400 text-xs">
                      No attendance overrides recorded yet. All attendance records are verified.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
