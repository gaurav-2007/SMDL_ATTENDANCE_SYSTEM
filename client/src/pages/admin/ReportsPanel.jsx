import { useEffect, useState, useCallback } from 'react'
import {
  BarChart2, Download, Filter, Calendar, Users,
  BookOpen, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle, Clock, RefreshCw, Printer, FileSpreadsheet,
  ShieldAlert, ArrowRight, UserCheck, Search, Eye, X
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { Capacitor } from '@capacitor/core'
import { useAuth } from '../../context/AuthContext'
import { exportReportFile } from '../../utils/fileExportHelper'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Badge, Button, StatCard, Skeleton, EmptyState, Modal
} from '../../components/ui'

export default function ReportsPanel() {
  const { user } = useAuth()
  const isTeacher = user?.role === 'teacher'

  const [tab, setTab]           = useState(isTeacher ? 'STUDENT_SUBJECT' : 'OVERVIEW')
  const [stats, setStats]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [lowAtt, setLowAtt]     = useState([])
  const [period, setPeriod]     = useState('30')
  const [liveSummary, setLiveSummary] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [showRegisterModal, setShowRegisterModal] = useState(false)

  // Subject-wise Student Attendance State (for Teacher and Admin)
  const [subjectReportData, setSubjectReportData] = useState(null)
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [selectedPeriodDays, setSelectedPeriodDays] = useState('all')
  const [studentSearchQuery, setStudentSearchQuery] = useState('')
  const [studentStatusFilter, setStudentStatusFilter] = useState('ALL') // 'ALL' | 'SAFE' | 'DEFAULTER'
  const [loadingSubjectReport, setLoadingSubjectReport] = useState(false)
  const [selectedStudentHistoryModal, setSelectedStudentHistoryModal] = useState(null)
  const [showSubjectRegisterModal, setShowSubjectRegisterModal] = useState(false)

  const fetchSubjectReport = useCallback(async (subjectId, days) => {
    setLoadingSubjectReport(true)
    try {
      const params = new URLSearchParams()
      if (subjectId) params.append('subject_id', subjectId)
      if (days && days !== 'all') params.append('days', days)
      const res = await api.get(`/attendance/reports/subject-student-attendance?${params.toString()}`)
      if (res.data?.success) {
        setSubjectReportData(res.data.data)
        if (!subjectId && res.data.data?.selected_subject?.id) {
          setSelectedSubjectId(res.data.data.selected_subject.id)
        }
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load subject attendance report')
    } finally {
      setLoadingSubjectReport(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'STUDENT_SUBJECT' && !subjectReportData) {
      fetchSubjectReport(selectedSubjectId, selectedPeriodDays)
    }
  }, [tab, selectedSubjectId, selectedPeriodDays, subjectReportData, fetchSubjectReport])

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const [ovRes, liveRes, audRes] = await Promise.allSettled([
        api.get(`/attendance/reports/overview?days=${period}`),
        api.get('/attendance/live-summary').catch(() => api.get('/admin/attendance/live-summary')),
        api.get('/attendance/audit-logs').catch(() => api.get('/admin/attendance/audit-logs')),
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

  async function exportToCSV() {
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
    const fileName = `SMDL_Attendance_Report_${new Date().toISOString().slice(0, 10)}.csv`

    await exportReportFile({
      content: csvContent,
      fileName,
      mimeType: 'text/csv;charset=utf-8;',
      dialogTitle: 'Save / Open CSV Attendance Report',
      mobileSuccessMsg: '📊 CSV Report ready! Tap "Save to device" to save in Downloads, or open in Excel / Sheets.',
      webSuccessMsg: '📊 CSV Report downloaded! Check your browser Downloads folder.',
    })
  }

    function getRegisterHTML() {
    if (!stats) return ''
    const defaulterRows = (lowAtt || []).map((s, idx) => `
      <tr>
        <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;">${idx + 1}</td>
        <td style="border:1px solid #cbd5e1;padding:8px;font-weight:600;">${s.name}</td>
        <td style="border:1px solid #cbd5e1;padding:8px;">${s.course || 'BSc CS'}</td>
        <td style="border:1px solid #cbd5e1;padding:8px;">${s.division || 'A'}</td>
        <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;">${s.attended ?? 0}</td>
        <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;">${s.total ?? 0}</td>
        <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;color:#dc2626;font-weight:bold;">${(s.percentage || 0).toFixed(1)}%</td>
        <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;color:#dc2626;font-weight:600;">Defaulter (&lt;75%)</td>
      </tr>
    `).join('')

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>SMDL Attendance Register - Official Defaulter Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 24px; font-size: 13px; line-height: 1.4; }
    .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
    .title { font-size: 18px; font-weight: bold; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px; }
    .subtitle { font-size: 12px; color: #475569; margin-top: 4px; }
    .tag { font-size: 13px; font-weight: bold; margin-top: 8px; color: #2563eb; }
    .meta-grid { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; margin-bottom: 16px; border-radius: 6px; }
    .meta-item { font-size: 12px; }
    .meta-item strong { color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #0f172a; color: white; border: 1px solid #0f172a; padding: 8px; text-align: left; font-size: 12px; }
    td { font-size: 12px; }
    .footer { margin-top: 50px; display: flex; justify-content: space-between; text-align: center; page-break-inside: avoid; }
    .sig-line { width: 160px; border-top: 1px solid #333; padding-top: 6px; font-weight: bold; font-size: 11px; }
    @media print {
      body { margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">SMDL COLLEGE OF ARTS, SCIENCE & COMMERCE</div>
    <div class="subtitle">Kalamboli, Navi Mumbai, Maharashtra · Smart Attendance & Academic System</div>
    <div class="tag">OFFICIAL ATTENDANCE DEFAULTER REGISTER (&lt; 75%)</div>
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
      ${defaulterRows || '<tr><td colspan="8" style="text-align:center;padding:20px;border:1px solid #cbd5e1;color:#64748b;">No defaulters found in this period.</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    <div class="sig-line">Class In-Charge</div>
    <div class="sig-line">HOD / Academic Dean</div>
    <div class="sig-line">Principal</div>
  </div>
</body>
</html>`
  }

  async function triggerPrint() {
    if (!stats) return toast.error('No report data available')
    const html = getRegisterHTML()

    // On native mobile (Capacitor Android): opening iframe print fails in WebView.
    // Instead, save and open the HTML register so user can Print/Save as PDF via their device!
    if (Capacitor.isNativePlatform()) {
      const fileName = `SMDL_Attendance_Register_${new Date().toISOString().slice(0, 10)}.html`
      await exportReportFile({
        content: html,
        fileName,
        mimeType: 'text/html;charset=utf-8;',
        dialogTitle: 'Print or Save Register as PDF',
        mobileSuccessMsg: '📄 Document ready! Choose Chrome or Drive to Print or Save as PDF.',
      })
      return
    }

    try {
      let iframe = document.getElementById('print-register-iframe')
      if (iframe) iframe.remove()
      iframe = document.createElement('iframe')
      iframe.id = 'print-register-iframe'
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      document.body.appendChild(iframe)

      const doc = iframe.contentWindow.document
      doc.open()
      doc.write(html)
      doc.close()

      iframe.contentWindow.focus()
      setTimeout(() => {
        try {
          iframe.contentWindow.print()
        } catch (e) {
          console.warn('Iframe print fallback:', e)
        }
      }, 350)
      toast.success('Opening print dialog...')
    } catch (e) {
      toast.error('Print unavailable on this device. Use Save HTML option.')
    }
  }

  async function downloadHTMLReport() {
    if (!stats) return toast.error('No report data available')
    const html = getRegisterHTML()
    const fileName = `SMDL_Attendance_Defaulter_Register_${new Date().toISOString().slice(0, 10)}.html`

    await exportReportFile({
      content: html,
      fileName,
      mimeType: 'text/html;charset=utf-8;',
      dialogTitle: 'Save / Open Official Register',
      mobileSuccessMsg: '📄 Official Register ready! Tap "Save to device" to save in Downloads, or open in browser.',
      webSuccessMsg: '📄 Official Register downloaded! Check your browser Downloads folder.',
    })
  }

  function handlePrintRegisterClick() {
    if (!stats) return toast.error('No report data available')
    setShowRegisterModal(true)
  }

  // Subject CSV Export
  async function exportSubjectCSV() {
    if (!subjectReportData?.selected_subject || !subjectReportData?.students?.length) {
      return toast.error('No student attendance data available to export')
    }
    const subject = subjectReportData.selected_subject
    const sStats = subjectReportData.stats || {}
    const headers = [
      'Sr No',
      'Roll Number',
      'Student Name',
      'Course',
      'Division',
      'Lectures Conducted',
      'Days Present',
      'Days Absent',
      'Attendance %',
      'Status'
    ]
    const rows = subjectReportData.students.map((s, idx) => [
      idx + 1,
      `"${(s.roll_number || '').replace(/"/g, '""')}"`,
      `"${(s.name || '').replace(/"/g, '""')}"`,
      `"${(s.course || '').replace(/"/g, '""')}"`,
      `"${(s.division || '').replace(/"/g, '""')}"`,
      s.total_lectures ?? 0,
      s.attended_lectures ?? 0,
      s.absent_lectures ?? 0,
      `${(s.percentage || 0).toFixed(1)}%`,
      s.is_safe ? 'SAFE (>=75%)' : 'DEFAULTER (<75%)'
    ])

    const summaryRows = [
      ['SMDL COLLEGE OF ARTS, SCIENCE & COMMERCE, KALAMBOLI'],
      [`SUBJECT ATTENDANCE REGISTER - ${subject.name.toUpperCase()} (${subject.code || ''})`],
      [`Class/Division: ${subject.division_name || ''}`, `Course: ${subject.course_name || ''}`],
      [`Generated On: ${new Date().toLocaleString('en-IN')}`],
      [`Filter Period: ${selectedPeriodDays === 'all' ? 'All Lectures' : `Last ${selectedPeriodDays} Days`}`],
      [`Total Lectures Conducted: ${sStats.total_lectures || 0}`, `Total Students Enrolled: ${sStats.total_students || 0}`],
      [`Class Average: ${sStats.class_average ? sStats.class_average.toFixed(1) + '%' : 'N/A'}`, `Defaulters (<75%): ${sStats.defaulters_count || 0}`],
      [],
      headers
    ]

    const csvContent = '\uFEFF' + [...summaryRows.map(r => r.join(',')), ...rows.map(r => r.join(','))].join('\r\n')
    const cleanSubName = (subject.code || subject.name || 'Subject').replace(/[^a-zA-Z0-9]/g, '_')
    const fileName = `SMDL_${cleanSubName}_Attendance_Report_${new Date().toISOString().slice(0, 10)}.csv`

    await exportReportFile({
      content: csvContent,
      fileName,
      mimeType: 'text/csv;charset=utf-8;',
      dialogTitle: `Save / Open ${subject.name} Attendance CSV`,
      mobileSuccessMsg: '📊 Subject CSV Report ready! Tap "Save to device" to save in Downloads, or open in Excel / Sheets.',
      webSuccessMsg: '📊 Subject CSV Report downloaded! Check your browser Downloads folder.',
    })
  }

  // Printable Subject Register HTML Generator
  function getSubjectRegisterHTML() {
    if (!subjectReportData?.selected_subject) return ''
    const subject = subjectReportData.selected_subject
    const sStats = subjectReportData.stats || {}
    const studentRows = (subjectReportData.students || []).map((s, idx) => `
      <tr style="${!s.is_safe ? 'background-color:#fff1f2;' : ''}">
        <td style="border:1px solid #cbd5e1;padding:7px;text-align:center;">${idx + 1}</td>
        <td style="border:1px solid #cbd5e1;padding:7px;font-family:monospace;font-weight:600;">${s.roll_number}</td>
        <td style="border:1px solid #cbd5e1;padding:7px;font-weight:600;">${s.name}</td>
        <td style="border:1px solid #cbd5e1;padding:7px;text-align:center;">${s.total_lectures}</td>
        <td style="border:1px solid #cbd5e1;padding:7px;text-align:center;color:#15803d;font-weight:bold;">${s.attended_lectures}</td>
        <td style="border:1px solid #cbd5e1;padding:7px;text-align:center;color:#b91c1c;font-weight:bold;">${s.absent_lectures}</td>
        <td style="border:1px solid #cbd5e1;padding:7px;text-align:center;font-weight:bold;color:${s.is_safe ? '#15803d' : '#b91c1c'};">${s.percentage.toFixed(1)}%</td>
        <td style="border:1px solid #cbd5e1;padding:7px;text-align:center;">
          <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:bold;${s.is_safe ? 'background-color:#dcfce7;color:#15803d;' : 'background-color:#fee2e2;color:#b91c1c;'}">
            ${s.is_safe ? 'ELIGIBLE' : 'DEFAULTER'}
          </span>
        </td>
      </tr>
    `).join('')

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>SMDL Subject Attendance Register - ${subject.name}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 15px; font-size: 12px; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
          .inst-name { font-size: 16px; font-weight: 800; text-transform: uppercase; margin: 0; letter-spacing: 0.5px; }
          .doc-title { font-size: 13px; font-weight: 700; margin: 4px 0 0; color: #334155; }
          .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-bottom: 12px; font-size: 11px; background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          th { background-color: #0f172a; color: #ffffff; padding: 8px; border: 1px solid #0f172a; text-align: left; }
          .sig-row { display: flex; justify-content: space-between; margin-top: 35px; padding-top: 15px; }
          .sig-box { text-align: center; width: 160px; border-top: 1px dashed #64748b; padding-top: 6px; font-size: 11px; font-weight: 600; color: #334155; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="inst-name">SMDL College of Arts, Science & Commerce</h1>
          <p style="margin:2px 0;font-size:10px;color:#64748b;">Plot No. 1, Sector 3E, CIDCO Colony, Kalamboli, Navi Mumbai - 410218</p>
          <div class="doc-title">OFFICIAL SUBJECT ATTENDANCE REGISTER &amp; ELIGIBILITY REPORT</div>
        </div>

        <div class="meta-grid">
          <div><strong>Subject:</strong> ${subject.name} (${subject.code || 'N/A'})</div>
          <div><strong>Class / Division:</strong> ${subject.division_name || 'N/A'}</div>
          <div><strong>Program / Course:</strong> ${subject.course_name || 'N/A'}</div>
          <div><strong>Report Generated:</strong> ${new Date().toLocaleString('en-IN')}</div>
          <div><strong>Total Lectures Held:</strong> ${sStats.total_lectures || 0}</div>
          <div><strong>Total Students Enrolled:</strong> ${sStats.total_students || 0}</div>
          <div><strong>Subject Average Attendance:</strong> ${sStats.class_average ? sStats.class_average.toFixed(1) + '%' : 'N/A'}</div>
          <div><strong>Defaulters (&lt; 75%):</strong> ${sStats.defaulters_count || 0}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:35px;text-align:center;">Sr.</th>
              <th style="width:85px;">Roll No</th>
              <th>Student Name</th>
              <th style="width:60px;text-align:center;">Lectures</th>
              <th style="width:55px;text-align:center;">Present</th>
              <th style="width:55px;text-align:center;">Absent</th>
              <th style="width:70px;text-align:center;">Attendance %</th>
              <th style="width:85px;text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${studentRows}
          </tbody>
        </table>

        <div class="sig-row">
          <div class="sig-box">Faculty In-Charge</div>
          <div class="sig-box">Head of Department</div>
          <div class="sig-box">Principal / Vice-Principal</div>
        </div>
      </body>
      </html>
    `
  }

  async function downloadSubjectRegisterHTML() {
    if (!subjectReportData?.selected_subject) return toast.error('No report data available')
    const html = getSubjectRegisterHTML()
    const cleanName = (subjectReportData.selected_subject.code || subjectReportData.selected_subject.name || 'Subject').replace(/[^a-zA-Z0-9]/g, '_')
    const fileName = `SMDL_${cleanName}_Register_${new Date().toISOString().slice(0, 10)}.html`

    await exportReportFile({
      content: html,
      fileName,
      mimeType: 'text/html;charset=utf-8;',
      dialogTitle: 'Save / Open Subject Register',
      mobileSuccessMsg: '📄 Subject Register ready! Tap "Save to device" to save in Downloads, or open in browser.',
      webSuccessMsg: '📄 Subject Register downloaded! Check your browser Downloads folder.',
    })
  }

  function handlePrintSubjectRegisterClick() {
    if (!subjectReportData?.selected_subject) return toast.error('No report data available')
    const html = getSubjectRegisterHTML()
    try {
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      document.body.appendChild(iframe)

      const doc = iframe.contentWindow.document
      doc.open()
      doc.write(html)
      doc.close()

      iframe.contentWindow.focus()
      setTimeout(() => {
        try {
          iframe.contentWindow.print()
        } catch (e) {
          console.warn('Iframe print fallback:', e)
        }
      }, 350)
      toast.success('Opening print dialog...')
    } catch (e) {
      toast.error('Print unavailable on this device. Use Save HTML option.')
    }
  }

  const filteredStudents = (subjectReportData?.students || []).filter((s) => {
    const matchesSearch = !studentSearchQuery ||
      s.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
      s.roll_number.toLowerCase().includes(studentSearchQuery.toLowerCase())
    const matchesStatus =
      studentStatusFilter === 'ALL' ||
      (studentStatusFilter === 'SAFE' && s.is_safe) ||
      (studentStatusFilter === 'DEFAULTER' && !s.is_safe)
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-ink tracking-tight">
            {isTeacher ? 'Faculty Subject & Academic Reports' : 'Institutional Reports & Analytics'}
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            {isTeacher
              ? 'Subject-wise student attendance registers, eligibility percentages, and class analytics'
              : 'College-wide attendance registers, examination eligibility thresholds, and audit trails'}
          </p>
        </div>
        {tab !== 'STUDENT_SUBJECT' && (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
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
              onClick={handlePrintRegisterClick}
              variant="primary"
              size="sm"
              className="gap-1.5 text-xs"
              title="Print official register"
            >
              <Printer size={14} />
              <span>Print Register</span>
            </Button>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-bg border border-line rounded-lg w-full sm:w-fit max-w-full overflow-x-auto">
        <button
          onClick={() => setTab('STUDENT_SUBJECT')}
          className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            tab === 'STUDENT_SUBJECT'
              ? 'bg-surface text-ink font-semibold shadow-xs border border-line'
              : 'text-muted hover:text-ink hover:bg-surface/50'
          }`}
        >
          <UserCheck size={13} /> Student Subject Attendance
          {subjectReportData?.students?.length ? (
            <span className="text-[11px] bg-brand/10 text-brand px-1.5 py-0.2 rounded-full font-semibold">
              {subjectReportData.students.length}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setTab('OVERVIEW')}
          className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            tab === 'OVERVIEW'
              ? 'bg-surface text-ink font-semibold shadow-xs border border-line'
              : 'text-muted hover:text-ink hover:bg-surface/50'
          }`}
        >
          <BarChart2 size={13} /> Analytics & Defaulters
        </button>

        {!isTeacher && (
          <button
            onClick={() => setTab('AUDIT_LOGS')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
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
        )}
      </div>

      {tab === 'STUDENT_SUBJECT' ? (
        <div className="space-y-4 max-w-full min-w-0">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 p-4 bg-surface border border-line rounded-xl shadow-xs max-w-full overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto min-w-0">
              <div className="w-full sm:w-auto min-w-0 flex-1">
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Select Subject
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value)
                    fetchSubjectReport(e.target.value, selectedPeriodDays)
                  }}
                  className="w-full sm:max-w-xs md:max-w-sm truncate px-3 py-2 sm:py-1.5 text-xs rounded-lg border border-line bg-bg text-ink font-semibold focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
                >
                  {(subjectReportData?.subjects || []).map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} ({sub.code || 'SUB'}) · {sub.division_name} {sub.is_assigned ? '★' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full sm:w-auto min-w-0">
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
                  Time Period
                </label>
                <select
                  value={selectedPeriodDays}
                  onChange={(e) => {
                    setSelectedPeriodDays(e.target.value)
                    fetchSubjectReport(selectedSubjectId, e.target.value)
                  }}
                  className="w-full sm:w-auto px-3 py-2 sm:py-1.5 text-xs rounded-lg border border-line bg-bg text-ink font-medium focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none cursor-pointer"
                >
                  <option value="all">All Lectures</option>
                  <option value="30">Last 30 Days</option>
                  <option value="90">Last 90 Days</option>
                  <option value="7">Last 7 Days</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto self-stretch sm:self-start md:self-end pt-1 md:pt-0">
              <Button
                onClick={() => fetchSubjectReport(selectedSubjectId, selectedPeriodDays)}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs flex-1 sm:flex-initial justify-center min-w-[90px]"
                title="Refresh Report"
              >
                <RefreshCw size={13} className={loadingSubjectReport ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </Button>
              <Button
                onClick={exportSubjectCSV}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 flex-1 sm:flex-initial justify-center min-w-[100px]"
                title="Download CSV Spreadsheet"
              >
                <FileSpreadsheet size={14} />
                <span>Export CSV</span>
              </Button>
              <Button
                onClick={() => setShowSubjectRegisterModal(true)}
                variant="primary"
                size="sm"
                className="gap-1.5 text-xs flex-1 sm:flex-initial justify-center min-w-[110px]"
                title="Print Subject Register"
              >
                <Printer size={14} />
                <span>Print Register</span>
              </Button>
            </div>
          </div>

          {loadingSubjectReport ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-24 w-full" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
              <Skeleton className="h-64 w-full" />
            </div>
          ) : !subjectReportData?.selected_subject ? (
            <EmptyState
              icon={BookOpen}
              title="No Subject Selected"
              description="Please select a subject from the dropdown above to view student attendance and analytics."
            />
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="p-3.5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0">
                    <BookOpen size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted font-medium">Lectures Held</p>
                    <p className="text-lg font-bold font-display text-ink">
                      {subjectReportData?.stats?.total_lectures ?? 0}
                    </p>
                  </div>
                </Card>

                <Card className="p-3.5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                    <Users size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted font-medium">Total Students</p>
                    <p className="text-lg font-bold font-display text-ink">
                      {subjectReportData?.stats?.total_students ?? 0}
                    </p>
                  </div>
                </Card>

                <Card className="p-3.5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                    <TrendingUp size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted font-medium">Subject Average</p>
                    <p className="text-lg font-bold font-display text-ink">
                      {subjectReportData?.stats?.class_average != null ? `${subjectReportData.stats.class_average}%` : 'N/A'}
                    </p>
                  </div>
                </Card>

                <Card className="p-3.5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted font-medium">Defaulters (&lt;75%)</p>
                    <p className="text-lg font-bold font-display text-red-600">
                      {subjectReportData?.stats?.defaulters_count ?? 0}
                    </p>
                  </div>
                </Card>
              </div>

              {/* Search & Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="relative flex-1 max-w-sm w-full">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    placeholder="Search by student name or roll number..."
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-line bg-surface text-ink placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand/20 outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 bg-bg p-1 rounded-lg border border-line text-xs w-full sm:w-auto overflow-x-auto">
                  <button
                    onClick={() => setStudentStatusFilter('ALL')}
                    className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer shrink-0 ${
                      studentStatusFilter === 'ALL' ? 'bg-surface font-semibold text-ink shadow-xs border border-line' : 'text-muted hover:text-ink'
                    }`}
                  >
                    All ({subjectReportData?.students?.length || 0})
                  </button>
                  <button
                    onClick={() => setStudentStatusFilter('SAFE')}
                    className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer shrink-0 ${
                      studentStatusFilter === 'SAFE' ? 'bg-green-100 text-green-700 font-semibold shadow-xs' : 'text-muted hover:text-ink'
                    }`}
                  >
                    Eligible &ge;75%
                  </button>
                  <button
                    onClick={() => setStudentStatusFilter('DEFAULTER')}
                    className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer shrink-0 ${
                      studentStatusFilter === 'DEFAULTER' ? 'bg-red-100 text-red-700 font-semibold shadow-xs' : 'text-muted hover:text-ink'
                    }`}
                  >
                    Defaulters &lt;75%
                  </button>
                </div>
              </div>

              {/* Student Table */}
              <Card className="overflow-hidden">
                <div className="p-3.5 border-b border-line bg-bg/50 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-ink text-sm">
                      {subjectReportData.selected_subject.name} ({subjectReportData.selected_subject.code || 'N/A'})
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      Class: {subjectReportData.selected_subject.division_name} · Program: {subjectReportData.selected_subject.course_name}
                    </p>
                  </div>
                  <Badge variant="brand">{filteredStudents.length} Students</Badge>
                </div>

                {filteredStudents.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No students match criteria"
                    description="Try adjusting your search query or status filter."
                  />
                ) : (
                  <div>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-line bg-bg/30 text-xs font-semibold text-muted uppercase tracking-wider">
                            <th className="py-3 px-4">Roll No</th>
                            <th className="py-3 px-4">Student</th>
                            <th className="py-3 px-4 text-center">Lectures Held</th>
                            <th className="py-3 px-4 text-center">Present Days</th>
                            <th className="py-3 px-4 text-center">Absent Days</th>
                            <th className="py-3 px-4 text-center">Attendance %</th>
                            <th className="py-3 px-4 text-center">Status</th>
                            <th className="py-3 px-4 text-right">Lecture History</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {filteredStudents.map((s) => (
                            <tr key={s.student_id} className="hover:bg-bg/40 transition-colors">
                              <td className="py-3 px-4">
                                <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-bg border border-line rounded">
                                  {s.roll_number}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <p className="font-semibold text-ink text-xs">{s.name}</p>
                                <p className="text-[11px] text-muted truncate">{s.email}</p>
                              </td>
                              <td className="py-3 px-4 text-center text-xs font-medium text-ink">
                                {s.total_lectures}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                  {s.attended_lectures}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                  {s.absent_lectures}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <span className={`text-xs font-bold font-mono ${s.is_safe ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {s.percentage.toFixed(1)}%
                                  </span>
                                  <div className="w-16 h-1.5 bg-bg border border-line rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${s.is_safe ? 'bg-emerald-500' : 'bg-red-500'}`}
                                      style={{ width: `${Math.min(100, Math.max(0, s.percentage))}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <Badge variant={s.is_safe ? 'present' : 'absent'} size="sm">
                                  {s.is_safe ? 'Eligible' : 'Defaulter'}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <Button
                                  onClick={() => setSelectedStudentHistoryModal(s)}
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 text-xs"
                                >
                                  <Eye size={12} />
                                  <span>View History</span>
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-line">
                      {filteredStudents.map((s) => (
                        <div key={s.student_id} className="p-3.5 space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[11px] font-semibold px-1.5 py-0.2 bg-bg border border-line rounded">
                                  {s.roll_number}
                                </span>
                                <p className="font-semibold text-ink text-xs">{s.name}</p>
                              </div>
                              <p className="text-[11px] text-muted truncate mt-0.5">{s.email}</p>
                            </div>
                            <Badge variant={s.is_safe ? 'present' : 'absent'} size="sm">
                              {s.percentage.toFixed(1)}%
                            </Badge>
                          </div>

                          <div className="grid grid-cols-3 gap-2 p-2 bg-bg/50 rounded-lg border border-line text-center text-xs">
                            <div>
                              <p className="text-[10px] text-muted">Held</p>
                              <p className="font-bold text-ink">{s.total_lectures}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-green-700">Present</p>
                              <p className="font-bold text-green-700">{s.attended_lectures}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-red-700">Absent</p>
                              <p className="font-bold text-red-700">{s.absent_lectures}</p>
                            </div>
                          </div>

                          <Button
                            onClick={() => setSelectedStudentHistoryModal(s)}
                            variant="outline"
                            size="sm"
                            className="w-full gap-1.5 text-xs justify-center"
                          >
                            <Eye size={12} />
                            <span>View Detailed Lecture History</span>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      ) : loading ? (
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
              title="Total Faculty"
              label="Total Faculty"
              value={stats?.total_teachers ?? '—'}
              subtitle={`${stats?.active_teachers || 0} active accounts`}
              sub={`${stats?.active_teachers || 0} active accounts`}
              icon={Users}
            />
            <StatCard
              title="Total Students"
              label="Total Students"
              value={stats?.total_students ?? '—'}
              subtitle={`${stats?.active_students || 0} verified accounts`}
              sub={`${stats?.active_students || 0} verified accounts`}
              icon={Users}
            />
            <StatCard
              title="Lectures Conducted"
              label="Lectures Conducted"
              value={stats?.completed_lectures ?? stats?.total_lectures ?? '—'}
              subtitle="Completed sessions"
              sub="Completed sessions"
              icon={BookOpen}
            />
            <StatCard
              title="Average Turnout"
              label="Average Turnout"
              value={stats?.avg_attendance != null ? `${stats.avg_attendance.toFixed(1)}%` : 'N/A'}
              subtitle="Across all lectures"
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

      {/* Official Defaulter Register & Report Modal */}
      <Modal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        title="Official Attendance Register & Defaulter Report"
        description="SMDL College Official Academic Record (< 75% Requirement)"
        size="xl"
      >
        <div className="space-y-4 max-w-full min-w-0">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-bg border border-line rounded-xl">
            <div className="flex items-center gap-2">
              <Badge variant="absent" size="sm">
                {lowAtt.length} Defaulters Identified
              </Badge>
              <span className="text-xs text-muted">Range: Last {period} Days</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadHTMLReport}
                className="gap-1.5 text-xs"
                title="Download HTML Document"
              >
                <Download size={13} />
                <span>Save HTML</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                className="gap-1.5 text-xs text-emerald-600"
                title="Export CSV"
              >
                <FileSpreadsheet size={13} />
                <span>Export CSV</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={triggerPrint}
                className="gap-1.5 text-xs font-semibold"
                title="Trigger System Print"
              >
                <Printer size={13} />
                <span>Print / PDF</span>
              </Button>
            </div>
          </div>

          {/* Register Document Preview */}
          <div className="border border-line rounded-xl p-4 sm:p-6 bg-surface shadow-xs space-y-4 max-h-[60vh] overflow-y-auto overflow-x-hidden max-w-full">
            {/* College Header */}
            <div className="text-center pb-3 border-b-2 border-line">
              <h2 className="text-base sm:text-lg font-bold font-display text-ink uppercase tracking-wide">
                SMDL COLLEGE OF ARTS, SCIENCE & COMMERCE
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Kalamboli, Navi Mumbai, Maharashtra · Smart Attendance & Academic System
              </p>
              <p className="text-xs font-bold text-brand uppercase tracking-wider mt-2">
                OFFICIAL ATTENDANCE DEFAULTER REGISTER (&lt; 75%)
              </p>
            </div>

            {/* Meta Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-lg bg-bg border border-line text-xs">
              <div>
                <span className="text-muted block text-[11px]">Report Period:</span>
                <span className="font-semibold text-ink">Last {period} Days</span>
              </div>
              <div>
                <span className="text-muted block text-[11px]">Total Students:</span>
                <span className="font-mono font-semibold text-ink">{stats?.total_students || 0}</span>
              </div>
              <div>
                <span className="text-muted block text-[11px]">Average Turnout:</span>
                <span className="font-mono font-semibold text-brand">
                  {stats?.avg_attendance != null ? stats.avg_attendance.toFixed(1) + '%' : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-muted block text-[11px]">Total Defaulters:</span>
                <span className="font-mono font-semibold text-red-600 dark:text-red-400">
                  {lowAtt.length} Students
                </span>
              </div>
            </div>

            {/* Defaulter Table */}
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-bg text-muted font-semibold uppercase tracking-wider border-b border-line">
                    <th className="py-2.5 px-3 text-center">#</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Course</th>
                    <th className="py-2.5 px-3">Division</th>
                    <th className="py-2.5 px-3 text-center">Attended</th>
                    <th className="py-2.5 px-3 text-center">Total</th>
                    <th className="py-2.5 px-3 text-center">Attendance %</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {lowAtt.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-muted">
                        No examination defaulters found below 75% threshold in this period.
                      </td>
                    </tr>
                  ) : (
                    lowAtt.map((s, idx) => (
                      <tr key={s.student_id || idx} className="hover:bg-bg/40">
                        <td className="py-2.5 px-3 text-center font-mono text-muted">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-ink">{s.name}</td>
                        <td className="py-2.5 px-3 text-muted">{s.course || 'BSc CS'}</td>
                        <td className="py-2.5 px-3 text-muted">{s.division || 'A'}</td>
                        <td className="py-2.5 px-3 text-center font-mono">{s.attended ?? 0}</td>
                        <td className="py-2.5 px-3 text-center font-mono">{s.total ?? 0}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-red-600 dark:text-red-400">
                          {(s.percentage || 0).toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300">
                            Defaulter
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Signature Block */}
            <div className="pt-6 mt-4 border-t border-line grid grid-cols-3 gap-4 text-center text-xs text-muted">
              <div>
                <div className="border-t border-ink/40 w-28 sm:w-36 mx-auto mb-1.5" />
                <span className="font-semibold text-ink">Class In-Charge</span>
              </div>
              <div>
                <div className="border-t border-ink/40 w-28 sm:w-36 mx-auto mb-1.5" />
                <span className="font-semibold text-ink">HOD / Academic Dean</span>
              </div>
              <div>
                <div className="border-t border-ink/40 w-28 sm:w-36 mx-auto mb-1.5" />
                <span className="font-semibold text-ink">Principal</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button variant="secondary" size="sm" onClick={() => setShowRegisterModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Student Lecture History Modal */}
      <Modal
        isOpen={Boolean(selectedStudentHistoryModal)}
        onClose={() => setSelectedStudentHistoryModal(null)}
        title={selectedStudentHistoryModal ? `${selectedStudentHistoryModal.name} · Attendance Timeline` : 'Attendance Timeline'}
        description={
          selectedStudentHistoryModal
            ? `Roll No: ${selectedStudentHistoryModal.roll_number} · ${subjectReportData?.selected_subject?.name || ''}`
            : ''
        }
        size="lg"
      >
        {selectedStudentHistoryModal && (
          <div className="space-y-4 max-w-full min-w-0">
            {/* Summary Strip */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-bg border border-line rounded-xl text-center">
              <div>
                <p className="text-[11px] text-muted">Lectures Held</p>
                <p className="text-base font-bold text-ink">{selectedStudentHistoryModal.total_lectures}</p>
              </div>
              <div>
                <p className="text-[11px] text-green-700">Days Present</p>
                <p className="text-base font-bold text-green-700">{selectedStudentHistoryModal.attended_lectures}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted">Percentage</p>
                <p className={`text-base font-bold ${selectedStudentHistoryModal.is_safe ? 'text-green-700' : 'text-red-700'}`}>
                  {selectedStudentHistoryModal.percentage.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Lecture list */}
            {selectedStudentHistoryModal.history?.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No lectures conducted"
                description="No lectures have been scheduled or recorded for this subject in the selected period."
              />
            ) : (
              <div className="max-h-[350px] overflow-y-auto overflow-x-hidden divide-y divide-line border border-line rounded-xl bg-surface">
                {selectedStudentHistoryModal.history.map((lec, idx) => (
                  <div key={lec.lecture_id || idx} className="p-3 flex items-center justify-between gap-2.5 text-xs min-w-0">
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-bold text-ink shrink-0">#{idx + 1}</span>
                        <span className="font-semibold text-ink font-mono shrink-0">{lec.date}</span>
                        <span className="text-muted text-[11px] font-mono shrink-0">{lec.start_time?.slice(0, 5)}</span>
                      </div>
                      <p className="text-muted text-[11px] truncate block">{lec.topic || 'Class Lecture'}</p>
                    </div>

                    <Badge variant={lec.status === 'PRESENT' ? 'present' : 'absent'} size="sm" className="shrink-0">
                      {lec.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={() => setSelectedStudentHistoryModal(null)} variant="outline" size="sm">
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Official Subject Register Modal */}
      <Modal
        isOpen={showSubjectRegisterModal}
        onClose={() => setShowSubjectRegisterModal(false)}
        title={subjectReportData?.selected_subject ? `Official Register: ${subjectReportData.selected_subject.name}` : 'Subject Attendance Register'}
        description="Official SMDL Academic Subject Attendance Register & Examination Eligibility"
        size="xl"
      >
        <div className="space-y-4 max-w-full min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-bg border border-line rounded-xl">
            <div className="flex items-center gap-2">
              <Badge variant="brand" size="sm">
                {subjectReportData?.students?.length || 0} Students
              </Badge>
              <span className="text-xs text-muted">
                Held: {subjectReportData?.stats?.total_lectures || 0} Lectures · Avg: {subjectReportData?.stats?.class_average || 0}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handlePrintSubjectRegisterClick}
                variant="primary"
                size="sm"
                className="gap-1.5 text-xs"
              >
                <Printer size={13} />
                <span>Print Document</span>
              </Button>
              <Button
                onClick={downloadSubjectRegisterHTML}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
              >
                <Download size={13} />
                <span>Save HTML</span>
              </Button>
            </div>
          </div>

          <div
            className="border border-line rounded-xl p-4 bg-white text-slate-900 max-h-[420px] overflow-y-auto overflow-x-auto text-xs font-sans shadow-inner"
            dangerouslySetInnerHTML={{ __html: getSubjectRegisterHTML() }}
          />
        </div>
      </Modal>
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
