import { type CSSProperties, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bug,
  Folder,
  Loader2,
  Mail,
  MessageSquare,
  RotateCcw,
  StickyNote,
  X,
} from 'lucide-react';
import type { AppId } from '../../types/os';
import { resolveScenarioAssetUrl } from '../../engine/scenarioLoader';
import { selectTranslations } from '../../engine/i18n';
import { useOsStore } from '../../store/useOsStore';
import { DesktopIcon } from './DesktopIcon';
import { Window } from './Window';
import { Taskbar } from './Taskbar';
import { StartMenu } from './StartMenu';
import { MessagesApp } from '../apps/MessagesApp';
import { MailApp } from '../apps/MailApp';
import { FileExplorerApp } from '../apps/FileExplorerApp';
import { NotesApp } from '../apps/NotesApp';
import { DirectorInspector } from '../apps/DirectorInspector';

export function Desktop() {
  const isLoading = useOsStore((s) => s.isLoading);
  const loadError = useOsStore((s) => s.loadError);
  const scenarioId = useOsStore((s) => s.scenarioId);
  const manifest = useOsStore((s) => s.manifest);
  const windows = useOsStore((s) => s.windows);
  const toasts = useOsStore((s) => s.toasts);
  const unreadChatCounts = useOsStore((s) => s.unreadChatCounts);
  const emails = useOsStore((s) => s.emails);
  const files = useOsStore((s) => s.files);
  const unreadNotesCount = useOsStore((s) => s.unreadNotesCount);
  const t = useOsStore(selectTranslations);

  const openApp = useOsStore((s) => s.openApp);
  const closeApp = useOsStore((s) => s.closeApp);
  const toggleStartMenu = useOsStore((s) => s.toggleStartMenu);
  const toggleNotifications = useOsStore((s) => s.toggleNotifications);
  const clickNotification = useOsStore((s) => s.clickNotification);
  const dismissToast = useOsStore((s) => s.dismissToast);
  const resetProgress = useOsStore((s) => s.resetProgress);

  const [selectedIcon, setSelectedIcon] = useState<AppId | null>(null);

  // Sync browser tab title with scenario manifest / optional theme
  useEffect(() => {
    const osName = manifest?.theme?.osName || 'Curu-OS';
    document.title =
      manifest?.theme?.windowTitle ||
      (manifest?.title ? `${manifest.title} — ${osName}` : osName);
  }, [manifest]);

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

  const wallpaperStyle: CSSProperties = {};
  if (manifest?.theme?.wallpaperColor) {
    wallpaperStyle.backgroundColor = manifest.theme.wallpaperColor;
  }
  if (manifest?.theme?.wallpaperImage && scenarioId) {
    wallpaperStyle.backgroundImage = `url("${resolveScenarioAssetUrl(scenarioId, manifest.theme.wallpaperImage)}")`;
    wallpaperStyle.backgroundSize = 'cover';
    wallpaperStyle.backgroundPosition = 'center';
  }

  return (
    <div
      onClick={() => {
        setSelectedIcon(null);
        toggleStartMenu(false);
        toggleNotifications(false);
      }}
      style={wallpaperStyle}
      className="curu-wallpaper relative h-screen w-screen overflow-hidden"
    >
      {/* Desktop Shortcuts */}
      <div className="relative z-10 flex flex-col items-start gap-2 p-3">
        <DesktopIcon
          label={t.apps.messages}
          icon={
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#25b864] shadow-sm">
              <MessageSquare className="h-5 w-5 fill-white text-white" />
            </div>
          }
          badgeCount={totalChatUnread}
          selected={selectedIcon === 'messages'}
          onSelect={() => setSelectedIcon('messages')}
          onOpen={() => openApp('messages')}
        />
        <DesktopIcon
          label={t.apps.mail}
          icon={
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0078d4] shadow-sm">
              <Mail className="h-5 w-5 text-white" />
            </div>
          }
          badgeCount={totalMailUnread}
          selected={selectedIcon === 'mail'}
          onSelect={() => setSelectedIcon('mail')}
          onOpen={() => openApp('mail')}
        />
        <DesktopIcon
          label={t.apps.explorer}
          icon={
            <Folder className="h-10 w-10 fill-[#f3c13a] text-[#c79514] drop-shadow-sm" />
          }
          badgeCount={totalFilesUnread}
          selected={selectedIcon === 'explorer'}
          onSelect={() => setSelectedIcon('explorer')}
          onOpen={() => openApp('explorer')}
        />
        <DesktopIcon
          label={t.apps.notes}
          icon={
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#d97706] shadow-sm">
              <StickyNote className="h-5 w-5 text-white" />
            </div>
          }
          badgeCount={unreadNotesCount}
          selected={selectedIcon === 'notes'}
          onSelect={() => setSelectedIcon('notes')}
          onOpen={() => openApp('notes')}
        />
      </div>

      {/* Loading / Error State */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45">
          <div className="flex items-center gap-3 rounded-[2px] border border-slate-300 bg-white px-5 py-3.5 text-sm text-slate-800 shadow-xl">
            <Loader2 className="h-4 w-4 animate-spin text-[#0067c0]" />
            {t.desktop.loadingWorkspace}
          </div>
        </div>
      )}

      {loadError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-md rounded-[3px] border border-slate-300 bg-white p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-700 font-semibold text-sm">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              {t.desktop.scenarioLoadError}
            </div>
            <pre className="mt-3 max-h-48 overflow-auto rounded-[2px] border border-slate-200 bg-slate-50 p-3 text-xs text-rose-700 whitespace-pre-wrap">
              {loadError}
            </pre>
            <button
              type="button"
              onClick={() => void resetProgress()}
              className="mt-4 inline-flex items-center gap-1.5 rounded-[2px] bg-[#0067c0] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#005aa8]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t.desktop.retryScenario}
            </button>
          </div>
        </div>
      )}

      {/* Windows Layer */}
      <Window
        windowState={windows.messages}
        icon={<MessageSquare className="h-3.5 w-3.5 fill-[#25b864] text-[#25b864]" />}
      >
        <MessagesApp />
      </Window>

      <Window
        windowState={windows.mail}
        icon={<Mail className="h-3.5 w-3.5 text-[#0067c0]" />}
      >
        <MailApp />
      </Window>

      <Window
        windowState={windows.explorer}
        icon={<Folder className="h-3.5 w-3.5 fill-[#eab308] text-[#ca8a04]" />}
      >
        <FileExplorerApp />
      </Window>

      <Window
        windowState={windows.notes}
        icon={<StickyNote className="h-3.5 w-3.5 text-[#d97706]" />}
      >
        <NotesApp />
      </Window>

      <Window
        windowState={windows.director}
        icon={<Bug className="h-3.5 w-3.5 text-slate-600" />}
      >
        <DirectorInspector />
      </Window>

      {/* Flat Windows-style Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed right-3 bottom-12 z-50 flex w-80 flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              onClick={(e) => {
                e.stopPropagation();
                clickNotification(toast);
              }}
              className="flex items-start justify-between gap-2 rounded-[2px] border border-[#3a3f4b] bg-[#1f2228] p-3 text-slate-100 shadow-xl transition-colors hover:border-[#4ca3dd] cursor-pointer"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#4ca3dd]" />
                  <span className="truncate text-xs font-semibold text-white">
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
                aria-label={t.desktop.dismissNotification}
                className="p-0.5 text-slate-400 hover:text-white"
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
