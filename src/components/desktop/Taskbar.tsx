import { Bug, FolderOpen, Mail, MessageSquare, Terminal } from 'lucide-react';
import type { AppId } from '../../types/os';
import { useOsStore } from '../../store/useOsStore';
import { SystemTray } from './SystemTray';

const TASKBAR_APPS: Array<{
  id: AppId;
  label: string;
  accent: string;
}> = [
  { id: 'messages', label: 'Messages', accent: 'text-emerald-400' },
  { id: 'mail', label: 'Mail', accent: 'text-sky-400' },
  { id: 'explorer', label: 'File Explorer', accent: 'text-amber-400' },
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

  const renderIcon = (id: AppId, cls: string) => {
    switch (id) {
      case 'messages':
        return <MessageSquare className={cls} />;
      case 'mail':
        return <Mail className={cls} />;
      case 'explorer':
        return <FolderOpen className={cls} />;
      case 'director':
        return <Bug className={cls} />;
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
    <footer className="fixed inset-x-0 bottom-0 z-40 flex h-12 items-center justify-between border-t border-slate-700/70 bg-slate-950/90 px-2.5 backdrop-blur-xl select-none">
      {/* Left: Start Button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleStartMenu();
          }}
          className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition cursor-pointer ${
            startMenuOpen
              ? 'border-sky-400/60 bg-sky-500/20 text-sky-200'
              : 'border-slate-700/80 bg-slate-900/90 text-slate-200 hover:border-slate-600 hover:bg-slate-800'
          }`}
        >
          <Terminal className="h-4 w-4 text-sky-400" />
          <span>Curu-OS</span>
        </button>

        <div className="h-5 w-px bg-slate-800 mx-0.5" />

        {/* Center-Left: Core & Open App Tabs */}
        <div className="flex items-center gap-1.5">
          {TASKBAR_APPS.map((app) => {
            const win = windows[app.id];
            const isActive = win.isOpen && !win.isMinimized && focusedApp === app.id;
            const badge = badgeByApp[app.id];

            return (
              <button
                key={app.id}
                type="button"
                onClick={() => handleTaskButton(app.id)}
                className={`relative flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition cursor-pointer ${
                  isActive
                    ? 'border-sky-500/50 bg-slate-800/95 text-slate-100'
                    : win.isOpen
                      ? 'border-slate-700/70 bg-slate-900/70 text-slate-300 hover:bg-slate-800/70'
                      : 'border-transparent bg-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                {renderIcon(app.id, `h-4 w-4 ${app.accent}`)}
                <span className="hidden sm:inline">{app.label}</span>
                {badge > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
                {win.isOpen && (
                  <span
                    className={`absolute bottom-0.5 left-1/2 h-0.5 -translate-x-1/2 rounded-full transition-all ${
                      isActive ? 'w-5 bg-sky-400' : 'w-2.5 bg-slate-500'
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
              className={`relative flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition cursor-pointer ${
                !windows.director.isMinimized && focusedApp === 'director'
                  ? 'border-violet-500/50 bg-slate-800/95 text-slate-100'
                  : 'border-slate-700/70 bg-slate-900/70 text-slate-300 hover:bg-slate-800/70'
              }`}
            >
              <Bug className="h-4 w-4 text-violet-400" />
              <span className="hidden md:inline">Director</span>
            </button>
          )}
        </div>
      </div>

      {/* Right: System Tray */}
      <SystemTray />
    </footer>
  );
}
