import { Bug, Folder, Mail, MessageSquare } from 'lucide-react';
import type { AppId } from '../../types/os';
import { useOsStore } from '../../store/useOsStore';
import { SystemTray } from './SystemTray';

const TASKBAR_APPS: Array<{
  id: AppId;
  label: string;
}> = [
  { id: 'messages', label: 'Messages' },
  { id: 'mail', label: 'Mail' },
  { id: 'explorer', label: 'File Explorer' },
];

export function Taskbar() {
  const windows = useOsStore((s) => s.windows);
  const focusedApp = useOsStore((s) => s.focusedApp);
  const startMenuOpen = useOsStore((s) => s.startMenuOpen);
  const toggleStartMenu = useOsStore((s) => s.toggleStartMenu);
  const openApp = useOsStore((s) => s.openApp);
  const minimizeApp = useOsStore((s) => s.minimizeApp);

  const unreadChatCounts = useOsStore((s) => s.unreadChatCounts);
  const emails = useOsStore((s) => s.emails);
  const files = useOsStore((s) => s.files);

  const totalChatUnread = Object.values(unreadChatCounts).reduce((a, b) => a + b, 0);
  const totalMailUnread = emails.filter((e) => !e.read).length;
  const totalFilesUnread = files.filter((f) => !f.opened).length;

  const badgeByApp: Record<AppId, number> = {
    messages: totalChatUnread,
    mail: totalMailUnread,
    explorer: totalFilesUnread,
    director: 0,
  };

  const renderTaskIcon = (id: AppId) => {
    switch (id) {
      case 'messages':
        return <MessageSquare className="h-4 w-4 fill-[#25b864] text-[#25b864]" />;
      case 'mail':
        return <Mail className="h-4 w-4 text-[#4ca3dd]" />;
      case 'explorer':
        return <Folder className="h-4 w-4 fill-[#eab308] text-[#ca8a04]" />;
      case 'director':
        return <Bug className="h-4 w-4 text-slate-300" />;
    }
  };

  const handleTaskButton = (appId: AppId) => {
    const win = windows[appId];
    if (!win.isOpen || win.isMinimized) {
      openApp(appId);
    } else if (focusedApp === appId) {
      minimizeApp(appId);
    } else {
      openApp(appId);
    }
  };

  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 flex h-10 items-center justify-between border-t border-[#232730] bg-[#101216] select-none">
      {/* Left: Start Button + Pinned/Open Apps */}
      <div className="flex h-full items-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleStartMenu();
          }}
          title="Curu-OS Menu"
          aria-label="Curu-OS Start Menu"
          className={`flex h-10 w-12 items-center justify-center transition-colors ${
            startMenuOpen
              ? 'bg-[#272b34] text-[#4ca3dd]'
              : 'text-white hover:bg-[#22262e] hover:text-[#6cc0f5]'
          }`}
        >
          {/* Distinct Curu-OS geometric mark (not Windows 4-pane flag) */}
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4 fill-current"
            aria-hidden="true"
          >
            <rect x="2" y="2" width="7" height="7" rx="1" />
            <rect x="11" y="2" width="7" height="7" rx="1" opacity="0.65" />
            <rect x="2" y="11" width="7" height="7" rx="1" />
            <circle cx="14.5" cy="14.5" r="3" opacity="0.9" />
          </svg>
        </button>

        {/* Pinned & Open App Tabs */}
        <div className="flex h-full items-center">
          {TASKBAR_APPS.map((app) => {
            const win = windows[app.id];
            const isActive = win.isOpen && !win.isMinimized && focusedApp === app.id;
            const badge = badgeByApp[app.id];

            return (
              <button
                key={app.id}
                type="button"
                onClick={() => handleTaskButton(app.id)}
                title={app.label}
                className={`relative flex h-10 items-center gap-2 px-3.5 text-xs transition-colors ${
                  isActive
                    ? 'bg-[#272b34] text-white'
                    : win.isOpen
                      ? 'bg-[#181b21] text-slate-200 hover:bg-[#22262e]'
                      : 'text-slate-300 hover:bg-[#1d2028]'
                }`}
              >
                {renderTaskIcon(app.id)}
                <span className="hidden md:inline font-normal">{app.label}</span>
                {badge > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d93025] px-1 text-[10px] font-bold text-white">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
                {win.isOpen && (
                  <span
                    className={`absolute bottom-0 left-1/2 h-[2px] -translate-x-1/2 transition-all ${
                      isActive ? 'w-full bg-[#4ca3dd]' : 'w-4 bg-slate-400'
                    }`}
                  />
                )}
              </button>
            );
          })}

          {windows.director.isOpen && (
            <button
              type="button"
              onClick={() => handleTaskButton('director')}
              title="Director Inspector"
              className={`relative flex h-10 items-center gap-2 px-3.5 text-xs transition-colors ${
                !windows.director.isMinimized && focusedApp === 'director'
                  ? 'bg-[#272b34] text-white'
                  : 'bg-[#181b21] text-slate-300 hover:bg-[#22262e]'
              }`}
            >
              {renderTaskIcon('director')}
              <span className="hidden md:inline font-normal">Director</span>
              <span
                className={`absolute bottom-0 left-1/2 h-[2px] -translate-x-1/2 ${
                  !windows.director.isMinimized && focusedApp === 'director'
                    ? 'w-full bg-[#4ca3dd]'
                    : 'w-4 bg-slate-400'
                }`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Right: System Tray */}
      <SystemTray />
    </footer>
  );
}
