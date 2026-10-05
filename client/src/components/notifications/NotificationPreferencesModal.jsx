import { useState, useEffect } from 'react';
import { X, ShieldAlert, Bell, Clock, AlertTriangle, CheckCircle, BookOpen, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

export default function NotificationPreferencesModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    announcements: true,
    low_attendance: true,
    lecture_reminders: true,
    attendance_updates: true,
    study_material: true,
    security_alerts: true, // locked
  });

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    async function loadPrefs() {
      setLoading(true);
      try {
        const { data } = await api.get('/notifications/preferences');
        if (mounted && data.data?.preferences) {
          setPreferences({ ...data.data.preferences, security_alerts: true });
        }
      } catch (err) {
        console.warn('Failed to load preferences:', err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPrefs();
    return () => { mounted = false; };
  }, [isOpen]);

  async function handleSave() {
    setSaving(true);
    try {
      await api.put('/notifications/preferences', preferences);
      toast.success('Notification preferences updated successfully');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update preferences');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const categories = [
    {
      key: 'lecture_reminders',
      label: 'Lecture Start Reminders',
      desc: 'Automatic alert 10 minutes before your scheduled class starts.',
      icon: Clock,
      color: 'text-sky-400 bg-sky-950/40 border-sky-800/50',
    },
    {
      key: 'announcements',
      label: 'Department & College Announcements',
      desc: 'Important notices broadcast by teachers and college administration.',
      icon: Bell,
      color: 'text-amber-400 bg-amber-950/40 border-amber-800/50',
    },
    {
      key: 'low_attendance',
      label: 'Low Attendance Warnings',
      desc: 'Timely weekly warning if subject attendance falls below 75%.',
      icon: AlertTriangle,
      color: 'text-rose-400 bg-rose-950/40 border-rose-800/50',
    },
    {
      key: 'attendance_updates',
      label: 'Attendance Marking & Corrections',
      desc: 'Confirmation when presence is recorded or modified by teacher.',
      icon: CheckCircle,
      color: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50',
    },
    {
      key: 'study_material',
      label: 'New Study Material & Notes',
      desc: 'Updates when syllabus notes or attachments are shared.',
      icon: BookOpen,
      color: 'text-purple-400 bg-purple-950/40 border-purple-800/50',
    },
    {
      key: 'security_alerts',
      label: 'Security & Password Alerts',
      desc: 'Immediate notifications for password changes and account recovery.',
      icon: ShieldAlert,
      color: 'text-red-400 bg-red-950/40 border-red-800/50',
      locked: true,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-brand-card border border-brand-border rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-brand-border bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center text-white shadow-md">
              <Bell size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-snug">Notification Preferences</h3>
              <p className="text-xs text-brand-muted">Choose which push and in-app alerts you receive</p>
            </div>
          </div>
          <button
            type="button"
            id="close-preferences-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-brand-muted hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3.5 max-h-[65vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="spinner w-6 h-6 border-2" />
              <p className="text-xs text-brand-muted font-medium">Loading preferences...</p>
            </div>
          ) : (
            categories.map(({ key, label, desc, icon: Icon, color, locked }) => (
              <div
                key={key}
                className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-slate-900/50 border border-brand-border/60 hover:border-brand-border transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 mt-0.5 ${color}`}>
                    <Icon size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{label}</span>
                      {locked && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-950/60 border border-amber-800/40 px-1.5 py-0.5 rounded">
                          <Lock size={10} /> Mandatory
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-brand-muted mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={preferences[key] !== false}
                    disabled={locked}
                    onChange={(e) => {
                      if (!locked) {
                        setPreferences((prev) => ({ ...prev, [key]: e.target.checked }));
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className={`w-10 h-5 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${
                    locked
                      ? 'peer-checked:bg-primary-600 opacity-60 cursor-not-allowed'
                      : 'peer-checked:bg-brand-accent'
                  }`} />
                </label>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-brand-border bg-slate-900/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-brand-muted hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            id="save-preferences-btn"
            disabled={loading || saving}
            onClick={handleSave}
            className="btn-primary py-2 px-5 text-xs font-bold"
          >
            {saving ? (
              <>
                <div className="spinner w-3.5 h-3.5 border-2" />
                <span>Saving...</span>
              </>
            ) : (
              'Save Preferences'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
