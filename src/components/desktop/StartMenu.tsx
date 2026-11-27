import { useState } from 'react';
import {
  Bug,
  Check,
  FolderOpen,
  Mail,
  MessageSquare,
  RotateCcw,
  Terminal,
  Layers,
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
      className="fixed bottom-14 left-3 z-50 w-84 overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/95 shadow-2xl backdrop-blur-xl"
    >
      {/* Brand Header */}
      <div className="border-b border-slate-800 bg-slate-950/60 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Terminal className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-slate-100">
                Curu-OS
              </div>
              <div className="text-[11px] text-slate-400">
                {manifest?.subtitle || 'Workplace Narrative Runtime'}
              </div>
            </div>
          </div>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
            v0.1
          </span>
        </div>
      </div>

      {/* Core Applications */}
      <div className="border-b border-slate-800/80 p-2">
        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Applications
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => openApp('messages')}
            className="flex flex-col items-center gap-1 rounded-lg p-2 text-xs text-slate-200 transition hover:bg-slate-800 cursor-pointer"
          >
            <MessageSquare className="h-4 w-4 text-emerald-400" />
            <span>Messages</span>
          </button>
          <button
            type="button"
            onClick={() => openApp('mail')}
            className="flex flex-col items-center gap-1 rounded-lg p-2 text-xs text-slate-200 transition hover:bg-slate-800 cursor-pointer"
          >
            <Mail className="h-4 w-4 text-sky-400" />
            <span>Mail</span>
          </button>
          <button
            type="button"
            onClick={() => openApp('explorer')}
            className="flex flex-col items-center gap-1 rounded-lg p-2 text-xs text-slate-200 transition hover:bg-slate-800 cursor-pointer"
          >
            <FolderOpen className="h-4 w-4 text-amber-400" />
            <span>Files</span>
          </button>
        </div>
      </div>

      {/* Scenario Selector */}
      <div className="border-b border-slate-800/80 p-2">
        <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <Layers className="h-3 w-3" />
          Scenario Selector
        </div>
        <div className="max-h-40 space-y-1 overflow-y-auto">
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
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition cursor-pointer ${
                  active
                    ? 'bg-sky-500/15 text-sky-200 border border-sky-500/30'
                    : 'text-slate-300 hover:bg-slate-800/80'
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
                {active && <Check className="h-3.5 w-3.5 shrink-0 text-sky-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tools & Actions */}
      <div className="space-y-1 p-2">
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
          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs text-slate-200 transition hover:bg-slate-800 cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-violet-400" />
            Director / Debug Inspector
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
              directorOpen
                ? 'bg-violet-500/20 text-violet-300'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {directorOpen ? 'ON' : 'OFF'}
          </span>
        </button>

        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-rose-300 transition hover:bg-rose-500/15 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Scenario Progress
          </button>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-rose-500/30 bg-rose-950/40 px-2.5 py-1.5">
            <span className="text-[11px] text-rose-200">Restart from 09:00?</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="rounded px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmReset(false);
                  void resetProgress();
                }}
                className="rounded bg-rose-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-rose-500 cursor-pointer"
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
