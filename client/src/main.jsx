import React, { Component } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', fontFamily: 'monospace', background: '#fef2f2', color: '#991b1b', minHeight: '100vh' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>
            ⚠️ Frontend Runtime Exception:
          </h2>
          <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #fecaca', marginBottom: '16px' }}>
            <strong>{this.state.error?.toString()}</strong>
          </div>
          <pre style={{ fontSize: '12px', overflow: 'auto', background: '#fff1f2', padding: '12px', borderRadius: '6px' }}>
            {this.state.error?.stack}
          </pre>
          <div style={{ marginTop: '16px' }}>
            <button
              onClick={() => {
                localStorage.clear()
                window.location.reload()
              }}
              style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
            >
              Clear Storage &amp; Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
