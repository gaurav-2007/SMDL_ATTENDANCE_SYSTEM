import { useEffect, useState } from 'react'
import { Users, UserCheck, UserX, Clock, TrendingUp } from 'lucide-react'
import api from '../../lib/api'

export default function AdminHome() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/teachers')
      .then(({ data }) => {
        const teachers = data.data?.teachers || []
        setStats({
          total:    teachers.length,
          active:   teachers.filter(t => t.status === 'ACTIVE').length,
          pending:  teachers.filter(t => t.status === 'PENDING').length,
          rejected: teachers.filter(t => t.status === 'REJECTED').length,
        })
      })
      .catch(() => setStats({ total: 0, active: 0, pending: 0, rejected: 0 }))
      .finally(() => setLoading(false))
  }, [])

  const cards = [
    { label: 'Total Teachers',   value: stats?.total,    Icon: Users,     color: 'bg-blue-500/20 text-blue-400' },
    { label: 'Active Teachers',  value: stats?.active,   Icon: UserCheck, color: 'bg-green-500/20 text-green-400' },
    { label: 'Pending Approval', value: stats?.pending,  Icon: Clock,     color: 'bg-yellow-500/20 text-yellow-400' },
    { label: 'Rejected',         value: stats?.rejected, Icon: UserX,     color: 'bg-red-500/20 text-red-400' },
  ]

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h2 className="page-title">Admin Dashboard</h2>
        <p className="page-subtitle">SMDL College — Overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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

      {/* Quick actions */}
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
                  Teacher Approvals
                </p>
                <p className="text-brand-muted text-xs">
                  {loading ? '...' : `${stats?.pending} pending`}
                </p>
              </div>
            </div>
          </a>
          <div className="card-sm opacity-60">
            <div className="flex items-center gap-3">
              <div className="stat-icon bg-blue-500/20 text-blue-400 w-10 h-10">
                <Users size={18} />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Student Management</p>
                <p className="text-brand-muted text-xs">Coming in Step 10</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
