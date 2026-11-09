import { useState, useEffect, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { Camera as CapCamera } from '@capacitor/camera'
import { PushNotifications } from '@capacitor/push-notifications'
import {
  MapPin, Camera, Bell, ShieldCheck, CheckCircle2,
  AlertCircle, ChevronRight, Loader2, X
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function PermissionSetupModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [allDone, setAllDone] = useState(false)

  const [perms, setPerms] = useState({
    location: 'prompt',      // 'granted' | 'prompt' | 'denied'
    camera: 'prompt',
    notifications: 'prompt',
  })

  // Check current permission states on mount
  const checkCurrentPermissions = useCallback(async () => {
    // Check if dismissed in this session
    const dismissed = sessionStorage.getItem('smdl_perm_dismissed')
    if (dismissed === 'true') {
      return
    }

    const current = {
      location: 'prompt',
      camera: 'prompt',
      notifications: 'prompt',
    }

    // 1. Geolocation
    try {
      if (Capacitor.isNativePlatform()) {
        const geoStatus = await Geolocation.checkPermissions()
        current.location = geoStatus.location === 'granted' || geoStatus.coarseLocation === 'granted'
          ? 'granted'
          : geoStatus.location === 'denied' ? 'denied' : 'prompt'
      } else if (navigator.permissions?.query) {
        try {
          const q = await navigator.permissions.query({ name: 'geolocation' })
          current.location = q.state === 'granted' ? 'granted' : q.state === 'denied' ? 'denied' : 'prompt'
        } catch {}
      }
    } catch (e) {
      console.warn('[Perms] Geo check error:', e)
    }

    // 2. Camera
    try {
      if (Capacitor.isNativePlatform()) {
        const camStatus = await CapCamera.checkPermissions({ permissions: ['camera'] })
        current.camera = camStatus.camera === 'granted'
          ? 'granted'
          : camStatus.camera === 'denied' ? 'denied' : 'prompt'
      } else if (navigator.permissions?.query) {
        try {
          const q = await navigator.permissions.query({ name: 'camera' })
          current.camera = q.state === 'granted' ? 'granted' : q.state === 'denied' ? 'denied' : 'prompt'
        } catch {}
      }
    } catch (e) {
      console.warn('[Perms] Camera check error:', e)
    }

    // 3. Notifications
    try {
      if (Capacitor.isNativePlatform()) {
        const notifStatus = await PushNotifications.checkPermissions()
        current.notifications = notifStatus.receive === 'granted'
          ? 'granted'
          : notifStatus.receive === 'denied' ? 'denied' : 'prompt'
      } else if (typeof window !== 'undefined' && 'Notification' in window) {
        current.notifications = Notification.permission === 'granted'
          ? 'granted'
          : Notification.permission === 'denied' ? 'denied' : 'prompt'
      }
    } catch (e) {
      console.warn('[Perms] Notif check error:', e)
    }

    setPerms(current)

    // If any required permission is missing, show modal
    const hasMissing = current.location !== 'granted' || current.camera !== 'granted' || current.notifications !== 'granted'
    if (hasMissing) {
      // Small timeout so dashboard renders smoothly before modal pops
      const timer = setTimeout(() => setIsOpen(true), 800)
      return () => clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    checkCurrentPermissions()
  }, [checkCurrentPermissions])

  // Sequentially request all permissions in one smooth flow
  const handleGrantAll = async () => {
    setRequesting(true)
    const updated = { ...perms }

    // 1. Notification Permission
    try {
      if (Capacitor.isNativePlatform()) {
        const res = await PushNotifications.requestPermissions()
        updated.notifications = res.receive === 'granted' ? 'granted' : 'denied'
      } else if (typeof window !== 'undefined' && 'Notification' in window) {
        const res = await Notification.requestPermission()
        updated.notifications = res === 'granted' ? 'granted' : 'denied'
      }
    } catch (err) {
      console.warn('[Perms] Notification request error:', err)
      updated.notifications = 'denied'
    }
    setPerms({ ...updated })

    // 2. Geolocation / Location Permission
    try {
      if (Capacitor.isNativePlatform()) {
        const res = await Geolocation.requestPermissions()
        updated.location = (res.location === 'granted' || res.coarseLocation === 'granted') ? 'granted' : 'denied'
      } else if (navigator.geolocation) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => { updated.location = 'granted'; resolve() },
            () => { updated.location = 'denied'; resolve() },
            { timeout: 6000 }
          )
        })
      }
    } catch (err) {
      console.warn('[Perms] Geolocation request error:', err)
      updated.location = 'denied'
    }
    setPerms({ ...updated })

    // 3. Camera Permission
    try {
      if (Capacitor.isNativePlatform()) {
        const res = await CapCamera.requestPermissions({ permissions: ['camera'] })
        updated.camera = res.camera === 'granted' ? 'granted' : 'denied'
      } else if (navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true })
          stream.getTracks().forEach((track) => track.stop())
          updated.camera = 'granted'
        } catch {
          updated.camera = 'denied'
        }
      }
    } catch (err) {
      console.warn('[Perms] Camera request error:', err)
      updated.camera = 'denied'
    }
    setPerms({ ...updated })
    setRequesting(false)

    // Check if all are granted
    const allGranted = updated.location === 'granted' && updated.camera === 'granted' && updated.notifications === 'granted'

    if (allGranted) {
      setAllDone(true)
      toast.success('All required permissions granted successfully! 🎉')
      sessionStorage.setItem('smdl_perm_dismissed', 'true')
      setTimeout(() => {
        setIsOpen(false)
      }, 1200)
    } else {
      toast('Some permissions were not granted. You can still use the app or enable them later.', {
        icon: '⚠️',
      })
    }
  }

  const handleDismiss = () => {
    sessionStorage.setItem('smdl_perm_dismissed', 'true')
    setIsOpen(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-surface border border-line rounded-2xl shadow-xl overflow-hidden p-6 space-y-5 animate-scale-up">
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted hover:text-ink hover:bg-bg transition-colors"
          title="Dismiss for now"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand/10 border border-brand/20 text-brand flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold font-display text-ink tracking-tight">
              App Permissions Setup
            </h3>
            <p className="text-xs text-muted">
              Grant permissions once for seamless smart attendance
            </p>
          </div>
        </div>

        {/* Permission Cards List */}
        <div className="space-y-3 pt-1">
          {/* 1. Location */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-bg border border-line">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
              perms.location === 'granted'
                ? 'bg-present/10 text-present border border-present/20'
                : 'bg-brand/10 text-brand border border-brand/20'
            }`}>
              <MapPin className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-semibold text-ink">Campus Location (GPS)</span>
                {perms.location === 'granted' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-present bg-present/10 px-2 py-0.5 rounded-md">
                    <CheckCircle2 className="w-3 h-3" /> Granted
                  </span>
                ) : perms.location === 'denied' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-absent bg-absent/10 px-2 py-0.5 rounded-md">
                    <AlertCircle className="w-3 h-3" /> Denied
                  </span>
                ) : (
                  <span className="text-[11px] text-muted">Required</span>
                )}
              </div>
              <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                Verifies your physical presence within the 100m college geofence boundary.
              </p>
            </div>
          </div>

          {/* 2. Camera */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-bg border border-line">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
              perms.camera === 'granted'
                ? 'bg-present/10 text-present border border-present/20'
                : 'bg-brand/10 text-brand border border-brand/20'
            }`}>
              <Camera className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-semibold text-ink">Front Camera</span>
                {perms.camera === 'granted' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-present bg-present/10 px-2 py-0.5 rounded-md">
                    <CheckCircle2 className="w-3 h-3" /> Granted
                  </span>
                ) : perms.camera === 'denied' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-absent bg-absent/10 px-2 py-0.5 rounded-md">
                    <AlertCircle className="w-3 h-3" /> Denied
                  </span>
                ) : (
                  <span className="text-[11px] text-muted">Required</span>
                )}
              </div>
              <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                Captures a live selfie proof during attendance check-in for teacher roster review.
              </p>
            </div>
          </div>

          {/* 3. Notifications */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-bg border border-line">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
              perms.notifications === 'granted'
                ? 'bg-present/10 text-present border border-present/20'
                : 'bg-brand/10 text-brand border border-brand/20'
            }`}>
              <Bell className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-semibold text-ink">Push Notifications</span>
                {perms.notifications === 'granted' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-present bg-present/10 px-2 py-0.5 rounded-md">
                    <CheckCircle2 className="w-3 h-3" /> Granted
                  </span>
                ) : perms.notifications === 'denied' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-absent bg-absent/10 px-2 py-0.5 rounded-md">
                    <AlertCircle className="w-3 h-3" /> Denied
                  </span>
                ) : (
                  <span className="text-[11px] text-muted">Recommended</span>
                )}
              </div>
              <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                Sends 10-minute upcoming lecture countdown reminders and official circular notices.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 space-y-2">
          <button
            onClick={handleGrantAll}
            disabled={requesting || allDone}
            className={`w-full py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm select-none ${
              allDone
                ? 'bg-present text-white'
                : 'bg-brand text-white hover:bg-brand-dark active:scale-[0.99]'
            } disabled:opacity-80`}
          >
            {requesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Requesting Permissions...</span>
              </>
            ) : allDone ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>All Permissions Enabled!</span>
              </>
            ) : (
              <>
                <span>Grant All Permissions</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="text-center">
            <button
              onClick={handleDismiss}
              className="text-[11px] font-medium text-muted hover:text-ink transition-colors py-1 cursor-pointer"
            >
              Skip for now (I will allow later)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
