/**
 * AlertBell — real-time in-app alert notification panel.
 *
 * Shows a bell icon with an unread count badge in the nav bar.
 * Clicking opens a dropdown listing the 20 most recent alerts.
 * Clicking an individual alert marks it as read via PATCH /alerts/{id}/read.
 * Polls every 60 seconds for new alerts.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCheck, AlertTriangle, Loader2, X } from 'lucide-react';
import { fetchAlerts, markAlertRead, Alert } from '@/api/alerts';

interface AlertBellProps {
  /** The current user's role — used to show/hide per role */
  role: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AlertBell({ role }: AlertBellProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  const load = useCallback(async () => {
    // Only roles that receive escalation alerts need this
    if (!['mine_official', 'corporate_management', 'super_admin', 'regulator'].includes(role)) {
      setAlerts([]);
      return;
    }
    try {
      setLoading(true);
      const data = await fetchAlerts(false);
      setAlerts(data);
    } catch {
      // Silently fail — alert panel is informational, not blocking
    } finally {
      setLoading(false);
    }
  }, [role]);

  // Initial load + 60s polling
  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleMarkRead = async (alert: Alert) => {
    if (alert.is_read) return;
    try {
      const updated = await markAlertRead(alert.id);
      setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch {
      // Ignore — optimistically set read anyway
      setAlerts((prev) =>
        prev.map((a) => (a.id === alert.id ? { ...a, is_read: true } : a))
      );
    }
  };

  const handleMarkAllRead = async () => {
    const unread = alerts.filter((a) => !a.is_read);
    for (const a of unread) {
      await handleMarkRead(a);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        id="alert-bell-btn"
        onClick={() => setOpen((o) => !o)}
        className="relative p-1.5 rounded-full text-zinc-500 hover:text-black hover:bg-zinc-100 transition-colors"
        title="Notifications"
        aria-label={`Notifications — ${unreadCount} unread`}
      >
        <Bell className="w-3.5 h-3.5" />
        {unreadCount > 0 && (
          <motion.span
            key={unreadCount}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center leading-none"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="alert-panel"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 rounded-2xl bg-white border border-zinc-200 shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 bg-zinc-50/60">
              <div className="flex items-center gap-2">
                <Bell className="size-3.5 text-zinc-500" />
                <span className="text-xs font-semibold text-black">
                  Alerts
                </span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                    {unreadCount} new
                  </span>
                )}
                {loading && <Loader2 className="size-3 text-zinc-400 animate-spin" />}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] text-zinc-500 hover:text-black flex items-center gap-1 transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck className="size-3" />
                    All read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="ml-1 p-0.5 rounded hover:bg-zinc-200 text-zinc-400 hover:text-black transition-colors"
                >
                  <X className="size-3" />
                </button>
              </div>
            </div>

            {/* Alert List */}
            <div className="max-h-80 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-zinc-400">
                  <CheckCheck className="size-6" />
                  <span className="text-xs font-medium">No alerts</span>
                  <span className="text-[10px] text-zinc-400 text-center px-6">
                    Escalation alerts will appear here when SLA thresholds are exceeded.
                  </span>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {alerts.map((alert) => (
                    <li
                      key={alert.id}
                      onClick={() => handleMarkRead(alert)}
                      className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors ${
                        alert.is_read
                          ? 'bg-white hover:bg-zinc-50'
                          : 'bg-red-50/40 hover:bg-red-50/70'
                      }`}
                    >
                      {/* Icon */}
                      <div className="shrink-0 mt-0.5">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            alert.is_read ? 'bg-zinc-100' : 'bg-red-100'
                          }`}
                        >
                          <AlertTriangle
                            className={`size-3 ${alert.is_read ? 'text-zinc-400' : 'text-red-600'}`}
                          />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs leading-snug ${
                            alert.is_read ? 'text-zinc-500' : 'text-zinc-800 font-medium'
                          }`}
                        >
                          {/* Strip the [AUTO-ESCALATED] prefix for display cleanliness */}
                          {alert.message.replace(/^\[AUTO-ESCALATED\]\s*/, '')}
                        </p>
                        <span className="text-[10px] text-zinc-400 mt-0.5 block">
                          {timeAgo(alert.created_at)}
                        </span>
                      </div>

                      {/* Unread dot */}
                      {!alert.is_read && (
                        <div className="shrink-0 mt-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            {alerts.length > 0 && (
              <div className="px-4 py-2 border-t border-zinc-100 bg-zinc-50/60 text-center">
                <span className="text-[10px] text-zinc-400">
                  Showing {alerts.length} alert{alerts.length !== 1 ? 's' : ''} — auto-escalation runs every 5 min
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
