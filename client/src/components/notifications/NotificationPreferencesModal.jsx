import { useState, useEffect } from 'react';
import { X, ShieldAlert, Bell, Clock, AlertTriangle, CheckCircle, BookOpen, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { Button } from '../ui';

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
      color: 'text-sky-600 bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/40',
    },
    {
      key: 'announcements',
      label: 'Department & College Announcements',
      desc: 'Important notices broadcast by teachers and college administration.',
      icon: Bell,
      color: 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/40',
    },
    {
      key: 'low_attendance',
      label: 'Low Attendance Warnings',
      desc: 'Timely weekly warning if subject attendance falls below 75%.',
      icon: AlertTriangle,
      color: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/40',
    },
    {
      key: 'attendance_updates',
      label: 'Attendance Marking & Corrections',
      desc: 'Confirmation when presence is recorded or modified by faculty.',
      icon: CheckCircle,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/40',
    },
    {
      key: 'study_material',
      label: 'New Study Material & Notes',
      desc: 'Updates when syllabus notes or attachments are shared.',
      icon: BookOpen,
      color: 'text-teal-600 bg-teal-50 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800/40',
    },
    {
      key: 'security_alerts',
      label: 'Security & Password Alerts',
      desc: 'Immediate notifications for password changes and account recovery.',
      icon: ShieldAlert,
      color: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/40',
      locked: true,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-lg bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-line bg-surface shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand/10 border border-brand/20 text-brand flex items-center justify-center shadow-xs">
              <Bell size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold font-display text-ink leading-snug">Notification Preferences</h3>
              <p className="text-xs text-muted">Choose which push and in-app alerts you receive</p>
            </div>
          </div>
          <button
            type="button"
            id="close-preferences-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-bg transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
              <p className="text-xs text-muted font-medium">Loading preferences...</p>
            </div>
          ) : (
            categories.map(({ key, label, desc, icon: Icon, color, locked }) => (
              <div
                key={key}
                className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-bg border border-line hover:border-brand/30 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 mt-0.5 shadow-xs ${color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-semibold text-ink">{label}</span>
                      {locked && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          <Lock size={10} /> Mandatory
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-0.5 leading-relaxed break-words">{desc}</p>
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
                  <div className={`w-10 h-5 bg-line rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all ${
                    locked
                      ? 'peer-checked:bg-brand/60 opacity-60 cursor-not-allowed'
                      : 'peer-checked:bg-brand'
                  }`} />
                </label>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 p-4 border-t border-line bg-surface shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            id="save-preferences-btn"
            disabled={loading || saving}
            onClick={handleSave}
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>
      </div>
    </div>
  );
}
