import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center gap-6 animate-fade-in">
      <div className="text-8xl font-black text-gradient select-none">404</div>
      <h1 className="text-2xl font-bold text-white">Page Not Found</h1>
      <p className="text-brand-muted text-sm">The page you're looking for doesn't exist.</p>
      <Link to="/" id="go-home-btn" className="btn-primary">
        <Home size={16} /> Back to Home
      </Link>
    </div>
  )
}
