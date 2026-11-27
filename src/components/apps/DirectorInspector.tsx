import { useRef, useState } from 'react';
import {
  Bookmark,
  Bug,
  Check,
  Compass,
  Download,
  Pencil,
  Play,
  RotateCcw,
  Save,
  Terminal,
  Trash2,
  Upload,
  Variable,
  Webhook,
  Zap,
} from 'lucide-react';
import { formatClock24 } from '../../engine/tagParser';
import { useOsStore } from '../../store/useOsStore';

export function DirectorInspector() {
  const scenarioId = useOsStore((s) => s.scenarioId);
  const compiledFrom = useOsStore((s) => s.compiledFrom);
  const compilerWarnings = useOsStore((s) => s.compilerWarnings);
  const clockMinutes = useOsStore((s) => s.clockMinutes);
  const dayLabel = useOsStore((s) => s.dayLabel);
  const activeChoices = useOsStore((s) => s.activeChoices);
  const pendingHooks = useOsStore((s) => s.pendingHooks);
  const debugLogs = useOsStore((s) => s.debugLogs);
  const checkpoints = useOsStore((s) => s.checkpoints);
  const instantTyping = useOsStore((s) => s.instantTyping);

  const toggleInstantTyping = useOsStore((s) => s.toggleInstantTyping);
  const forceTriggerHook = useOsStore((s) => s.forceTriggerHook);
  const resetProgress = useOsStore((s) => s.resetProgress);
  const getInkVariables = useOsStore((s) => s.getInkVariables);
  const getInkKnots = useOsStore((s) => s.getInkKnots);
  const jumpToKnot = useOsStore((s) => s.jumpToKnot);
  const setInkVariable = useOsStore((s) => s.setInkVariable);
  const saveCheckpoint = useOsStore((s) => s.saveCheckpoint);
  const restoreCheckpoint = useOsStore((s) => s.restoreCheckpoint);
  const deleteCheckpoint = useOsStore((s) => s.deleteCheckpoint);
  const exportSaveJson = useOsStore((s) => s.exportSaveJson);
  const importSaveJson = useOsStore((s) => s.importSaveJson);

  const [tab, setTab] = useState<'state' | 'checkpoints' | 'logs'>('state');
  const [selectedKnot, setSelectedKnot] = useState('');
  const [editingVar, setEditingVar] = useState<string | null>(null);
  const [editingVal, setEditingVal] = useState('');
  const [, setVarTick] = useState(0);

  const [checkpointLabel, setCheckpointLabel] = useState('');
  const [importStatus, setImportStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const inkVars = getInkVariables();
  const inkKnots = getInkKnots();
  const effectiveKnot =
    selectedKnot && inkKnots.includes(selectedKnot)
      ? selectedKnot
      : inkKnots[0] ?? '';

  const handleApplyVariable = (name: string) => {
    setInkVariable(name, editingVal);
    setEditingVar(null);
    setVarTick((t) => t + 1);
  };

  const handleSaveCheckpoint = () => {
    saveCheckpoint(checkpointLabel);
    setCheckpointLabel('');
  };

  const handleExportJson = () => {
    const json = exportSaveJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${scenarioId || 'curu-os'}-snapshot-${formatClock24(clockMinutes).replace(':', '')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const res = importSaveJson(text);
      if (res.ok) {
        setImportStatus({ ok: true, message: `Restored "${file.name}".` });
      } else {
        setImportStatus({
          ok: false,
          message: res.error || 'Failed to import JSON.',
        });
      }
    } catch (err) {
      setImportStatus({
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

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
            onClick={() => setTab('checkpoints')}
            className={`rounded-[2px] px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
              tab === 'checkpoints'
                ? 'bg-[#343842] text-white border-b-2 border-[#4ca3dd]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Checkpoints ({checkpoints.length})
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
              <div className="mt-0.5 truncate font-mono text-xs text-white">
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
              <div className="mt-0.5 truncate font-mono text-xs text-[#6cc0f5]">
                {formatClock24(clockMinutes)} · {dayLabel}
              </div>
            </div>
          </div>

          {/* Knot Jumper */}
          <div className="rounded-[2px] border border-[#33363d] bg-[#25262b] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <Compass className="h-3.5 w-3.5 text-[#6cc0f5]" />
              Jump to Ink Knot ({inkKnots.length})
            </div>
            {inkKnots.length === 0 ? (
              <div className="text-xs text-slate-500">No named knots found.</div>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  value={effectiveKnot}
                  onChange={(e) => setSelectedKnot(e.target.value)}
                  className="flex-1 rounded-[2px] border border-[#3d414a] bg-[#1a1b1f] px-2.5 py-1.5 font-mono text-xs text-slate-200 outline-none focus:border-[#4ca3dd]"
                >
                  {inkKnots.map((knot) => (
                    <option key={knot} value={knot}>
                      {knot}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => jumpToKnot(effectiveKnot)}
                  disabled={!effectiveKnot}
                  className="inline-flex shrink-0 items-center gap-1 rounded-[2px] bg-[#0067c0] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#005aa8] disabled:opacity-40 cursor-pointer"
                >
                  <Play className="h-3 w-3" />
                  Jump
                </button>
              </div>
            )}
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
                      <span className="text-slate-200">{hook.target}</span>
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

          {/* Ink Variables (Inline Editable) */}
          <div className="rounded-[2px] border border-[#33363d] bg-[#25262b] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <Variable className="h-3.5 w-3.5 text-[#6cc0f5]" />
                Ink Global Variables ({inkVars.length})
              </span>
              {inkVars.length > 0 && (
                <span className="text-[10px] text-slate-400">
                  Click value to edit
                </span>
              )}
            </div>
            {inkVars.length === 0 ? (
              <div className="text-xs text-slate-500">No Ink variables declared.</div>
            ) : (
              <div className="divide-y divide-[#33363d] rounded-[2px] border border-[#33363d] bg-[#1a1b1f]">
                {inkVars.map((v) => {
                  const isEditing = editingVar === v.name;
                  return (
                    <div
                      key={v.name}
                      className="flex items-center justify-between gap-3 px-3 py-1.5 font-mono text-[11px]"
                    >
                      <span className="text-slate-300">{v.name}</span>
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            autoFocus
                            value={editingVal}
                            onChange={(e) => setEditingVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleApplyVariable(v.name);
                              } else if (e.key === 'Escape') {
                                setEditingVar(null);
                              }
                            }}
                            className="w-40 rounded-[2px] border border-[#4ca3dd] bg-[#25262b] px-2 py-0.5 text-[11px] text-white outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleApplyVariable(v.name)}
                            aria-label={`Apply ${v.name}`}
                            className="rounded-[2px] bg-emerald-600 p-1 text-white hover:bg-emerald-500 cursor-pointer"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVar(v.name);
                            setEditingVal(v.value);
                          }}
                          className="group inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                        >
                          <span>{v.value}</span>
                          <Pencil className="h-2.5 w-2.5 opacity-0 transition group-hover:opacity-100 text-slate-400" />
                        </button>
                      )}
                    </div>
                  );
                })}
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
      ) : tab === 'checkpoints' ? (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          {/* Save & JSON Transfer Controls */}
          <div className="rounded-[2px] border border-[#33363d] bg-[#25262b] p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <Bookmark className="h-3.5 w-3.5 text-[#6cc0f5]" />
                Save Checkpoint
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="inline-flex items-center gap-1 rounded-[2px] border border-[#3d414a] bg-[#2d3036] px-2 py-1 text-[11px] text-slate-200 hover:bg-[#383c44] cursor-pointer"
                >
                  <Download className="h-3 w-3" />
                  Export JSON
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-[2px] border border-[#3d414a] bg-[#2d3036] px-2 py-1 text-[11px] text-slate-200 hover:bg-[#383c44] cursor-pointer"
                >
                  <Upload className="h-3 w-3" />
                  Import JSON
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => void handleImportFile(e)}
                  className="hidden"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={checkpointLabel}
                onChange={(e) => setCheckpointLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveCheckpoint();
                }}
                placeholder="Optional checkpoint label (e.g. Before escalation)..."
                className="flex-1 rounded-[2px] border border-[#3d414a] bg-[#1a1b1f] px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-[#4ca3dd]"
              />
              <button
                type="button"
                onClick={handleSaveCheckpoint}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-[2px] bg-[#0067c0] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#005aa8] cursor-pointer"
              >
                <Save className="h-3 w-3" />
                Save
              </button>
            </div>

            {importStatus && (
              <div
                className={`rounded-[2px] border px-2.5 py-1.5 text-[11px] ${
                  importStatus.ok
                    ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
                    : 'border-rose-500/40 bg-rose-950/30 text-rose-300'
                }`}
              >
                {importStatus.message}
              </div>
            )}
          </div>

          {/* Saved Checkpoints List */}
          <div className="rounded-[2px] border border-[#33363d] bg-[#25262b] p-3">
            <div className="mb-2 text-xs font-semibold text-slate-200">
              Saved Checkpoints ({checkpoints.length})
            </div>
            {checkpoints.length === 0 ? (
              <div className="text-xs text-slate-500">
                No checkpoints saved for "{scenarioId}" yet.
              </div>
            ) : (
              <div className="space-y-1.5">
                {checkpoints.map((cp) => (
                  <div
                    key={cp.id}
                    className="flex items-center justify-between gap-3 rounded-[2px] border border-[#33363d] bg-[#1a1b1f] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-slate-100">
                        {cp.name}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                        {cp.clockStr} · {cp.dayLabel} · saved {cp.savedAt}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => restoreCheckpoint(cp.id)}
                        className="inline-flex items-center gap-1 rounded-[2px] bg-[#0067c0] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-[#005aa8] cursor-pointer"
                      >
                        <RotateCcw className="h-2.5 w-2.5" />
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCheckpoint(cp.id)}
                        aria-label={`Delete ${cp.name}`}
                        className="rounded-[2px] border border-[#3d414a] p-1 text-slate-400 hover:border-rose-500/50 hover:text-rose-300 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
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
                            : entry.type === 'director' || entry.type === 'checkpoint'
                              ? 'bg-purple-500/20 text-purple-300'
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
