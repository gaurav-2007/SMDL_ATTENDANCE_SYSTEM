import { useEffect, useRef, useState } from 'react'
import { MapPin, Camera, RefreshCw, UserCheck, AlertTriangle, CheckCircle2, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'

const COLLEGE_LAT = 19.0287
const COLLEGE_LON = 73.1044
const GEOFENCE_RADIUS = 300

function haversineMeters(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

export default function StudentMarkAttendance() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  const [lectures, setLectures] = useState([])
  const [selectedLecture, setSelectedLecture] = useState('')
  const [loadingLectures, setLoadingLectures] = useState(true)

  const [latitude, setLatitude] = useState(null)
  const [longitude, setLongitude] = useState(null)
  const [distanceMeters, setDistanceMeters] = useState(null)
  const [fetchingLoc, setFetchingLoc] = useState(false)
  const [locError, setLocError] = useState('')
  const [isDemoBypass, setIsDemoBypass] = useState(false)

  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [selfiePreview, setSelfiePreview] = useState('')
  const [capturing, setCapturing] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [successData, setSuccessData] = useState(null)

  const isDev = import.meta.env.DEV
  const locationOk = isDemoBypass || (distanceMeters != null && distanceMeters <= GEOFENCE_RADIUS)
  const selfieOk = !!selfiePreview
  const canSubmit = !!selectedLecture && (locationOk || isDemoBypass) && selfieOk && !submitting

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/lectures/active')
        const list = data?.data?.lectures || []
        setLectures(list)
        if (list.length === 1) setSelectedLecture(list[0].id)
      } catch (e) {
        toast.error(e?.response?.data?.message || 'Failed to load active lectures')
      } finally {
        setLoadingLectures(false)
      }
    })()
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchLocation() {
    setFetchingLoc(true)
    setLocError('')
    try {
      const pos = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) reject(new Error('Geolocation not supported'))
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000 })
      })
      const lat = pos.coords.latitude
      const lon = pos.coords.longitude
      setLatitude(lat)
      setLongitude(lon)
      const d = haversineMeters(lat, lon, COLLEGE_LAT, COLLEGE_LON)
      setDistanceMeters(d)
      if (d != null && d > GEOFENCE_RADIUS && !isDemoBypass) {
        toast.error(`📍 You are ${d}m away — outside the 300m college geofence.`)
      } else if (d != null) {
        toast.success(`📍 Location verified — ${d}m from SMDL College.`)
      }
    } catch (err) {
      const msg = err?.message || 'Location permission denied'
      setLocError(msg)
      toast.error(`Location error: ${msg}. Enable permissions or use Testing Mode.`)
    } finally {
      setFetchingLoc(false)
    }
  }

  async function startCamera() {
    setCameraError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera not supported in this browser')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setCameraOn(true)
      setSelfiePreview('')
    } catch (err) {
      const msg = err?.message || 'Camera permission denied'
      setCameraError(msg)
      toast.error(`Camera error: ${msg}. Please allow camera access.`)
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraOn(false)
  }

  function captureSelfie() {
    if (!videoRef.current || !canvasRef.current) return
    setCapturing(true)
    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const w = video.videoWidth || 640
      const h = video.videoHeight || 480
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, w, h)
      const jpeg = canvas.toDataURL('image/jpeg', 0.7)
      setSelfiePreview(jpeg)
      stopCamera()
      toast.success('📸 Selfie captured! Review below.')
    } catch (err) {
      toast.error('Failed to capture selfie: ' + (err?.message || ''))
    } finally {
      setCapturing(false)
    }
  }

  function retakeSelfie() {
    setSelfiePreview('')
    startCamera()
  }

  async function submitAttendance() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const { data } = await api.post('/attendance/mark', {
        lecture_id: selectedLecture,
        latitude,
        longitude,
        selfie: selfiePreview,
        is_demo_bypass: isDemoBypass,
      })
      const att = data?.data?.attendance
      setSuccessData({
        ...(data?.data?.verification || {}),
        lecture: lectures.find(l => l.id === selectedLecture),
        marked_at: att?.marked_at,
      })
      toast.success(data?.message || 'Attendance marked successfully! 🎉')
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to mark attendance')
    } finally {
      setSubmitting(false)
    }
  }

  if (successData) {
    const lec = successData.lecture
    return (
      <div className="animate-fade-in max-w-xl mx-auto">
        <div className="card text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-green-500/15 border-2 border-green-500/40 flex items-center justify-center mb-4">
            <CheckCircle2 size={40} className="text-green-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-1">Attendance Marked Successfully! 🎉</h3>
          <p className="text-brand-muted text-sm mb-6">Your physical presence has been recorded.</p>
          <div className="space-y-3 text-left bg-brand-dark/60 rounded-xl p-4 mb-6">
            {lec && (
              <div className="flex justify-between text-sm">
                <span className="text-brand-muted">Subject</span>
                <span className="text-white font-semibold">{lec.subject?.name || '-'}</span>
              </div>
            )}
            {lec && (
              <div className="flex justify-between text-sm">
                <span className="text-brand-muted">Division / Topic</span>
                <span className="text-white font-semibold">{lec.division?.name || ''} {lec.division?.division_name ? `– Div ${lec.division.division_name}` : ''}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-brand-muted">📍 GPS Distance</span>
              <span className={`font-semibold ${locationOk ? 'text-green-400' : 'text-yellow-400'}`}>
                {successData.distance || (isDemoBypass ? 'Demo Bypass' : 'N/A')}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-brand-muted">📸 Selfie</span>
              <span className="text-green-400 font-semibold">Verified ✓</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-brand-muted">🕒 Marked At</span>
              <span className="text-white font-semibold">
                {successData.marked_at ? new Date(successData.marked_at).toLocaleString() : new Date().toLocaleString()}
              </span>
            </div>
          </div>
          <button className="btn-primary" onClick={() => setSuccessData(null)}>
            Mark Another Attendance
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h2 className="page-title">Mark Present <span className="text-brand-muted text-base font-normal ml-2">GPS + Selfie Verification</span></h2>
        <p className="page-subtitle">You must be within 300m of SMDL College (Kalamboli) with a live selfie capture.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Location Section */}
        <section className="card space-y-5">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-brand-accent" />
            <h3 className="text-white font-semibold">1. Select Lecture & Verify Location</h3>
          </div>

          <div>
            <label className="label">Active Lecture (Today)</label>
            {loadingLectures ? (
              <div className="input flex items-center gap-3"><div className="spinner" /><span className="text-brand-muted">Loading lectures…</span></div>
            ) : lectures.length === 0 ? (
              <div className="input !py-6 text-center">
                <AlertTriangle size={22} className="text-yellow-400 inline mr-2" />
                <span className="text-brand-muted text-sm">No active lectures for your class today.</span>
              </div>
            ) : (
              <select id="lecture-select" className="input" value={selectedLecture} onChange={e => setSelectedLecture(e.target.value)}>
                <option value="">— Choose a lecture —</option>
                {lectures.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.subject?.name || 'Subject'} · {l.division?.name || ''} Div {l.division?.division_name || ''} · {l.topic || ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <div className="flex items-center gap-3 mb-2">
              <button id="get-location-btn" className="btn-secondary" onClick={fetchLocation} disabled={fetchingLoc}>
                {fetchingLoc ? <Loader2 className="animate-spin" /> : <MapPin size={16} />}
                {fetchingLoc ? 'Getting location…' : 'Get My Location'}
              </button>
              {distanceMeters != null && (
                <span className={`badge ${locationOk ? 'badge-active' : 'badge-rejected'}`}>
                  📍 {distanceMeters}m from SMDL College
                </span>
              )}
            </div>
          </div>

          {locError && (
            <div className="card-sm !p-3 !bg-red-500/10 !border-red-500/30 text-red-400 text-sm flex items-start gap-2">
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
              <span>{locError}. Enable browser location permissions or use Testing Mode below.</span>
            </div>
          )}

          {isDev && (
            <label className="flex items-center gap-3 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 cursor-pointer select-none">
              <input
                id="demo-bypass-toggle"
                type="checkbox"
                className="w-4 h-4 accent-yellow-500"
                checked={isDemoBypass}
                onChange={e => {
                  setIsDemoBypass(e.target.checked)
                  if (e.target.checked) toast.success('🧪 Testing Mode enabled: Geofence bypass ON', { id: 'demo-bypass-on' })
                }}
              />
              <span className="text-sm">
                <span className="text-yellow-400 font-semibold">🧪 Testing Mode / Geofence Bypass</span>
                <span className="text-brand-muted block text-xs mt-0.5">Dev only — Skip GPS check when testing from home.</span>
              </span>
            </label>
          )}

          <div className="card-sm !p-4 bg-brand-dark/60 space-y-1 text-xs">
            <div className="text-brand-muted mb-2 font-semibold text-sm">SMDL College Geofence</div>
            <div className="flex justify-between"><span>Campus Coordinates</span><span className="text-white">19.0287° N, 73.1044° E</span></div>
            <div className="flex justify-between"><span>Allowed Radius</span><span className="text-white">{GEOFENCE_RADIUS} meters</span></div>
            <div className="flex justify-between"><span>Your Location</span><span className="text-white">{latitude && longitude ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` : '—'}</span></div>
          </div>
        </section>

        {/* Camera Section */}
        <section className="card space-y-5">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-brand-accent" />
            <h3 className="text-white font-semibold">2. Capture Live Selfie</h3>
          </div>

          <div className="relative aspect-video rounded-xl overflow-hidden bg-black/60 border border-brand-border flex items-center justify-center">
            {!cameraOn && !selfiePreview && (
              <div className="text-center px-6">
                <Camera size={44} className="mx-auto text-brand-muted mb-3" />
                <p className="text-brand-muted text-sm">Click "Start Camera" to begin live selfie capture.</p>
              </div>
            )}
            {cameraOn && (
              <video
                id="selfie-video"
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
            )}
            {selfiePreview && (
              <img src={selfiePreview} alt="Selfie Preview" className="w-full h-full object-cover" />
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />

          {cameraError && (
            <div className="card-sm !p-3 !bg-red-500/10 !border-red-500/30 text-red-400 text-sm">
              🚨 {cameraError}
            </div>
          )}

          <div className="flex items-center gap-3">
            {!cameraOn && !selfiePreview && (
              <button className="btn-primary" onClick={startCamera}>
                <Camera size={16} /> Start Camera
              </button>
            )}
            {cameraOn && (
              <>
                <button id="capture-btn" className="btn-primary" onClick={captureSelfie} disabled={capturing}>
                  {capturing ? <Loader2 className="animate-spin" /> : <Camera size={16} />}
                  {capturing ? 'Capturing…' : 'Capture Selfie'}
                </button>
                <button className="btn-secondary" onClick={stopCamera}>
                  <X size={16} /> Stop
                </button>
              </>
            )}
            {selfiePreview && (
              <>
                <button className="btn-secondary" onClick={retakeSelfie}>
                  <RefreshCw size={16} /> Retake Selfie
                </button>
                <span className="badge badge-active ml-auto">✓ Selfie Ready</span>
              </>
            )}
          </div>

          <div className="text-xs text-brand-muted card-sm !p-3 !bg-brand-dark/60 !border-dashed">
            💡 <strong className="text-white">Note:</strong> Your face must be clearly visible in the selfie. The captured photo will be shown to your teacher for live roster review.
          </div>
        </section>
      </div>

      {/* Submit Bar */}
      <div className="mt-8 card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-sm space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {!selectedLecture && <span className="badge badge-rejected">⚠️ Lecture not selected</span>}
            {selectedLecture && <span className="badge badge-active">✓ Lecture selected</span>}
            {!locationOk && !isDemoBypass && <span className="badge badge-rejected">⚠️ Location not verified</span>}
            {(locationOk || isDemoBypass) && <span className="badge badge-active">✓ Location OK</span>}
            {!selfieOk && <span className="badge badge-rejected">⚠️ Selfie not captured</span>}
            {selfieOk && <span className="badge badge-active">✓ Selfie OK</span>}
          </div>
        </div>
        <button
          id="submit-attendance-btn"
          className="btn-primary btn-lg w-full sm:w-auto"
          onClick={submitAttendance}
          disabled={!canSubmit}
          style={{ opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
        >
          {submitting ? <Loader2 className="animate-spin" /> : <UserCheck size={18} />}
          {submitting ? 'Submitting…' : '✓ Mark Me Present Now'}
        </button>
      </div>
    </div>
  )
}
