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
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { requestWebPushPermission, onMessageListener } from '../../lib/firebase';
import { getNotificationUrl } from '../../lib/notificationRouter';
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
  const diffDays = Math.floor(diffDays / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return past.toLocaleDateString();
}

// Category visual styling configuration with vibrant, high-contrast colors
const CATEGORY_STYLES = {
  LECTURE_STARTING: {
    icon: Clock,
    color: 'text-sky-600 bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/50',
    badge: 'Class Reminder',
    badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  },
  LECTURE_CANCELLED: {
    icon: AlertTriangle,
    color: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50',
    badge: 'Cancelled',
    badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  },
  LECTURE_RESCHEDULED: {
    icon: Calendar,
    color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50',
    badge: 'Rescheduled',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  LOW_ATTENDANCE: {
    icon: AlertTriangle,
    color: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/50',
    badge: 'Low Attendance',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
  ANNOUNCEMENT: {
    icon: Bell,
    color: 'text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/50',
    badge: 'Notice',
    badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  },
  ATTENDANCE_MARKED: {
    icon: CheckCircle,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50',
    badge: 'Present Marked',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  ATTENDANCE_CORRECTED: {
    icon: CheckCircle,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/50',
    badge: 'Attendance Updated',
    badgeClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  },
  ATTENDANCE_REMOVED: {
    icon: AlertTriangle,
    color: 'text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800/50',
    badge: 'Record Removed',
    badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  },
  PASSWORD_CHANGED: {
    icon: ShieldAlert,
    color: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50',
    badge: 'Security Alert',
    badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  },
  PASSWORD_RESET: {
    icon: ShieldAlert,
    color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50',
    badge: 'Password Reset',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  SECURITY_ALERT: {
    icon: ShieldAlert,
    color: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50',
    badge: 'Security Alert',
    badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  },
  NEW_STUDY_MATERIAL: {
    icon: BookOpen,
    color: 'text-teal-600 bg-teal-50 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800/50',
    badge: 'Study Material',
    badgeClass: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  },
  STUDY_MATERIAL: {
    icon: BookOpen,
    color: 'text-teal-600 bg-teal-50 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800/50',
    badge: 'Study Material',
    badgeClass: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  },
  TEACHER_APPROVED: {
    icon: CheckCircle,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50',
    badge: 'Account Approved',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  TEACHER_REJECTED: {
    icon: AlertTriangle,
    color: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50',
    badge: 'Account Update',
    badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  },
  DEFAULT: {
    icon: Bell,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/50',
    badge: 'System',
    badgeClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  },
};

export default function NotificationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread'
  const [loading, setLoading] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [pushStatus, setPushStatus] = useState('default'); // 'default' | 'granted' | 'denied'
  const [hidePushBanner, setHidePushBanner] = useState(false);
  const drawerRef = useRef(null);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async (isSilent = false) => {
    if (!user?.id) return;
    if (!isSilent) setLoading(true);

    try {
      const { data } = await api.get('/notifications', {
        params: { limit: 40, filter: activeTab === 'unread' ? 'unread' : 'all' },
      });

      if (data?.data) {
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
                  <div className="w-6 h-6 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Bell size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink leading-snug">{payload.new.title}</p>
                    <p className="text-xs text-muted mt-0.5 leading-relaxed">{payload.new.message}</p>
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
          <Volume2 size={16} className="text-sky-600 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-ink">{title}</p>
            <p className="text-xs text-muted">{body}</p>
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
    } catch (_err) {
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
    } catch (_err) {
      toast.error('Failed to mark all as read');
    }
  }

  // Handle Enable Web Push prompt
  async function handleEnablePush() {
    const res = await requestWebPushPermission();
    if (res.granted) {
      setPushStatus('granted');
      toast.success('Browser notifications enabled!');
    } else if (res.reason) {
      toast.error(res.reason);
    }
  }

  const displayedNotifications = activeTab === 'unread'
    ? notifications.filter((n) => !n.is_read)
    : notifications;

  return (
    <div className="relative">
      {/* 🔔 Notification Bell Button — Always clearly visible & high-contrast */}
      <button
        id="notifications-bell-btn"
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Notifications"
        aria-label="Open notifications"
        className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border transition-all duration-150 cursor-pointer ${
          isOpen
            ? 'bg-brand/10 border-brand/40 text-brand shadow-xs ring-2 ring-brand/20'
            : 'bg-surface border-line text-ink/75 hover:text-ink hover:bg-bg hover:border-line/80 shadow-xs'
        }`}
      >
        <Bell className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${unreadCount > 0 ? 'text-brand' : 'currentColor'}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] sm:h-5 sm:min-w-[20px] items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-1 text-[10px] font-extrabold text-white shadow-sm ring-2 ring-surface animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 📬 Slide-Out Notification Drawer / Dropdown */}
      {isOpen && (
        <>
          {/* Mobile backdrop so user can easily tap outside and won't get cramped */}
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-xs z-40 sm:hidden animate-fade-in"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div
            ref={drawerRef}
            className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-16 sm:top-full sm:mt-2 sm:w-96 max-w-[calc(100vw-1.5rem)] bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden z-50 animate-slide-up sm:animate-fade-in flex flex-col max-h-[82vh] sm:max-h-[85vh]"
          >
            {/* Top Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface/95 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0">
                  <Bell className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-bold font-display text-ink tracking-tight truncate">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-600 dark:bg-rose-950/40 dark:border-rose-800/40 dark:text-rose-400 font-mono shrink-0">
                    {unreadCount} new
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    id="mark-all-read-btn"
                    onClick={handleMarkAllAsRead}
                    title="Mark all as read"
                    className="p-1.5 rounded-lg text-muted hover:text-brand hover:bg-brand/10 transition-colors cursor-pointer"
                  >
                    <CheckCheck size={16} />
                  </button>
                )}
                <button
                  type="button"
                  id="open-preferences-btn"
                  onClick={() => setPrefsOpen(true)}
                  title="Notification preferences"
                  className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-bg transition-colors cursor-pointer"
                >
                  <Settings size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-bg transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Optional Web Push Prompt banner */}
            {pushStatus === 'default' && !hidePushBanner && (
              <div className="bg-sky-50 dark:bg-sky-950/40 border-b border-sky-200 dark:border-sky-800/40 px-3 py-2 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0 text-xs text-sky-800 dark:text-sky-200">
                  <Bell size={13} className="shrink-0 text-sky-600 dark:text-sky-400" />
                  <span className="truncate text-[11px]">Enable browser notifications for alerts?</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={handleEnablePush}
                    className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-xs cursor-pointer"
                  >
                    Enable
                  </button>
                  <button
                    type="button"
                    onClick={() => setHidePushBanner(true)}
                    className="p-1 text-sky-600 hover:text-sky-800 cursor-pointer"
                    aria-label="Dismiss banner"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* Sub-Tabs: All / Unread with modern vibrant styling */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-line bg-bg/50 shrink-0">
              <button
                type="button"
                id="notif-tab-all"
                onClick={() => setActiveTab('all')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-muted hover:text-ink hover:bg-surface'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                id="notif-tab-unread"
                onClick={() => setActiveTab('unread')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  activeTab === 'unread'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-muted hover:text-ink hover:bg-surface'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            {/* Notification List Body with clean word wrap and proper padding */}
            <div className="flex-1 overflow-y-auto divide-y divide-line/60 overscroll-contain">
              {loading ? (
                <div className="py-14 flex flex-col items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                  <span className="text-xs text-muted font-medium">Checking updates...</span>
                </div>
              ) : displayedNotifications.length === 0 ? (
                <div className="py-14 px-4 text-center">
                  <div className="w-11 h-11 rounded-2xl bg-bg border border-line flex items-center justify-center mx-auto mb-2.5 text-muted">
                    <Bell size={20} className="opacity-40" />
                  </div>
                  <p className="text-sm font-bold text-ink">No notifications</p>
                  <p className="text-xs text-muted mt-1 max-w-[240px] mx-auto leading-relaxed">
                    {activeTab === 'unread'
                      ? "You're all caught up! No unread notices."
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
                        setIsOpen(false);
                        const targetUrl = getNotificationUrl(notif, user?.role);
                        if (targetUrl) navigate(targetUrl);
                      }}
                      className={`p-3 sm:p-3.5 flex items-start gap-3 transition-colors cursor-pointer group ${
                        !notif.is_read
                          ? 'bg-brand/[0.04] hover:bg-brand/[0.08]'
                          : 'hover:bg-bg/60'
                      }`}
                    >
                      {/* Vibrant Category Icon */}
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 mt-0.5 shadow-xs ${style.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>

                      {/* Content with no word overlap and clear spacing */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded font-mono ${style.badgeClass || 'bg-bg text-muted'}`}>
                            {style.badge}
                          </span>
                          <span className="text-[11px] text-muted font-mono shrink-0">
                            {formatRelativeTime(notif.created_at)}
                          </span>
                        </div>

                        <h4 className={`text-xs font-semibold leading-snug break-words ${
                          !notif.is_read ? 'text-ink font-bold' : 'text-ink/80'
                        }`}>
                          {notif.title}
                        </h4>

                        <p className="text-xs text-muted mt-0.5 leading-relaxed break-words line-clamp-2">
                          {notif.message}
                        </p>
                      </div>

                      {/* Glowing Unread indicator dot */}
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-brand shrink-0 mt-2 shadow-[0_0_6px_rgba(79,70,229,0.7)]" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer */}
            <div className="px-3 py-2.5 border-t border-line bg-surface text-center text-[11px] text-muted flex items-center justify-between shrink-0">
              <span className="font-medium">SMDL Smart Attendance</span>
              <button
                type="button"
                onClick={() => fetchNotifications(false)}
                className="text-brand hover:underline font-semibold cursor-pointer"
              >
                Refresh
              </button>
            </div>
          </div>
        </>
      )}

      {/* Preferences Modal */}
      <NotificationPreferencesModal
        isOpen={prefsOpen}
        onClose={() => setPrefsOpen(false)}
      />
    </div>
  );
}
