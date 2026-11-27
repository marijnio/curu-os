import { useState } from 'react';
import { Bug, Play, RotateCcw, Zap, Terminal, Variable, Webhook } from 'lucide-react';
import { formatClock24 } from '../../engine/tagParser';
import { useOsStore } from '../../store/useOsStore';

export function DirectorInspector() {
  const scenarioId = useOsStore((s) => s.scenarioId);
  const compiledFrom = useOsStore((s) => s.compiledFrom);
  const compilerWarnings = useOsStore((s) => s.compilerWarnings);
  const clockMinutes = useOsStore((s) => s.clockMinutes);
  const activeChoices = useOsStore((s) => s.activeChoices);
  const pendingHooks = useOsStore((s) => s.pendingHooks);
  const debugLogs = useOsStore((s) => s.debugLogs);
  const instantTyping = useOsStore((s) => s.instantTyping);

  const toggleInstantTyping = useOsStore((s) => s.toggleInstantTyping);
  const forceTriggerHook = useOsStore((s) => s.forceTriggerHook);
  const resetProgress = useOsStore((s) => s.resetProgress);
  const getInkVariables = useOsStore((s) => s.getInkVariables);

  const [tab, setTab] = useState<'state' | 'logs'>('state');
  const inkVars = getInkVariables();

  return (
    <div className="flex h-full w-full flex-col bg-[#1e1e1e] text-slate-200">
      {/* DevTools-style Top Toolbar */}
      <div className="flex items-center justify-between border-b border-[#33363d] bg-[#25262b] px-3 py-1.5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTab('state')}
            className={`rounded-[2px] px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
              tab === 'state'
                ? 'bg-[#343842] text-white border-b-2 border-[#4ca3dd]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Live State
          </button>
          <button
            type="button"
            onClick={() => setTab('logs')}
            className={`rounded-[2px] px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
              tab === 'logs'
                ? 'bg-[#343842] text-white border-b-2 border-[#4ca3dd]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Event Log ({debugLogs.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleInstantTyping}
            className={`inline-flex items-center gap-1 rounded-[2px] border px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
              instantTyping
                ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                : 'border-[#3d414a] bg-[#2d3036] text-slate-300 hover:text-white'
            }`}
          >
            <Zap className="h-3 w-3" />
            Instant Typing: {instantTyping ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={() => void resetProgress()}
            className="inline-flex items-center gap-1 rounded-[2px] border border-[#3d414a] bg-[#2d3036] px-2 py-1 text-[11px] text-slate-200 hover:bg-[#383c44] cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>
      </div>

      {tab === 'state' ? (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          {/* Runtime Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-[2px] border border-[#33363d] bg-[#25262b] p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Scenario
              </div>
              <div className="mt-0.5 font-mono text-xs text-white">
                {scenarioId}
              </div>
            </div>
            <div className="rounded-[2px] border border-[#33363d] bg-[#25262b] p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Story Source
              </div>
              <div className="mt-0.5 font-mono text-xs text-emerald-400">
                {compiledFrom === 'ink' ? 'story.ink (live)' : 'story.json'}
              </div>
            </div>
            <div className="rounded-[2px] border border-[#33363d] bg-[#25262b] p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                In-World Clock
              </div>
              <div className="mt-0.5 font-mono text-xs text-[#6cc0f5]">
                {formatClock24(clockMinutes)}
              </div>
            </div>
          </div>

          {compilerWarnings.length > 0 && (
            <div className="rounded-[2px] border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-200">
              <div className="font-semibold mb-1">Ink Compiler Warnings</div>
              {compilerWarnings.map((w, i) => (
                <div key={i} className="font-mono text-[11px]">
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Pending Event Hooks */}
          <div className="rounded-[2px] border border-[#33363d] bg-[#25262b] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <Webhook className="h-3.5 w-3.5 text-amber-400" />
              Pending Event Hooks ({pendingHooks.length})
            </div>
            {pendingHooks.length === 0 ? (
              <div className="text-xs text-slate-500">No hooks registered.</div>
            ) : (
              <div className="space-y-1.5">
                {pendingHooks.map((hook) => (
                  <div
                    key={hook.id}
                    className="flex items-center justify-between gap-2 rounded-[2px] border border-[#33363d] bg-[#1a1b1f] px-2.5 py-2"
                  >
                    <div className="min-w-0 font-mono text-[11px]">
                      <span className="text-amber-300">{hook.event}</span>:{' '}
                      <span className="text-slate-200">{hook.targetPath}</span>
                      {hook.targetKnot && (
                        <span className="text-[#6cc0f5]"> =&gt; {hook.targetKnot}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => forceTriggerHook(hook.id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-[2px] bg-[#0067c0] px-2 py-1 text-[10px] font-semibold text-white hover:bg-[#005aa8] cursor-pointer"
                    >
                      <Play className="h-2.5 w-2.5" />
                      Trigger
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ink Variables */}
          <div className="rounded-[2px] border border-[#33363d] bg-[#25262b] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <Variable className="h-3.5 w-3.5 text-[#6cc0f5]" />
              Ink Global Variables ({inkVars.length})
            </div>
            {inkVars.length === 0 ? (
              <div className="text-xs text-slate-500">No Ink variables declared.</div>
            ) : (
              <div className="divide-y divide-[#33363d] rounded-[2px] border border-[#33363d] bg-[#1a1b1f]">
                {inkVars.map((v) => (
                  <div
                    key={v.name}
                    className="flex items-center justify-between px-3 py-1.5 font-mono text-[11px]"
                  >
                    <span className="text-slate-300">{v.name}</span>
                    <span className="text-emerald-400">{v.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Choices */}
          <div className="rounded-[2px] border border-[#33363d] bg-[#25262b] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <Bug className="h-3.5 w-3.5 text-emerald-400" />
              Active Choices ({activeChoices.length})
            </div>
            {activeChoices.length === 0 ? (
              <div className="text-xs text-slate-500">No active choices.</div>
            ) : (
              <div className="space-y-1">
                {activeChoices.map((c) => (
                  <div
                    key={c.index}
                    className="rounded-[2px] border border-[#33363d] bg-[#1a1b1f] px-2.5 py-1.5 text-[11px]"
                  >
                    <span className="font-mono text-[#6cc0f5]">
                      [{c.channel} → {c.targetId}]
                    </span>{' '}
                    <span className="text-slate-200">{c.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] space-y-1.5">
          {debugLogs.length === 0 ? (
            <div className="p-4 text-center text-slate-500">No events logged.</div>
          ) : (
            [...debugLogs].reverse().map((entry) => (
              <div
                key={entry.id}
                className="rounded-[2px] border border-[#33363d] bg-[#25262b] px-2.5 py-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{entry.time}</span>
                  <span
                    className={`rounded-[2px] px-1 py-0.5 text-[9px] uppercase ${
                      entry.type === 'error'
                        ? 'bg-rose-500/20 text-rose-300'
                        : entry.type === 'hook_fired' || entry.type === 'hook_registered'
                          ? 'bg-amber-500/20 text-amber-300'
                          : entry.type === 'choice'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-[#343842] text-[#7cc4f5]'
                    }`}
                  >
                    {entry.type}
                  </span>
                  <span className="text-slate-200 break-all">{entry.summary}</span>
                </div>
                {entry.detail ? (
                  <div className="mt-1 text-[10px] text-slate-400 break-all">
                    <Terminal className="mr-1 inline h-2.5 w-2.5" />
                    {JSON.stringify(entry.detail)}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
