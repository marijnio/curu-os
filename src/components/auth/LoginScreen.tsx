import { type FormEvent, useEffect, useState } from 'react';
import {
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Monitor,
  Play,
  RotateCcw,
  Sparkles,
  User,
} from 'lucide-react';
import { normalizePlayerPrompt, sanitizePlayerInput } from '../../engine/templateVars';
import { getSavedScenarioMeta, useOsStore } from '../../store/useOsStore';

export function LoginScreen() {
  const appPhase = useOsStore((s) => s.appPhase);
  const authEnabled = useOsStore((s) => s.authEnabled);
  const authError = useOsStore((s) => s.authError);
  const isLoading = useOsStore((s) => s.isLoading);
  const loadError = useOsStore((s) => s.loadError);
  const availableScenarios = useOsStore((s) => s.availableScenarios);
  const pendingScenarioId = useOsStore((s) => s.pendingScenarioId);
  const playerVariables = useOsStore((s) => s.playerVariables);

  const initApp = useOsStore((s) => s.initApp);
  const login = useOsStore((s) => s.login);
  const logout = useOsStore((s) => s.logout);
  const loadScenario = useOsStore((s) => s.loadScenario);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submittingAuth, setSubmittingAuth] = useState(false);

  const [selectedId, setSelectedId] = useState<string>(
    pendingScenarioId || availableScenarios[0]?.id || ''
  );
  const [freshMode, setFreshMode] = useState(false);
  const [nameValue, setNameValue] = useState('');

  useEffect(() => {
    if (
      pendingScenarioId &&
      availableScenarios.some((sc) => sc.id === pendingScenarioId)
    ) {
      setSelectedId(pendingScenarioId);
    } else if (
      availableScenarios.length > 0 &&
      !availableScenarios.some((sc) => sc.id === selectedId)
    ) {
      setSelectedId(availableScenarios[0].id);
    }
  }, [pendingScenarioId, availableScenarios, selectedId]);

  const selectedScenario =
    availableScenarios.find((sc) => sc.id === selectedId) ??
    availableScenarios[0] ??
    null;
  const activePrompt = normalizePlayerPrompt(selectedScenario?.playerPrompt);
  const savedMeta = selectedScenario
    ? getSavedScenarioMeta(
        selectedScenario.id,
        activePrompt?.variableName ?? 'player_name'
      )
    : null;

  useEffect(() => {
    setFreshMode(false);
    if (!selectedScenario || !activePrompt) {
      setNameValue('');
      return;
    }
    const existingName =
      savedMeta?.playerName ||
      playerVariables[activePrompt.variableName] ||
      activePrompt.defaultValue ||
      '';
    setNameValue(existingName);
    // Intentionally reset form only when switching selected scenario
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScenario?.id]);

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submittingAuth) return;
    setSubmittingAuth(true);
    try {
      const res = await login(password);
      if (res.ok) {
        setPassword('');
      }
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleLaunchFresh = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedScenario || isLoading) return;

    let vars: Record<string, string> | undefined;
    if (activePrompt) {
      const cleaned = sanitizePlayerInput(nameValue);
      if (activePrompt.required && !cleaned) return;
      const finalValue = cleaned || sanitizePlayerInput(activePrompt.defaultValue);
      if (finalValue) {
        vars = { [activePrompt.variableName]: finalValue };
      }
    }

    void loadScenario(selectedScenario.id, {
      forceReset: true,
      playerVariables: vars,
    });
  };

  const cleanedName = sanitizePlayerInput(nameValue);
  const canSubmitFresh =
    !isLoading &&
    Boolean(selectedScenario) &&
    (!activePrompt || !activePrompt.required || cleanedName.length > 0);

  return (
    <div className="curu-wallpaper relative flex h-screen w-screen items-center justify-center overflow-auto p-4 text-slate-100">
      {/* Subtle workstation grid glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(76,163,221,0.16),_transparent_55%)]" />

      {appPhase === 'booting' && (
        <div className="relative z-10 flex items-center gap-3 rounded-[3px] border border-[#323742] bg-[#1b1e24] px-6 py-4 text-sm text-slate-200 shadow-2xl">
          <Loader2 className="h-4 w-4 animate-spin text-[#4ca3dd]" />
          Initializing workstation...
        </div>
      )}

      {appPhase === 'login' && (
        <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-[3px] border border-[#323742] bg-[#1b1e24] shadow-2xl">
          <div className="border-b border-[#2c313b] bg-[#14171c] px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-[2px] bg-[#0067c0] text-white shadow-sm">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-white">
                    Curu-OS Workstation
                  </h1>
                  <p className="text-[11px] text-slate-400">
                    Access Restricted
                  </p>
                </div>
              </div>
              <span className="rounded-[2px] bg-[#262b35] px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                AUTH
              </span>
            </div>
          </div>

          <form onSubmit={(e) => void handleLoginSubmit(e)} className="p-5 space-y-4">
            <p className="text-xs leading-relaxed text-slate-300">
              Enter your access password to unlock available scenarios.
            </p>

            <div>
              <label
                htmlFor="curu-password"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-400"
              >
                Access Password
              </label>
              <div className="relative flex items-center">
                <input
                  id="curu-password"
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  autoComplete="current-password"
                  disabled={submittingAuth}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password..."
                  className="w-full rounded-[2px] border border-[#3d414a] bg-[#14171c] py-2 pr-9 pl-3 text-xs text-white placeholder:text-slate-500 outline-none focus:border-[#4ca3dd] disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            {authError && (
              <div className="flex items-start gap-2 rounded-[2px] border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submittingAuth || password.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-[2px] bg-[#0067c0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#005aa8] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {submittingAuth ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <LogIn className="h-3.5 w-3.5" />
                  Unlock Workstation
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {appPhase === 'select_scenario' && (
        <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-[3px] border border-[#323742] bg-[#1b1e24] shadow-2xl">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-[#2c313b] bg-[#14171c] px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-[2px] bg-[#0067c0] text-white shadow-sm">
                <Monitor className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-white">Curu-OS</h1>
                <p className="text-[11px] text-slate-400">
                  Select a scenario to start your shift
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-[2px] bg-[#262b35] px-2 py-1 font-mono text-[10px] text-slate-300">
                <Layers className="h-3 w-3 text-[#4ca3dd]" />
                {availableScenarios.length}{' '}
                {availableScenarios.length === 1 ? 'Scenario' : 'Scenarios'}
              </span>

              {authEnabled && (
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="inline-flex items-center gap-1.5 rounded-[2px] border border-[#3d414a] bg-[#262b35] px-2.5 py-1 text-[11px] font-medium text-slate-200 transition hover:bg-[#323845] cursor-pointer"
                >
                  <LogOut className="h-3 w-3 text-slate-400" />
                  Sign Out
                </button>
              )}
            </div>
          </header>

          {loadError && (
            <div className="flex items-center justify-between gap-3 border-b border-rose-500/30 bg-rose-950/35 px-5 py-2.5 text-xs text-rose-200">
              <span className="flex items-center gap-2 min-w-0">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span className="truncate">{loadError}</span>
              </span>
              <button
                type="button"
                onClick={() => void initApp()}
                className="shrink-0 rounded-[2px] border border-rose-400/40 bg-rose-900/40 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-rose-800/50 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {availableScenarios.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400">
              No scenarios were found in the scenario index.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-5">
              {/* Left Column: Scenario List */}
              <aside className="border-b border-[#2c313b] bg-[#171a20] md:col-span-2 md:border-r md:border-b-0">
                <div className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-[#2c313b]">
                  Available Scenarios
                </div>
                <div className="max-h-[380px] overflow-y-auto divide-y divide-[#252932]">
                  {availableScenarios.map((sc) => {
                    const isSelected = selectedScenario?.id === sc.id;
                    const scPrompt = normalizePlayerPrompt(sc.playerPrompt);
                    const scSaved = getSavedScenarioMeta(
                      sc.id,
                      scPrompt?.variableName ?? 'player_name'
                    );

                    return (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => setSelectedId(sc.id)}
                        className={`flex w-full flex-col gap-1 border-l-[3px] px-4 py-3 text-left transition cursor-pointer ${
                          isSelected
                            ? 'border-l-[#4ca3dd] bg-[#242c3a] text-white'
                            : 'border-l-transparent text-slate-300 hover:bg-[#22262f]'
                        }`}
                      >
                        <div className="text-xs font-semibold leading-snug">
                          {sc.title}
                        </div>
                        {sc.subtitle && (
                          <div className="text-[11px] text-slate-400 truncate">
                            {sc.subtitle}
                          </div>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {scSaved && (
                            <span className="inline-flex items-center gap-1 rounded-[2px] bg-[#1e3a5f] px-1.5 py-0.5 text-[10px] font-medium text-[#7cc4f5]">
                              <Clock className="h-2.5 w-2.5" />
                              In Progress
                            </span>
                          )}
                          {scPrompt && (
                            <span className="inline-flex items-center gap-1 rounded-[2px] bg-[#262b35] px-1.5 py-0.5 text-[10px] text-slate-300">
                              <Sparkles className="h-2.5 w-2.5 text-amber-400" />
                              Personalized
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>

              {/* Right Column: Launch Panel */}
              <section className="relative flex flex-col justify-between p-5 md:col-span-3">
                {selectedScenario && (
                  <div className="space-y-4">
                    <div>
                      <div className="text-base font-semibold text-white leading-snug">
                        {selectedScenario.title}
                      </div>
                      {selectedScenario.subtitle && (
                        <div className="mt-0.5 text-xs text-[#7cc4f5]">
                          {selectedScenario.subtitle}
                        </div>
                      )}
                      {selectedScenario.description && (
                        <p className="mt-3 text-xs leading-relaxed text-slate-300">
                          {selectedScenario.description}
                        </p>
                      )}
                    </div>

                    {savedMeta && !freshMode ? (
                      <div className="space-y-3 pt-1">
                        <div className="rounded-[2px] border border-[#2f4562] bg-[#172230] p-3.5 space-y-1.5">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#7cc4f5]">
                            Saved Session Available
                          </div>
                          <div className="font-mono text-xs text-slate-200">
                            {savedMeta.clockStr} · {savedMeta.dayLabel}
                          </div>
                          {savedMeta.playerName && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                              <User className="h-3 w-3 text-[#7cc4f5]" />
                              Signed in as{' '}
                              <span className="font-semibold text-white">
                                {savedMeta.playerName}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => void loadScenario(selectedScenario.id)}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-[2px] bg-[#0067c0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#005aa8] disabled:opacity-50 cursor-pointer"
                          >
                            {isLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Play className="h-3.5 w-3.5" />
                            )}
                            Resume Session
                          </button>
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => {
                              if (activePrompt) {
                                setFreshMode(true);
                              } else {
                                void loadScenario(selectedScenario.id, {
                                  forceReset: true,
                                });
                              }
                            }}
                            className="inline-flex items-center justify-center gap-1.5 rounded-[2px] border border-[#3d414a] bg-[#262b35] px-3.5 py-2 text-xs font-medium text-slate-200 transition hover:bg-[#323845] disabled:opacity-50 cursor-pointer"
                          >
                            <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                            Start Fresh
                          </button>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleLaunchFresh} className="space-y-4 pt-1">
                        {activePrompt && (
                          <div className="rounded-[2px] border border-[#2c313b] bg-[#14171c] p-3.5 space-y-2">
                            <label
                              htmlFor="curu-player-name"
                              className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-300"
                            >
                              <span className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-[#4ca3dd]" />
                                {activePrompt.label}
                              </span>
                              {activePrompt.required && (
                                <span className="text-[10px] font-normal text-slate-400">
                                  Required
                                </span>
                              )}
                            </label>
                            <input
                              id="curu-player-name"
                              type="text"
                              autoFocus
                              maxLength={60}
                              disabled={isLoading}
                              value={nameValue}
                              onChange={(e) => setNameValue(e.target.value)}
                              placeholder={activePrompt.placeholder}
                              className="w-full rounded-[2px] border border-[#3d414a] bg-[#1b1e24] px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-[#4ca3dd] disabled:opacity-60"
                            />
                            {activePrompt.helperText && (
                              <p className="text-[11px] leading-relaxed text-slate-400">
                                {activePrompt.helperText}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="submit"
                            disabled={!canSubmitFresh}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-[2px] bg-[#0067c0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#005aa8] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Launching...
                              </>
                            ) : (
                              <>
                                <Play className="h-3.5 w-3.5" />
                                {freshMode ? 'Start Fresh' : 'Start Scenario'}
                              </>
                            )}
                          </button>

                          {savedMeta && freshMode && (
                            <button
                              type="button"
                              onClick={() => setFreshMode(false)}
                              className="text-xs text-slate-400 underline decoration-slate-600 hover:text-slate-200 cursor-pointer"
                            >
                              Back to Resume
                            </button>
                          )}
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#1b1e24]/80">
                    <div className="flex items-center gap-2.5 rounded-[2px] border border-[#323742] bg-[#14171c] px-4 py-2.5 text-xs text-slate-200 shadow-lg">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#4ca3dd]" />
                      Loading scenario...
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
