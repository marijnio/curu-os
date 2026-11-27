import { useState } from 'react';
import {
  Bug,
  Check,
  Folder,
  Layers,
  Mail,
  MessageSquare,
  RotateCcw,
} from 'lucide-react';
import { useOsStore } from '../../store/useOsStore';

export function StartMenu() {
  const startMenuOpen = useOsStore((s) => s.startMenuOpen);
  const scenarioId = useOsStore((s) => s.scenarioId);
  const manifest = useOsStore((s) => s.manifest);
  const availableScenarios = useOsStore((s) => s.availableScenarios);
  const windows = useOsStore((s) => s.windows);
  const openApp = useOsStore((s) => s.openApp);
  const closeApp = useOsStore((s) => s.closeApp);
  const loadScenario = useOsStore((s) => s.loadScenario);
  const resetProgress = useOsStore((s) => s.resetProgress);
  const toggleStartMenu = useOsStore((s) => s.toggleStartMenu);

  const [confirmReset, setConfirmReset] = useState(false);

  if (!startMenuOpen) return null;

  const directorOpen = windows.director.isOpen;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="fixed bottom-10 left-0 z-50 w-76 overflow-hidden rounded-tr-[2px] border-t border-r border-[#323742] bg-[#1b1e24] text-slate-100 shadow-2xl"
    >
      {/* Header */}
      <div className="border-b border-[#2c313b] bg-[#14171c] px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">Curu-OS</div>
            <div className="text-[11px] text-slate-400">
              {manifest?.subtitle || 'Workplace Terminal'}
            </div>
          </div>
          <span className="rounded-[2px] bg-[#262b35] px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
            v0.1
          </span>
        </div>
      </div>

      {/* Applications */}
      <div className="border-b border-[#2c313b] py-1.5">
        <div className="px-3.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Applications
        </div>
        <button
          type="button"
          onClick={() => openApp('messages')}
          className="flex w-full items-center gap-3 px-3.5 py-2 text-xs text-slate-200 hover:bg-[#2a2f3a]"
        >
          <MessageSquare className="h-4 w-4 text-[#25b864]" />
          <span>Messages</span>
        </button>
        <button
          type="button"
          onClick={() => openApp('mail')}
          className="flex w-full items-center gap-3 px-3.5 py-2 text-xs text-slate-200 hover:bg-[#2a2f3a]"
        >
          <Mail className="h-4 w-4 text-[#4ca3dd]" />
          <span>Mail</span>
        </button>
        <button
          type="button"
          onClick={() => openApp('explorer')}
          className="flex w-full items-center gap-3 px-3.5 py-2 text-xs text-slate-200 hover:bg-[#2a2f3a]"
        >
          <Folder className="h-4 w-4 fill-[#eab308] text-[#ca8a04]" />
          <span>File Explorer</span>
        </button>
      </div>

      {/* Scenario Selector */}
      <div className="border-b border-[#2c313b] py-1.5">
        <div className="flex items-center gap-1.5 px-3.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <Layers className="h-3 w-3" />
          Scenarios
        </div>
        <div className="max-h-40 overflow-y-auto">
          {availableScenarios.map((sc) => {
            const active = sc.id === scenarioId;
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => {
                  if (!active) {
                    void loadScenario(sc.id);
                  } else {
                    toggleStartMenu(false);
                  }
                }}
                className={`flex w-full items-center justify-between px-3.5 py-2 text-left transition ${
                  active
                    ? 'bg-[#2a3950] text-white'
                    : 'text-slate-300 hover:bg-[#2a2f3a]'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="truncate text-xs font-medium">{sc.title}</div>
                  {sc.subtitle && (
                    <div className="truncate text-[10px] text-slate-400">
                      {sc.subtitle}
                    </div>
                  )}
                </div>
                {active && <Check className="h-3.5 w-3.5 shrink-0 text-[#4ca3dd]" />}
              </button>
            );
          })}
        </div>
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
          className="flex w-full items-center justify-between px-3.5 py-2 text-xs text-slate-200 hover:bg-[#2a2f3a]"
        >
          <span className="flex items-center gap-2.5">
            <Bug className="h-4 w-4 text-slate-400" />
            Director / Debug Inspector
          </span>
          <span
            className={`rounded-[2px] px-1.5 py-0.5 text-[10px] font-medium ${
              directorOpen
                ? 'bg-[#2a3950] text-[#7cc4f5]'
                : 'bg-[#262b35] text-slate-400'
            }`}
          >
            {directorOpen ? 'ON' : 'OFF'}
          </span>
        </button>

        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs text-rose-300 hover:bg-[#332227]"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Progress
          </button>
        ) : (
          <div className="mx-2 my-1 flex items-center justify-between gap-2 border border-rose-500/40 bg-[#2d1c21] px-2.5 py-1.5">
            <span className="text-[11px] text-rose-200">Restart scenario?</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="rounded-[2px] px-2 py-0.5 text-[11px] text-slate-300 hover:bg-[#3a3f4b]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmReset(false);
                  void resetProgress();
                }}
                className="rounded-[2px] bg-[#d93025] px-2 py-0.5 text-[11px] font-medium text-white hover:bg-[#e53935]"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
