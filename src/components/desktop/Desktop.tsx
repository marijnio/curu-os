import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bug,
  FolderOpen,
  Loader2,
  Mail,
  MessageSquare,
  RotateCcw,
  X,
} from 'lucide-react';
import type { AppId } from '../../types/os';
import { useOsStore } from '../../store/useOsStore';
import { DesktopIcon } from './DesktopIcon';
import { Window } from './Window';
import { Taskbar } from './Taskbar';
import { StartMenu } from './StartMenu';
import { MessagesApp } from '../apps/MessagesApp';
import { MailApp } from '../apps/MailApp';
import { FileExplorerApp } from '../apps/FileExplorerApp';
import { DirectorInspector } from '../apps/DirectorInspector';

export function Desktop() {
  const isLoading = useOsStore((s) => s.isLoading);
  const loadError = useOsStore((s) => s.loadError);
  const windows = useOsStore((s) => s.windows);
  const manifest = useOsStore((s) => s.manifest);
  const toasts = useOsStore((s) => s.toasts);
  const unreadChatCounts = useOsStore((s) => s.unreadChatCounts);
  const emails = useOsStore((s) => s.emails);
  const files = useOsStore((s) => s.files);

  const openApp = useOsStore((s) => s.openApp);
  const closeApp = useOsStore((s) => s.closeApp);
  const toggleStartMenu = useOsStore((s) => s.toggleStartMenu);
  const toggleNotifications = useOsStore((s) => s.toggleNotifications);
  const clickNotification = useOsStore((s) => s.clickNotification);
  const dismissToast = useOsStore((s) => s.dismissToast);
  const resetProgress = useOsStore((s) => s.resetProgress);

  const [selectedIcon, setSelectedIcon] = useState<AppId | null>(null);

  // Global Ctrl/Cmd + Shift + D shortcut to toggle Director Inspector
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const directorWin = useOsStore.getState().windows.director;
        if (directorWin.isOpen && !directorWin.isMinimized) {
          closeApp('director');
        } else {
          openApp('director');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openApp, closeApp]);

  const totalChatUnread = Object.values(unreadChatCounts).reduce((a, b) => a + b, 0);
  const totalMailUnread = emails.filter((e) => !e.read).length;
  const totalFilesUnread = files.filter((f) => !f.opened).length;

  return (
    <div
      onClick={() => {
        setSelectedIcon(null);
        toggleStartMenu(false);
        toggleNotifications(false);
      }}
      className="curu-wallpaper relative h-screen w-screen overflow-hidden"
    >
      {/* Subtle dot texture */}
      <div className="curu-grid-overlay pointer-events-none absolute inset-0 opacity-60" />

      {/* Subtle watermark in bottom right above taskbar */}
      {manifest && (
        <div className="pointer-events-none fixed right-5 bottom-16 text-right select-none opacity-45">
          <div className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
            Curu-OS Workstation
          </div>
          <div className="text-[11px] text-slate-400">
            {manifest.title}
          </div>
        </div>
      )}

      {/* Desktop Shortcuts */}
      <div className="relative z-10 flex flex-col items-start gap-2 p-4">
        <DesktopIcon
          label="Messages"
          icon={<MessageSquare className="h-6 w-6 text-emerald-400" />}
          badgeCount={totalChatUnread}
          selected={selectedIcon === 'messages'}
          onSelect={() => setSelectedIcon('messages')}
          onOpen={() => openApp('messages')}
        />
        <DesktopIcon
          label="Mail"
          icon={<Mail className="h-6 w-6 text-sky-400" />}
          badgeCount={totalMailUnread}
          selected={selectedIcon === 'mail'}
          onSelect={() => setSelectedIcon('mail')}
          onOpen={() => openApp('mail')}
        />
        <DesktopIcon
          label="File Explorer"
          icon={<FolderOpen className="h-6 w-6 text-amber-400" />}
          badgeCount={totalFilesUnread}
          selected={selectedIcon === 'explorer'}
          onSelect={() => setSelectedIcon('explorer')}
          onOpen={() => openApp('explorer')}
        />
      </div>

      {/* Loading / Error State */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3.5 text-sm text-slate-200 shadow-2xl">
            <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
            Booting Curu-OS scenario...
          </div>
        </div>
      )}

      {loadError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="max-w-md rounded-xl border border-rose-500/40 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-300 font-semibold text-sm">
              <AlertTriangle className="h-5 w-5 text-rose-400" />
              Scenario Load Error
            </div>
            <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-rose-200 whitespace-pre-wrap">
              {loadError}
            </pre>
            <button
              type="button"
              onClick={() => void resetProgress()}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry Scenario
            </button>
          </div>
        </div>
      )}

      {/* Windows Layer */}
      <Window
        windowState={windows.messages}
        icon={<MessageSquare className="h-4 w-4" />}
      >
        <MessagesApp />
      </Window>

      <Window windowState={windows.mail} icon={<Mail className="h-4 w-4" />}>
        <MailApp />
      </Window>

      <Window
        windowState={windows.explorer}
        icon={<FolderOpen className="h-4 w-4" />}
      >
        <FileExplorerApp />
      </Window>

      <Window windowState={windows.director} icon={<Bug className="h-4 w-4" />}>
        <DirectorInspector />
      </Window>

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed right-3 bottom-14 z-50 flex w-80 flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              onClick={(e) => {
                e.stopPropagation();
                clickNotification(toast);
              }}
              className="flex items-start justify-between gap-2 rounded-xl border border-slate-700/80 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-xl transition hover:border-sky-500/50 cursor-pointer"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-sky-400" />
                  <span className="truncate text-xs font-semibold text-slate-100">
                    {toast.title}
                  </span>
                </div>
                <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-300">
                  {toast.body}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissToast(toast.id);
                }}
                aria-label="Dismiss notification"
                className="rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Start Menu & Taskbar */}
      <StartMenu />
      <Taskbar />
    </div>
  );
}
