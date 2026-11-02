import { Link } from 'react-router-dom'
import { Home, ArrowLeft } from 'lucide-react'
import { Button, Card } from '../components/ui'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4 animate-fade-in">
      <Card className="max-w-md w-full p-8 text-center space-y-5 shadow-sm border-line">
        <div className="w-16 h-16 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mx-auto text-2xl font-bold font-mono">
          404
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-display text-ink">Page Not Found</h1>
          <p className="text-xs sm:text-sm text-muted mt-1.5">
            The requested institutional URL or dashboard view could not be located.
          </p>
        </div>
        <div className="pt-2">
          <Link to="/" id="go-home-btn" className="inline-block w-full">
            <Button variant="primary" className="w-full gap-2 justify-center">
              <Home size={16} /> Return to Dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
