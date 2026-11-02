import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  MapPin, Camera, RefreshCw, UserCheck, AlertTriangle, CheckCircle2,
  X, Loader2, ArrowRight, ShieldCheck, Check, Sparkles, Compass
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera'
import api from '../../lib/api'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Badge, Button, Select, EmptyState
} from '../../components/ui'

const DEFAULT_COLLEGE_LAT = 19.02479
const DEFAULT_COLLEGE_LON = 73.10159
const DEFAULT_GEOFENCE_RADIUS = 100

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
  const routerLocation = useLocation()
  const navigate = useNavigate()
  const preselectedId = routerLocation?.state?.lectureId || ''
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  const [geofenceConfig, setGeofenceConfig] = useState({
    collegeLat: DEFAULT_COLLEGE_LAT,
    collegeLon: DEFAULT_COLLEGE_LON,
    radiusMeters: DEFAULT_GEOFENCE_RADIUS,
  })

  const [lectures, setLectures] = useState([])
  const [selectedLecture, setSelectedLecture] = useState(preselectedId)
  const [loadingLectures, setLoadingLectures] = useState(true)

  const [latitude, setLatitude] = useState(null)
  const [longitude, setLongitude] = useState(null)
  const [accuracyMeters, setAccuracyMeters] = useState(null)
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
  const locationOk = isDemoBypass || (distanceMeters != null && distanceMeters <= geofenceConfig.radiusMeters)
  const selfieOk = !!selfiePreview
  const canSubmit = !!selectedLecture && (locationOk || isDemoBypass) && selfieOk && !submitting

  // Fetch dynamic geofence configuration from backend
  useEffect(() => {
    (async () => {
      try {
        const { data: geoData } = await api.get('/attendance/geofence-config')
        if (geoData?.data) {
          const lat = parseFloat(geoData.data.college_latitude)
          const lon = parseFloat(geoData.data.college_longitude)
          const rad = parseInt(geoData.data.geofence_radius_meters, 10)
          setGeofenceConfig({
            collegeLat: !isNaN(lat) ? lat : DEFAULT_COLLEGE_LAT,
            collegeLon: !isNaN(lon) ? lon : DEFAULT_COLLEGE_LON,
            radiusMeters: !isNaN(rad) && rad > 0 ? rad : DEFAULT_GEOFENCE_RADIUS,
          })
        }
      } catch (_e) {
        // Fallback defaults retained
      }
    })()
  }, [])

  useEffect(() => {
    (async () => {
      try {
        setLoadingLectures(true)
        const { data } = await api.get('/lectures/active')
        let list = data?.data?.lectures || []

        // If no active lecture manually started by teacher, load scheduled timetable classes for today that are within active window
        if (list.length === 0) {
          try {
            const todayRes = await api.get('/student/today-classes?active_only=true')
            const todayClasses = todayRes?.data?.data?.classes || []
            list = todayClasses
              .filter(c => c.can_mark_attendance)
              .map(c => ({
                id: c.id || c.timetable_id,
                topic: `${c.start_time?.slice(0, 5)} - ${c.end_time?.slice(0, 5)} · ${c.room_number || 'Room'}`,
                subject: { name: c.subject_name, code: c.subject_code },
                division: { name: c.teacher_name || 'Faculty', division_name: '' },
                teacher_name: c.teacher_name,
                is_timetable: true,
                window_expires_at: c.window_expires_at,
              }))
          } catch (_e) {}
        }

        setLectures(list)
        if (preselectedId && list.some(l => l.id === preselectedId)) {
          setSelectedLecture(preselectedId)
        } else if (list.length >= 1) {
          setSelectedLecture(list[0].id)
        } else {
          setSelectedLecture('')
        }
      } catch (e) {
        toast.error(e?.response?.data?.message || 'Failed to load active lectures')
      } finally {
        setLoadingLectures(false)
      }
    })()
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedId])

  async function fetchLocation() {
    setFetchingLoc(true)
    setLocError('')
    try {
      let coords = null
      if (Capacitor.isNativePlatform()) {
        const perm = await Geolocation.checkPermissions()
        if (perm.location !== 'granted') {
          const req = await Geolocation.requestPermissions()
          if (req.location !== 'granted') {
            throw new Error('Location permission was not granted on this device')
          }
        }
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 })
        coords = pos.coords
      } else {
        const pos = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) reject(new Error('Geolocation not supported in browser'))
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000 })
        })
        coords = pos.coords
      }

      if (!coords || coords.latitude == null || coords.longitude == null) {
        throw new Error('Could not acquire valid GPS coordinates')
      }

      const lat = coords.latitude
      const lon = coords.longitude
      setLatitude(lat)
      setLongitude(lon)
      setAccuracyMeters(coords.accuracy ? Math.round(coords.accuracy) : null)

      if (coords.accuracy != null && coords.accuracy > 80 && !isDemoBypass) {
        toast.error(`⚠️ GPS accuracy is low (±${Math.round(coords.accuracy)}m). Please step outdoors for a clearer satellite fix.`)
      }

      const d = haversineMeters(lat, lon, geofenceConfig.collegeLat, geofenceConfig.collegeLon)
      setDistanceMeters(d)
      if (d != null && d > geofenceConfig.radiusMeters && !isDemoBypass) {
        toast.error(`📍 You are ${d}m away — outside the ${geofenceConfig.radiusMeters}m college campus.`)
      } else if (d != null) {
        toast.success(`📍 Location verified: ${d}m from campus center.`)
      }
    } catch (err) {
      const msg = err?.message || 'Location permission denied'
      setLocError(msg)
      toast.error(`Location error: ${msg}. Enable permissions or use Testing Mode.`)
    } finally {
      setFetchingLoc(false)
    }
  }

  // Assign stream to video element after React renders it
  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [cameraOn])

  async function startCamera() {
    setCameraError('')
    setSelfiePreview('')
    try {
      if (Capacitor.isNativePlatform()) {
        try {
          const perm = await CapCamera.checkPermissions({ permissions: ['camera'] })
          if (perm.camera !== 'granted') {
            const req = await CapCamera.requestPermissions({ permissions: ['camera'] })
            if (req.camera !== 'granted') {
              throw new Error('Camera permission was not granted on this device')
            }
          }
        } catch (permErr) {
          console.warn('[Camera] Native permission check warning:', permErr)
          if (!permErr?.message?.includes('Missing the following permissions')) {
            throw permErr
          }
        }
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        if (Capacitor.isNativePlatform()) {
          const photo = await CapCamera.getPhoto({
            quality: 85,
            allowEditing: false,
            resultType: CameraResultType.DataUrl,
            source: CameraSource.Camera,
            direction: 'front',
          })
          if (photo?.dataUrl) {
            setSelfiePreview(photo.dataUrl)
            return
          }
        }
        throw new Error('Camera not supported in this browser')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      setCameraOn(true)
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
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraOn(false)
  }

  async function captureSelfie() {
    if (!videoRef.current || !canvasRef.current) return
    setCapturing(true)
    try {
      const video = videoRef.current

      // Poll via requestAnimationFrame until video has valid pixel dimensions
      await new Promise((resolve, reject) => {
        const deadline = Date.now() + 6000
        function tick() {
          if (video.videoWidth > 0 && video.readyState >= 2) {
            resolve()
          } else if (Date.now() > deadline) {
            reject(new Error('Camera not ready — please wait a moment and try again'))
          } else {
            requestAnimationFrame(tick)
          }
        }
        requestAnimationFrame(tick)
      })

      const canvas = canvasRef.current
      const w = video.videoWidth
      const h = video.videoHeight
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      // Mirror flip for natural selfie preview
      ctx.save()
      ctx.translate(w, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0, w, h)
      ctx.restore()

      const jpeg = canvas.toDataURL('image/jpeg', 0.85)
      if (!jpeg || jpeg.length < 1000) throw new Error('Captured image is empty — try again')
      setSelfiePreview(jpeg)
      stopCamera()
      toast.success('📸 Live selfie captured!')
    } catch (err) {
      toast.error('📸 ' + (err?.message || 'Failed to capture — try again'))
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

  // ── SUCCESS CONFIRMATION RECEIPT ──
  if (successData) {
    const lec = successData.lecture
    return (
      <div className="max-w-xl mx-auto py-6 animate-fade-in">
        <Card className="text-center p-6 sm:p-8">
          <div className="w-16 h-16 mx-auto rounded-full bg-present/15 border-2 border-present/40 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-9 h-9 text-present" />
          </div>

          <h3 className="text-xl sm:text-2xl font-bold font-display text-ink tracking-tight">
            Attendance Marked Successfully!
          </h3>
          <p className="text-xs sm:text-sm text-muted mt-1 mb-6">
            Your physical presence has been authenticated and recorded in the college database.
          </p>

          <div className="space-y-3 text-left bg-bg border border-line rounded-xl p-4 sm:p-5 mb-6 text-xs sm:text-sm">
            {lec && (
              <div className="flex justify-between items-center py-1.5 border-b border-line/60">
                <span className="text-muted">Subject</span>
                <span className="font-semibold text-ink">{lec.subject?.name || '-'}</span>
              </div>
            )}
            {lec && (
              <div className="flex justify-between items-center py-1.5 border-b border-line/60">
                <span className="text-muted">Faculty / Class</span>
                <span className="font-semibold text-ink">
                  {lec.division?.name || lec.teacher_name || ''} {lec.division?.division_name ? `(Div ${lec.division.division_name})` : ''}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center py-1.5 border-b border-line/60">
              <span className="text-muted">📍 GPS Verification</span>
              <span className="font-semibold text-present flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                {successData.distance || (isDemoBypass ? 'Verified (Testing Bypass)' : `${distanceMeters}m from campus`)}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-line/60">
              <span className="text-muted">📸 Live Photo Verification</span>
              <span className="font-semibold text-present flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Facial Authenticated
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-muted">🕒 Recorded At</span>
              <span className="font-semibold text-ink font-mono text-xs">
                {successData.marked_at ? new Date(successData.marked_at).toLocaleString('en-IN') : new Date().toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              size="md"
              className="flex-1"
              onClick={() => navigate('/student')}
            >
              Back to Dashboard
            </Button>
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              onClick={() => {
                setSuccessData(null)
                setSelfiePreview('')
                setDistanceMeters(null)
              }}
            >
              Mark Another Session
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // ── STEPPER STATUS HELPERS ──
  const step1Done = !!selectedLecture && (locationOk || isDemoBypass)
  const step2Done = !!selfiePreview

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* ── PAGE TITLE ── */}
      <div className="pb-2 border-b border-line">
        <h2 className="text-xl sm:text-2xl font-bold font-display text-ink tracking-tight">
          Mark Lecture Attendance
        </h2>
        <p className="text-xs sm:text-sm text-muted mt-0.5">
          Dual verification: Confirm your presence within campus radius and capture a live selfie.
        </p>
      </div>

      {/* ── 3-STEP VISUAL PROGRESS INDICATOR ── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 p-2 bg-surface border border-line rounded-xl shadow-xs">
        {/* Step 1 */}
        <div className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
          step1Done ? 'text-present font-semibold' : 'text-brand font-semibold'
        }`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
            step1Done ? 'bg-present text-white' : 'bg-brand text-white'
          }`}>
            {step1Done ? <Check className="w-3.5 h-3.5" /> : '1'}
          </div>
          <span className="text-xs truncate hidden sm:inline">1. Location</span>
        </div>

        {/* Step 2 */}
        <div className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
          step2Done ? 'text-present font-semibold' : step1Done ? 'text-brand font-semibold' : 'text-muted'
        }`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
            step2Done ? 'bg-present text-white' : step1Done ? 'bg-brand text-white' : 'bg-line text-muted'
          }`}>
            {step2Done ? <Check className="w-3.5 h-3.5" /> : '2'}
          </div>
          <span className="text-xs truncate hidden sm:inline">2. Selfie</span>
        </div>

        {/* Step 3 */}
        <div className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
          canSubmit ? 'text-present font-semibold' : 'text-muted'
        }`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
            canSubmit ? 'bg-present text-white' : 'bg-line text-muted'
          }`}>
            3
          </div>
          <span className="text-xs truncate hidden sm:inline">3. Submit</span>
        </div>
      </div>

      {/* ── MAIN 2-COLUMN VERIFICATION PANELS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── STEP 1: LECTURE SELECTION & GPS GEOFENCE ── */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-brand/10 border border-brand/20 text-brand flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <CardTitle className="text-base">Step 1: Session & Geofence</CardTitle>
              </div>
              {step1Done && (
                <Badge variant="present" size="sm">
                  <Check className="w-3 h-3 mr-0.5" /> Location OK
                </Badge>
              )}
            </div>
            <CardDescription>Select your active class and verify campus location</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Lecture Selection Dropdown */}
            <div>
              <label htmlFor="lecture-select" className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Active Lecture Session
              </label>
              {loadingLectures ? (
                <div className="p-3 bg-bg border border-line rounded-lg text-xs text-muted flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-brand" />
                  <span>Checking active lectures...</span>
                </div>
              ) : lectures.length === 0 ? (
                <div className="p-4 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl text-center">
                  <AlertTriangle className="w-5 h-5 text-grace mx-auto mb-1.5" />
                  <p className="text-xs font-semibold text-ink">No Lecture Open for Attendance</p>
                  <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                    Attendance window opens at lecture start and closes after class. Please check back when your session begins.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <select
                    id="lecture-select"
                    value={selectedLecture}
                    onChange={e => setSelectedLecture(e.target.value)}
                    className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 shadow-xs cursor-pointer"
                  >
                    <option value="">— Select your ongoing lecture —</option>
                    {lectures.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.subject?.name || 'Subject'} · {l.division?.name || ''} {l.division?.division_name ? `Div ${l.division.division_name}` : ''} ({l.topic || 'Class'})
                      </option>
                    ))}
                  </select>
                  <div className="flex justify-between items-center text-[11px] text-muted">
                    <span className="text-present font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-present animate-ping" />
                      Window currently open
                    </span>
                    <span>Max window: 2 hrs</span>
                  </div>
                </div>
              )}
            </div>

            {/* GPS Location Check Button & Status */}
            <div className="space-y-3 pt-2 border-t border-line">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Button
                  variant={step1Done ? 'secondary' : 'primary'}
                  size="sm"
                  id="get-location-btn"
                  onClick={fetchLocation}
                  disabled={fetchingLoc}
                  loading={fetchingLoc}
                >
                  <MapPin className="w-4 h-4 mr-1" />
                  <span>{distanceMeters != null ? 'Re-verify GPS' : 'Verify My Location'}</span>
                </Button>

                {distanceMeters != null && (
                  <Badge variant={locationOk ? 'present' : 'absent'} size="md">
                    {locationOk ? `Within Campus (${distanceMeters}m)` : `${distanceMeters}m away (Limit: ${geofenceConfig.radiusMeters}m)`}
                  </Badge>
                )}
              </div>

              {/* Accuracy alert */}
              {accuracyMeters != null && (
                <p className="text-[11px] text-muted flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5" />
                  <span>GPS Precision: ±{accuracyMeters} meters</span>
                </p>
              )}

              {/* Error message */}
              {locError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-lg text-xs text-absent flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{locError}. Please ensure device GPS is turned on and browser permission is granted.</span>
                </div>
              )}

              {/* Developer Testing Mode Bypass */}
              {isDev && (
                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 cursor-pointer select-none">
                  <input
                    id="demo-bypass-toggle"
                    type="checkbox"
                    className="w-4 h-4 rounded text-brand accent-brand cursor-pointer"
                    checked={isDemoBypass}
                    onChange={e => {
                      setIsDemoBypass(e.target.checked)
                      if (e.target.checked) toast.success('🧪 Testing Mode: Geofence bypass active', { id: 'demo-bypass-on' })
                    }}
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-grace">Developer Testing Mode (Bypass GPS)</span>
                    <span className="block text-[11px] text-muted">Dev environment only — permits marking without physical campus GPS.</span>
                  </div>
                </label>
              )}
            </div>

            {/* Campus Coordinates Info Table */}
            <div className="bg-bg/60 border border-line rounded-lg p-3 text-xs space-y-1.5 text-muted">
              <div className="flex justify-between">
                <span>Campus Location:</span>
                <span className="font-mono text-ink">SMDL College ({geofenceConfig.collegeLat.toFixed(3)}°N, {geofenceConfig.collegeLon.toFixed(3)}°E)</span>
              </div>
              <div className="flex justify-between">
                <span>Geofence Limit:</span>
                <span className="font-semibold text-ink">{geofenceConfig.radiusMeters} meters</span>
              </div>
              <div className="flex justify-between">
                <span>Your Coordinates:</span>
                <span className="font-mono text-ink">
                  {latitude && longitude ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` : 'Not acquired'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── STEP 2: CAMERA & SELFIE WITH OVAL GUIDE ── */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-brand/10 border border-brand/20 text-brand flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <CardTitle className="text-base">Step 2: Live Selfie</CardTitle>
              </div>
              {step2Done && (
                <Badge variant="present" size="sm">
                  <Check className="w-3 h-3 mr-0.5" /> Captured
                </Badge>
              )}
            </div>
            <CardDescription>Capture a clear live face photo for roster verification</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Camera Viewport with Oval Face Guide */}
            <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-slate-900 border border-line flex items-center justify-center shadow-inner">
              {/* Camera Off Placeholder */}
              {!cameraOn && !selfiePreview && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-slate-400 z-10">
                  <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mb-3">
                    <Camera className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-200">Camera Inactive</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Tap "Start Camera" to align your face inside the verification guide.
                  </p>
                </div>
              )}

              {/* Live Video Preview (Always in DOM for reliable canvas dimensions) */}
              <video
                id="selfie-video"
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{
                  transform: 'scaleX(-1)',
                  display: cameraOn && !selfiePreview ? 'block' : 'none',
                }}
              />

              {/* Oval Face Guide Overlay (Only during active camera streaming) */}
              {cameraOn && !selfiePreview && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10">
                  {/* Subtle oval guide */}
                  <div className="w-44 h-56 rounded-[50%] border-2 border-dashed border-white/70 shadow-2xl ring-9999 ring-black/40" />
                  <span className="mt-3 px-2.5 py-1 rounded-full bg-black/60 text-white text-[11px] font-medium backdrop-blur-xs">
                    Align your face within the frame
                  </span>
                </div>
              )}

              {/* Captured Photo Preview */}
              {selfiePreview && (
                <img
                  src={selfiePreview}
                  alt="Captured Selfie"
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <canvas ref={canvasRef} className="hidden" />

            {/* Camera Error Message */}
            {cameraError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-lg text-xs text-absent">
                🚨 {cameraError}
              </div>
            )}

            {/* Action Buttons for Camera */}
            <div className="flex items-center gap-3">
              {!cameraOn && !selfiePreview && (
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  onClick={startCamera}
                >
                  <Camera className="w-4 h-4 mr-1.5" />
                  <span>Start Camera</span>
                </Button>
              )}

              {cameraOn && (
                <>
                  <Button
                    variant="success"
                    size="md"
                    id="capture-btn"
                    className="flex-1 font-semibold"
                    onClick={captureSelfie}
                    loading={capturing}
                    disabled={capturing}
                  >
                    <Camera className="w-4 h-4 mr-1.5" />
                    <span>{capturing ? 'Capturing...' : 'Capture Photo'}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={stopCamera}
                  >
                    <X className="w-4 h-4 mr-1" />
                    <span>Cancel</span>
                  </Button>
                </>
              )}

              {selfiePreview && (
                <div className="w-full flex items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={retakeSelfie}
                    className="flex-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    <span>Retake Photo</span>
                  </Button>
                  <Badge variant="present" size="md">
                    ✓ Face Photo Ready
                  </Badge>
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted leading-relaxed">
              💡 Face must be clearly visible with adequate lighting. This photo is shared with the faculty roster for manual visual confirmation.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── STEP 3: SUBMIT BAR ── */}
      <Card className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-2 border-line">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Attendance Checklist</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={selectedLecture ? 'present' : 'neutral'} size="sm">
              {selectedLecture ? '✓ Lecture Selected' : '1. Choose Lecture'}
            </Badge>
            <Badge variant={locationOk || isDemoBypass ? 'present' : 'neutral'} size="sm">
              {locationOk || isDemoBypass ? '✓ Location Verified' : '2. Verify GPS'}
            </Badge>
            <Badge variant={selfieOk ? 'present' : 'neutral'} size="sm">
              {selfieOk ? '✓ Selfie Captured' : '3. Capture Selfie'}
            </Badge>
          </div>
        </div>

        <Button
          id="submit-attendance-btn"
          variant="success"
          size="lg"
          onClick={submitAttendance}
          disabled={!canSubmit}
          loading={submitting}
          className="w-full sm:w-auto font-semibold px-6 shadow-md"
        >
          <UserCheck className="w-5 h-5 mr-1.5" />
          <span>Confirm & Mark Present</span>
        </Button>
      </Card>
    </div>
  )
}
