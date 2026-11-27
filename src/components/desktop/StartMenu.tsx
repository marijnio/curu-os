import {
  Bug,
  ChevronRight,
  Folder,
  Home,
  Layers,
  LogOut,
  Mail,
  MessageSquare,
  StickyNote,
  User,
} from 'lucide-react';
import { selectTranslations } from '../../engine/i18n';
import { normalizePlayerPrompt } from '../../engine/templateVars';
import { useOsStore } from '../../store/useOsStore';

export function StartMenu() {
  const startMenuOpen = useOsStore((s) => s.startMenuOpen);
  const authEnabled = useOsStore((s) => s.authEnabled);
  const manifest = useOsStore((s) => s.manifest);
  const playerVariables = useOsStore((s) => s.playerVariables);
  const windows = useOsStore((s) => s.windows);
  const openApp = useOsStore((s) => s.openApp);
  const closeApp = useOsStore((s) => s.closeApp);
  const openStartScreen = useOsStore((s) => s.openStartScreen);
  const openScenarioSelector = useOsStore((s) => s.openScenarioSelector);
  const logout = useOsStore((s) => s.logout);
  const toggleStartMenu = useOsStore((s) => s.toggleStartMenu);
  const t = useOsStore(selectTranslations);

  if (!startMenuOpen) return null;

  const directorOpen = windows.director.isOpen;
  const promptVarName =
    normalizePlayerPrompt(manifest?.playerPrompt)?.variableName ?? 'player_name';
  const playerName = playerVariables[promptVarName];

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="fixed bottom-10 left-0 z-[1100] w-76 overflow-hidden rounded-tr-[2px] border-t border-r border-[#323742] bg-[#1b1e24] text-slate-100 shadow-2xl"
    >
      {/* Header */}
      <div className="border-b border-[#2c313b] bg-[#14171c] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <div className="text-sm font-semibold text-white">
              {manifest?.theme?.osName || 'Curu-OS'}
            </div>
            <div className="truncate text-[11px] text-slate-400">
              {manifest?.subtitle || t.startMenu.defaultSubtitle}
            </div>
            {playerName && (
              <div className="mt-1 flex items-center gap-1 truncate text-[10px] text-[#7cc4f5]">
                <User className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{t.startMenu.signedInAs(playerName)}</span>
              </div>
            )}
          </div>
          <span className="shrink-0 rounded-[2px] bg-[#262b35] px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
            {manifest?.theme?.osVersion || 'v0.6'}
          </span>
        </div>
      </div>

      {/* Applications */}
      <div className="border-b border-[#2c313b] py-1.5">
        <div className="px-3.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {t.startMenu.applications}
        </div>
        <button
          type="button"
          onClick={() => openApp('messages')}
          className="flex w-full items-center gap-3 px-3.5 py-2 text-xs text-slate-200 hover:bg-[#2a2f3a] cursor-pointer"
        >
          <MessageSquare className="h-4 w-4 text-[#25b864]" />
          <span>{t.apps.messages}</span>
        </button>
        <button
          type="button"
          onClick={() => openApp('mail')}
          className="flex w-full items-center gap-3 px-3.5 py-2 text-xs text-slate-200 hover:bg-[#2a2f3a] cursor-pointer"
        >
          <Mail className="h-4 w-4 text-[#4ca3dd]" />
          <span>{t.apps.mail}</span>
        </button>
        <button
          type="button"
          onClick={() => openApp('explorer')}
          className="flex w-full items-center gap-3 px-3.5 py-2 text-xs text-slate-200 hover:bg-[#2a2f3a] cursor-pointer"
        >
          <Folder className="h-4 w-4 fill-[#eab308] text-[#ca8a04]" />
          <span>{t.apps.explorer}</span>
        </button>
        <button
          type="button"
          onClick={() => openApp('notes')}
          className="flex w-full items-center gap-3 px-3.5 py-2 text-xs text-slate-200 hover:bg-[#2a2f3a] cursor-pointer"
        >
          <StickyNote className="h-4 w-4 text-[#f59e0b]" />
          <span>{t.apps.notes}</span>
        </button>
      </div>

      {/* Current Scenario & Switcher */}
      <div className="border-b border-[#2c313b] py-1.5">
        <div className="flex items-center gap-1.5 px-3.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <Layers className="h-3 w-3" />
          {t.startMenu.scenario}
        </div>
        {manifest?.title && (
          <div className="truncate px-3.5 py-1 text-[11px] font-medium text-slate-300">
            {manifest.title}
          </div>
        )}
        <button
          type="button"
          onClick={() => openStartScreen()}
          className="flex w-full items-center justify-between px-3.5 py-2 text-xs text-slate-200 hover:bg-[#2a2f3a] cursor-pointer"
        >
          <span className="flex items-center gap-2.5">
            <Home className="h-3.5 w-3.5 text-slate-400" />
            {t.startMenu.returnToStartScreen}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        </button>
        <button
          type="button"
          onClick={() => openScenarioSelector()}
          className="flex w-full items-center justify-between px-3.5 py-2 text-xs text-slate-200 hover:bg-[#2a2f3a] cursor-pointer"
        >
          <span>{t.startMenu.switchScenario}</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        </button>
      </div>

      {/* System Actions */}
      <div className="py-1.5">
        <button
          type="button"
          onClick={() => {
            if (directorOpen) {
              closeApp('director');
              toggleStartMenu(false);
            } else {
              openApp('director');
            }
          }}
          className="flex w-full items-center justify-between px-3.5 py-2 text-xs text-slate-200 hover:bg-[#2a2f3a] cursor-pointer"
        >
          <span className="flex items-center gap-2.5">
            <Bug className="h-4 w-4 text-slate-400" />
            {t.startMenu.directorInspector}
          </span>
          <span
            className={`rounded-[2px] px-1.5 py-0.5 text-[10px] font-medium ${directorOpen
                ? 'bg-[#2a3950] text-[#7cc4f5]'
                : 'bg-[#262b35] text-slate-400'
              }`}
          >
            {directorOpen ? t.startMenu.on : t.startMenu.off}
          </span>
        </button>

        {authEnabled && (
          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs text-slate-300 hover:bg-[#2a2f3a] cursor-pointer"
          >
            <LogOut className="h-4 w-4 text-slate-400" />
            {t.startMenu.signOut}
          </button>
        )}
      </div>
    </div>
  );
}
