import { Bell, Volume2, VolumeX } from 'lucide-react';
import {
  getLocalizedTimeOfDay,
  selectLocale,
  selectTranslations,
} from '../../engine/i18n';
import { formatClock24 } from '../../engine/tagParser';
import { useOsStore } from '../../store/useOsStore';
import { AppIcon } from './AppIcon';

export function SystemTray() {
  const clockMinutes = useOsStore((s) => s.clockMinutes);
  const dayLabel = useOsStore((s) => s.dayLabel);
  const muted = useOsStore((s) => s.muted);
  const toggleMuted = useOsStore((s) => s.toggleMuted);
  const notifications = useOsStore((s) => s.notifications);
  const notificationsOpen = useOsStore((s) => s.notificationsOpen);
  const toggleNotifications = useOsStore((s) => s.toggleNotifications);
  const markAllNotificationsRead = useOsStore((s) => s.markAllNotificationsRead);
  const clickNotification = useOsStore((s) => s.clickNotification);
  const locale = useOsStore(selectLocale);
  const t = useOsStore(selectTranslations);

  const unreadNotifs = notifications.filter((n) => !n.read).length;
  const timeOfDay = getLocalizedTimeOfDay(clockMinutes, locale);
  const clockText = formatClock24(clockMinutes);

  return (
    <div className="relative flex h-full items-center">
      <button
        type="button"
        onClick={toggleMuted}
        title={muted ? t.systemTray.unmuteAudio : t.systemTray.muteAudio}
        className="flex h-10 w-8 items-center justify-center text-slate-200 transition-colors hover:bg-[#22262e]"
      >
        {muted ? (
          <VolumeX className="h-3.5 w-3.5 text-slate-400" />
        ) : (
          <Volume2 className="h-3.5 w-3.5" />
        )}
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleNotifications();
        }}
        title={t.systemTray.notifications}
        className="relative flex h-10 w-8 items-center justify-center text-slate-200 transition-colors hover:bg-[#22262e]"
      >
        <Bell className="h-3.5 w-3.5" />
        {unreadNotifs > 0 && (
          <span className="absolute top-2 right-1.5 h-2 w-2 rounded-full bg-[#4ca3dd]" />
        )}
      </button>

      {/* Utilitarian Shift / Time-of-Day + Clock */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleNotifications();
        }}
        title={dayLabel ? `${timeOfDay} · ${dayLabel}` : timeOfDay}
        className="flex h-10 items-center gap-2.5 px-3 text-xs text-white transition-colors hover:bg-[#22262e]"
      >
        <span className="hidden sm:inline text-[11px] font-normal text-slate-300">
          {timeOfDay}
        </span>
        <span className="font-normal tabular-nums">{clockText}</span>
      </button>

      {/* Notification Popover */}
      {notificationsOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed bottom-10 right-0 z-[1100] w-80 overflow-hidden rounded-tl-[2px] border-t border-l border-[#323742] bg-[#1b1e24] text-slate-100 shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-[#2c313b] bg-[#14171c] px-3.5 py-2.5">
            <div className="text-xs font-semibold text-slate-200">
              {t.systemTray.notifications}
              {dayLabel && (
                <span className="ml-2 font-normal text-slate-400">
                  {dayLabel}
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsRead}
                className="text-[11px] text-[#4ca3dd] hover:underline"
              >
                {t.systemTray.clearUnread}
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-[#282c36]">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                {t.systemTray.noNotifications}
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => clickNotification(n)}
                  className={`flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-[#252932] ${
                    n.read ? 'opacity-60' : 'bg-[#212834]'
                  }`}
                >
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] bg-[#2a2f3a]">
                    <AppIcon appId={n.appId} className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-white">
                        {n.title}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-slate-400">
                        {n.timestamp}
                      </span>
                    </div>
                    <span className="line-clamp-2 text-[11px] text-slate-300">
                      {n.body}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
