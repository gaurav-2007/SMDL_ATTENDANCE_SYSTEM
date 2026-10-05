import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  CheckCheck,
  Settings,
  Clock,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  BookOpen,
  Calendar,
  X,
  Volume2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { requestWebPushPermission, onMessageListener } from '../../lib/firebase';
import NotificationPreferencesModal from './NotificationPreferencesModal';

// Formats relative time
function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const past = new Date(dateStr);
  const diffSecs = Math.floor((now - past) / 1000);

  if (diffSecs < 60) return 'Just now';
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return past.toLocaleDateString();
}

// Category visual styling configuration
const CATEGORY_STYLES = {
  LECTURE_STARTING: {
    icon: Clock,
    color: 'text-sky-400 bg-sky-950/40 border-sky-800/40',
    badge: 'Class Reminder',
    badgeClass: 'badge-info',
  },
  LECTURE_CANCELLED: {
    icon: AlertTriangle,
    color: 'text-rose-400 bg-rose-950/40 border-rose-800/40',
    badge: 'Cancelled',
    badgeClass: 'badge-danger',
  },
  LECTURE_RESCHEDULED: {
    icon: Calendar,
    color: 'text-amber-400 bg-amber-950/40 border-amber-800/40',
    badge: 'Rescheduled',
    badgeClass: 'badge-warning',
  },
  LOW_ATTENDANCE: {
    icon: AlertTriangle,
    color: 'text-rose-400 bg-rose-950/40 border-rose-800/40',
    badge: 'Low Attendance',
    badgeClass: 'badge-danger',
  },
  ANNOUNCEMENT: {
    icon: Bell,
    color: 'text-amber-400 bg-amber-950/40 border-amber-800/40',
    badge: 'Notice',
    badgeClass: 'badge-warning',
  },
  ATTENDANCE_MARKED: {
    icon: CheckCircle,
    color: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40',
    badge: 'Attendance',
    badgeClass: 'badge-active',
  },
  ATTENDANCE_CORRECTED: {
    icon: CheckCircle,
    color: 'text-sky-400 bg-sky-950/40 border-sky-800/40',
    badge: 'Corrected',
    badgeClass: 'badge-info',
  },
  ATTENDANCE_REMOVED: {
    icon: AlertTriangle,
    color: 'text-rose-400 bg-rose-950/40 border-rose-800/40',
    badge: 'Removed',
    badgeClass: 'badge-danger',
  },
  PASSWORD_CHANGED: {
    icon: ShieldAlert,
    color: 'text-red-400 bg-red-950/40 border-red-800/40',
    badge: 'Security Alert',
    badgeClass: 'badge-danger',
  },
  TEACHER_APPROVED: {
    icon: CheckCircle,
    color: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40',
    badge: 'Account Approved',
    badgeClass: 'badge-active',
  },
  TEACHER_REJECTED: {
    icon: AlertTriangle,
    color: 'text-rose-400 bg-rose-950/40 border-rose-800/40',
    badge: 'Account Update',
    badgeClass: 'badge-danger',
  },
  DEFAULT: {
    icon: Bell,
    color: 'text-slate-400 bg-slate-900 border-slate-700',
    badge: 'System',
    badgeClass: 'badge-neutral',
  },
};

