import { Bell, Volume2, VolumeX, Sun, Sunset, Moon, Clock } from 'lucide-react';
import { formatClock, getTimeOfDay } from '../../engine/tagParser';
import { useOsStore } from '../../store/useOsStore';

export function SystemTray() {
  const clockMinutes = useOsStore((s) => s.clockMinutes);
  const manifest = useOsStore((s) => s.manifest);
  const muted = useOsStore((s) => s.muted);
  const toggleMuted = useOsStore((s) => s.toggleMuted);
  const notifications = useOsStore((s) => s.notifications);
  const notificationsOpen = useOsStore((s) => s.notificationsOpen);
  const toggleNotifications = useOsStore((s) => s.toggleNotifications);
  const markAllNotificationsRead = useOsStore((s) => s.markAllNotificationsRead);
  const clickNotification = useOsStore((s) => s.clickNotification);

  const unreadNotifs = notifications.filter((n) => !n.read).length;
  const timeOfDay = getTimeOfDay(clockMinutes);
  const clockText = formatClock(clockMinutes);

  const TimeIcon =
    timeOfDay === 'Morning' || timeOfDay === 'Midday'
      ? Sun
      : timeOfDay === 'Afternoon' || timeOfDay === 'Evening'
        ? Sunset
        : Moon;

  return (
    <div className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={toggleMuted}
        title={muted ? 'Unmute audio' : 'Mute audio'}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-800 hover:text-slate-100 cursor-pointer"
      >
        {muted ? <VolumeX className="h-4 w-4 text-slate-500" /> : <Volume2 className="h-4 w-4" />}
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleNotifications();
        }}
        title="Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-800 hover:text-slate-100 cursor-pointer"
      >
        <Bell className="h-4 w-4" />
        {unreadNotifs > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[9px] font-bold text-slate-950">
            {unreadNotifs > 9 ? '9+' : unreadNotifs}
          </span>
        )}
      </button>

      <div className="ml-1 flex items-center gap-2 rounded-lg border border-slate-700/70 bg-slate-800/60 px-2.5 py-1 text-right">
        <TimeIcon className="h-3.5 w-3.5 text-amber-300/90" />
        <div className="leading-tight">
          <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-100">
            <span>{clockText}</span>
          </div>
          <div className="text-[10px] text-slate-400">
            {timeOfDay}
            {manifest?.dayLabel ? ` · ${manifest.dayLabel}` : ''}
          </div>
        </div>
      </div>

      {/* Notification Popover */}
      {notificationsOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed bottom-14 right-3 z-50 w-80 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/95 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-800 px-3.5 py-2.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <Clock className="h-3.5 w-3.5 text-sky-400" />
              Activity Feed
            </span>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsRead}
                className="text-[11px] text-sky-400 hover:text-sky-300 cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/70">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => clickNotification(n)}
                  className={`flex w-full flex-col gap-0.5 px-3.5 py-2.5 text-left transition hover:bg-slate-800/80 cursor-pointer ${
                    n.read ? 'opacity-65' : 'bg-sky-500/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-slate-100">
                      {n.title}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-400">
                      {n.timestamp}
                    </span>
                  </div>
                  <span className="line-clamp-2 text-[11px] text-slate-300">
                    {n.body}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
