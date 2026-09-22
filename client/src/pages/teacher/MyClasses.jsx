import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen, Users, Play, Bell, RefreshCw,
  GraduationCap, Clock, ChevronRight, Loader2
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'

export default function MyClasses() {
  const navigate = useNavigate()
  const [subjects, setSubjects] = useState([])
  const [divisions, setDivisions] = useState([])
  const [loading, setLoading] = useState(true)

  async function loadData() {
    setLoading(true)
    try {
      const [sRes, dRes] = await Promise.allSettled([
        api.get('/academic/subjects'),
        api.get('/academic/divisions'),
      ])
      if (sRes.status === 'fulfilled') setSubjects(sRes.value?.data?.data?.subjects || [])
      if (dRes.status === 'fulfilled') setDivisions(dRes.value?.data?.data?.divisions || [])
    } catch {
      toast.error('Failed to load classes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  return (
    <div className="animate-fade-in">
      <div className="page-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="page-title">My Classes & Subjects</h2>
          <p className="page-subtitle">Your assigned academic courses, divisions, and active subjects</p>
        </div>
        <button onClick={loadData} className="btn btn-ghost btn-sm flex items-center gap-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="animate-spin w-8 h-8 text-brand-accent" />
        </div>
      ) : subjects.length === 0 ? (
        <div className="card text-center py-20">
          <BookOpen size={44} className="mx-auto text-brand-muted mb-4" />
          <p className="text-white font-semibold text-lg">No classes currently assigned</p>
          <p className="text-brand-muted text-sm mt-1">
            Subjects and divisions will appear here once allocated by college administration.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="stat-card">
              <div className="stat-icon bg-blue-500/20 text-blue-400"><BookOpen size={22} /></div>
              <div>
                <p className="text-2xl font-bold text-white">{subjects.length}</p>
                <p className="text-brand-muted text-xs mt-0.5">Assigned Subjects</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon bg-purple-500/20 text-purple-400"><GraduationCap size={22} /></div>
              <div>
                <p className="text-2xl font-bold text-white">{divisions.length}</p>
                <p className="text-brand-muted text-xs mt-0.5">Active Divisions</p>
              </div>
            </div>
            <div className="stat-card col-span-2 lg:col-span-1">
              <div className="stat-icon bg-emerald-500/20 text-emerald-400"><Users size={22} /></div>
              <div>
                <p className="text-2xl font-bold text-white">Full Access</p>
                <p className="text-brand-muted text-xs mt-0.5">Attendance & Grading</p>
              </div>
            </div>
          </div>

          {/* Classes Grid */}
          <div>
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2 text-base">
              <BookOpen size={18} className="text-brand-accent" />
              Assigned Courses & Lecture Modules
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjects.map((sub) => {
                const divName = sub.divisions?.name || 'Academic'
                const divSection = sub.divisions?.division_name ? `Div ${sub.divisions.division_name}` : ''
                return (
                  <div
                    key={sub.id}
                    className="card flex flex-col justify-between hover:border-brand-accent/50 transition-all group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="badge badge-info text-xs font-mono">{sub.code || 'SUBJ'}</span>
                        <span className="badge badge-active text-[10px]">Active</span>
                      </div>
                      <h4 className="text-white font-bold text-lg group-hover:text-brand-accent transition-colors leading-snug">
                        {sub.name}
                      </h4>
                      <p className="text-brand-muted text-sm mt-1 flex items-center gap-1.5">
                        <GraduationCap size={14} className="text-brand-accent" />
                        <span>{divName} {divSection}</span>
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between gap-2">
                      <button
                        onClick={() => navigate('/teacher/attendance')}
                        className="btn-primary !py-1.5 !px-3 text-xs flex items-center gap-1.5 flex-1 justify-center"
                        title="Start lecture session and review live roster"
                      >
                        <Play size={13} />
                        <span>Start Lecture</span>
                      </button>
                      <button
                        onClick={() => navigate('/teacher/announce')}
                        className="btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1.5 text-brand-muted hover:text-white"
                        title="Send notice to this class"
                      >
                        <Bell size={13} />
                        <span>Notice</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