export default function NotificationCenter() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread'
  const [loading, setLoading] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [pushStatus, setPushStatus] = useState('default'); // 'default' | 'granted' | 'denied'
  const drawerRef = useRef(null);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async (isSilent = false) => {
    if (!user?.id) return;
    if (!isSilent) setLoading(true);

    try {
      const { data } = await api.get('/notifications', {
        params: { limit: 40, filter: activeTab === 'unread' ? 'unread' : 'all' },
      });

      if (data.data) {
        setNotifications(data.data.notifications || []);
        setUnreadCount(data.data.unread_count || 0);
      }
    } catch (err) {
      console.warn('[NotificationCenter] Fetch notice:', err.message);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [user?.id, activeTab]);

  // Initial fetch and Realtime + Polling subscription
  useEffect(() => {
    if (!user?.id) return;

    fetchNotifications();

    // 1. Supabase Realtime Subscription
    let channel = null;
    try {
      channel = supabase
        .channel(`user-notifications-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.new) {
              setNotifications((prev) => [payload.new, ...prev]);
              setUnreadCount((c) => c + 1);
              toast((t) => (
                <div className="flex items-start gap-2.5">
                  <Bell size={18} className="text-brand-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-white">{payload.new.title}</p>
                    <p className="text-xs text-brand-muted mt-0.5">{payload.new.message}</p>
                  </div>
                </div>
              ), { id: payload.new.id });
            }
          }
        )
        .subscribe();
    } catch (_e) {}

    // 2. Fallback polling interval every 30s
    const pollTimer = setInterval(() => {
      fetchNotifications(true);
    }, 30000);

    // 3. Foreground FCM message listener
    const unsubscribeFcm = onMessageListener((fcmPayload) => {
      const title = fcmPayload.notification?.title || 'Notification';
      const body = fcmPayload.notification?.body || '';
      toast(
        <div className="flex items-start gap-2">
          <Volume2 size={16} className="text-sky-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold text-white">{title}</p>
            <p className="text-xs text-brand-muted">{body}</p>
          </div>
        </div>
      );
      fetchNotifications(true);
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
      clearInterval(pollTimer);
      if (typeof unsubscribeFcm === 'function') unsubscribeFcm();
    };
  }, [user?.id, fetchNotifications]);

  // Check notification permission state
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushStatus(Notification.permission);
    }
  }, []);

  // Close drawer on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (drawerRef.current && !drawerRef.current.contains(e.target) && !e.target.closest('#notifications-bell-btn')) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Handle Mark Single As Read
  async function handleMarkAsRead(notifId) {
    try {
      await api.patch(`/notifications/${notifId}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      toast.error('Failed to update notification');
    }
  }

  // Handle Mark All As Read
  async function handleMarkAllAsRead() {
    if (unreadCount === 0) return;
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error('Failed to mark all as read');
    }
  }

  // Handle Enable Web Push prompt
  async function handleEnablePush() {
    const res = await requestWebPushPermission();
    if (res.granted) {
      setPushStatus('granted');
      toast.success('Browser push notifications enabled!');
    } else if (res.reason) {
      toast.error(res.reason);
    }
  }

  const displayedNotifications = activeTab === 'unread'
    ? notifications.filter((n) => !n.is_read)
    : notifications;

  return (
    <div className="relative">
      {/* 🔔 Notification Bell Button */}
      <button
        id="notifications-bell-btn"
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Notifications"
        className={`btn-icon btn-ghost relative transition-colors ${
          isOpen ? 'bg-white/10 text-white' : 'text-brand-muted hover:text-white'
        }`}
      >
        <Bell size={19} className={unreadCount > 0 ? 'text-white' : ''} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-danger px-1 text-[11px] font-extrabold text-white shadow-lg animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 📬 Slide-Out Notification Drawer / Dropdown */}
      {isOpen && (
        <div
          ref={drawerRef}
          className="absolute right-0 top-full mt-3 w-80 sm:w-96 bg-brand-card border border-brand-border rounded-2xl shadow-2xl overflow-hidden z-50 animate-slide-up flex flex-col max-h-[85vh]"
        >
          {/* Top Header */}
          <div className="flex items-center justify-between p-4 border-b border-brand-border bg-slate-900/80 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-brand-accent/20 text-brand-accent border border-brand-accent/30 font-mono">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  id="mark-all-read-btn"
                  onClick={handleMarkAllAsRead}
                  title="Mark all as read"
                  className="p-1.5 rounded-lg text-brand-muted hover:text-brand-accent hover:bg-brand-accent/10 transition-colors"
                >
                  <CheckCheck size={16} />
                </button>
              )}
              <button
                type="button"
                id="open-preferences-btn"
                onClick={() => setPrefsOpen(true)}
                title="Notification preferences"
                className="p-1.5 rounded-lg text-brand-muted hover:text-white hover:bg-white/5 transition-colors"
              >
                <Settings size={16} />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-brand-muted hover:text-white hover:bg-white/5 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Optional Web Push Enable Prompt banner */}
          {pushStatus === 'default' && (
            <div className="bg-sky-950/50 border-b border-sky-800/40 p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-sky-300">
                <Bell size={14} className="shrink-0 text-sky-400" />
                <span>Enable desktop notifications for live alerts?</span>
              </div>
              <button
                type="button"
                onClick={handleEnablePush}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-500 text-brand-dark hover:bg-sky-400 transition-colors shrink-0 shadow"
              >
                Enable
              </button>
            </div>
          )}

          {/* Filter Sub-Tabs */}
          <div className="flex items-center gap-2 p-2 border-b border-brand-border/60 bg-slate-900/40">
            <button
              type="button"
              id="notif-tab-all"
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'all'
                  ? 'bg-brand-accent text-brand-dark shadow-sm'
                  : 'text-brand-muted hover:text-white'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              id="notif-tab-unread"
              onClick={() => setActiveTab('unread')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'unread'
                  ? 'bg-brand-accent text-brand-dark shadow-sm'
                  : 'text-brand-muted hover:text-white'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notification List Body */}
          <div className="flex-1 overflow-y-auto divide-y divide-brand-border/40">
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2.5">
                <div className="spinner w-5 h-5 border-2" />
                <span className="text-xs text-brand-muted font-medium">Checking updates...</span>
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-brand-border flex items-center justify-center mx-auto mb-3 text-brand-muted">
                  <Bell size={22} className="opacity-40" />
                </div>
                <p className="text-sm font-bold text-white">No new notifications</p>
                <p className="text-xs text-brand-muted mt-1">
                  {activeTab === 'unread'
                    ? "You're all caught up! No unread messages."
                    : 'Class updates, reminders and notices will appear here.'}
                </p>
              </div>
            ) : (
              displayedNotifications.map((notif) => {
                const style = CATEGORY_STYLES[notif.type] || CATEGORY_STYLES.DEFAULT;
                const Icon = style.icon;

                return (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (!notif.is_read) handleMarkAsRead(notif.id);
                    }}
                    className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer group hover:bg-white/[0.04] ${
                      !notif.is_read ? 'bg-primary-950/20' : ''
                    }`}
                  >
                    {/* Category Icon */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 mt-0.5 ${style.color}`}>
                      <Icon size={16} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded font-mono ${
                          !notif.is_read ? 'bg-brand-accent/20 text-sky-300' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {style.badge}
                        </span>
                        <span className="text-[11px] text-brand-muted font-mono shrink-0">
                          {formatRelativeTime(notif.created_at)}
                        </span>
                      </div>

                      <h4 className={`text-xs font-bold leading-snug line-clamp-1 ${
                        !notif.is_read ? 'text-white' : 'text-slate-300'
                      }`}>
                        {notif.title}
                      </h4>

                      <p className="text-xs text-brand-muted mt-0.5 leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>
                    </div>

                    {/* Unread indicator dot */}
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-brand-accent shrink-0 mt-2 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-3 border-t border-brand-border bg-slate-900/60 text-center text-[11px] text-brand-muted flex items-center justify-between">
            <span>SMDL Smart Attendance</span>
            <button
              type="button"
              onClick={() => fetchNotifications(false)}
              className="text-brand-accent hover:underline font-semibold"
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      <NotificationPreferencesModal
        isOpen={prefsOpen}
        onClose={() => setPrefsOpen(false)}
      />
    </div>
  );
}
