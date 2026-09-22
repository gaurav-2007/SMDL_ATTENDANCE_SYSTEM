import { Routes, Route } from 'react-router-dom'
import DashboardLayout from '../../components/layout/DashboardLayout'
import AdminHome from './AdminHome'
import TeachersPanel from './TeachersPanel'
import StudentsPanel from './StudentsPanel'
import AcademicPanel from './AcademicPanel'
import LecturesPanel from './LecturesPanel'
import ReportsPanel from './ReportsPanel'
import AnnouncementsPanel from './AnnouncementsPanel'

export default function AdminDashboard() {
  return (
    <DashboardLayout>
      <Routes>
        <Route index element={<AdminHome />} />
        <Route path="teachers" element={<TeachersPanel />} />
        <Route path="students" element={<StudentsPanel />} />
        <Route path="academic" element={<AcademicPanel />} />
        <Route path="lectures" element={<LecturesPanel />} />
        <Route path="reports" element={<ReportsPanel />} />
        <Route path="announce" element={<AnnouncementsPanel />} />
      </Routes>
    </DashboardLayout>
  )
}

