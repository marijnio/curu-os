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
  User,
} from 'lucide-react';
import { getTranslations, resolveLocale } from '../../engine/i18n';
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
  const manifest = useOsStore((s) => s.manifest);
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
  const activeLocale = resolveLocale(selectedScenario?.locale ?? manifest?.locale);
  const t = getTranslations(activeLocale);
  const activePrompt = normalizePlayerPrompt(
    selectedScenario?.playerPrompt,
    activeLocale
  );
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
    <div className="curu-wallpaper relative flex h-screen w-screen items-center justify-center overflow-auto p-4 text-slate-900">
      {appPhase === 'booting' && (
        <div className="flex items-center gap-3 rounded-[2px] border border-slate-300 bg-white px-5 py-3.5 text-sm text-slate-800 shadow-xl">
          <Loader2 className="h-4 w-4 animate-spin text-[#0067c0]" />
          {t.selector.initializing}
        </div>
      )}

      {appPhase === 'login' && (
        <div className="w-full max-w-sm overflow-hidden rounded-[3px] border border-[#2b3b55] bg-white text-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.42)]">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-[3px] bg-[#0067c0] text-white shadow-2xs">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-slate-900">
                  {t.selector.workstationTitle}
                </h1>
                <p className="text-[11px] text-slate-500">
                  {t.selector.accessRestricted}
                </p>
              </div>
            </div>
            <span className="rounded border border-slate-200 bg-[#f8f9fa] px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
              AUTH
            </span>
          </div>

          <form onSubmit={(e) => void handleLoginSubmit(e)} className="p-5 space-y-4 bg-white">
            <p className="text-xs leading-relaxed text-slate-600">
              {t.selector.enterPasswordPrompt}
            </p>

            <div>
              <label
                htmlFor="curu-password"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-600"
              >
                {t.selector.accessPassword}
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
                  placeholder={t.selector.enterPasswordPlaceholder}
                  className="w-full rounded-[3px] border border-slate-300 bg-white py-2 pr-9 pl-3 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#0067c0] disabled:bg-slate-50 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword ? t.selector.hidePassword : t.selector.showPassword
                  }
                  className="absolute right-2.5 text-slate-500 hover:text-slate-800 cursor-pointer"
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
              <div className="flex items-start gap-2 rounded-[3px] border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submittingAuth || password.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#0067c0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#005aa8] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {submittingAuth ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t.selector.verifying}
                </>
              ) : (
                <>
                  <LogIn className="h-3.5 w-3.5" />
                  {t.selector.unlockWorkstation}
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {appPhase === 'select_scenario' && (
        <div className="w-full max-w-3xl overflow-hidden rounded-[3px] border border-[#2b3b55] bg-white text-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.42)]">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-[3px] bg-[#0067c0] text-white shadow-2xs">
                <Monitor className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-slate-900">Curu-OS</h1>
                <p className="text-[11px] text-slate-500">
                  {t.selector.selectScenarioPrompt}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded border border-slate-200 bg-[#f8f9fa] px-2 py-1 font-mono text-[10px] text-slate-600">
                <Layers className="h-3 w-3 text-[#0067c0]" />
                {t.selector.scenarioCount(availableScenarios.length)}
              </span>

              {authEnabled && (
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="inline-flex items-center gap-1.5 rounded-[3px] border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100 cursor-pointer"
                >
                  <LogOut className="h-3 w-3 text-slate-500" />
                  {t.selector.signOut}
                </button>
              )}
            </div>
          </header>

          {loadError && (
            <div className="flex items-center justify-between gap-3 border-b border-rose-200 bg-rose-50 px-5 py-2.5 text-xs text-rose-700">
              <span className="flex items-center gap-2 min-w-0">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span className="truncate">{loadError}</span>
              </span>
              <button
                type="button"
                onClick={() => void initApp()}
                className="shrink-0 rounded-[3px] border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100 cursor-pointer"
              >
                {t.selector.retry}
              </button>
            </div>
          )}

          {availableScenarios.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              {t.selector.noScenariosFound}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-5">
              {/* Left Column: Scenario List */}
              <aside className="border-b border-slate-200 bg-[#f8f9fa] md:col-span-2 md:border-r md:border-b-0">
                <div className="border-b border-slate-200 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {t.selector.availableScenarios}
                </div>
                <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-200/80">
                  {availableScenarios.map((sc) => {
                    const isSelected = selectedScenario?.id === sc.id;
                    const scLocale = resolveLocale(sc.locale);
                    const scTranslations = getTranslations(scLocale);
                    const scPrompt = normalizePlayerPrompt(sc.playerPrompt, scLocale);
                    const scSaved = getSavedScenarioMeta(
                      sc.id,
                      scPrompt?.variableName ?? 'player_name'
                    );

                    return (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => setSelectedId(sc.id)}
                        className={`flex w-full flex-col gap-1 border-l-[3px] px-4 py-3 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-l-[#0067c0] bg-[#e5f1fb] text-slate-950'
                            : 'border-l-transparent text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-xs font-semibold leading-snug text-slate-900">
                          {sc.title}
                        </div>
                        {sc.subtitle && (
                          <div className="truncate text-[11px] text-slate-500">
                            {sc.subtitle}
                          </div>
                        )}
                        {scSaved && (
                          <div className="mt-1 flex items-center">
                            <span className="inline-flex items-center gap-1 rounded bg-[#e5f1fb] px-1.5 py-0.5 text-[10px] font-semibold text-[#005aa8] ring-1 ring-[#cde0f5]">
                              <Clock className="h-2.5 w-2.5" />
                              {scTranslations.selector.inProgress}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </aside>

              {/* Right Column: Launch Panel */}
              <section className="relative flex flex-col justify-between bg-white p-5 md:col-span-3">
                {selectedScenario && (
                  <div className="space-y-4">
                    <div>
                      <div className="text-base font-semibold leading-snug text-slate-900">
                        {selectedScenario.title}
                      </div>
                      {selectedScenario.subtitle && (
                        <div className="mt-0.5 text-xs font-medium text-[#0067c0]">
                          {selectedScenario.subtitle}
                        </div>
                      )}
                      {selectedScenario.description && (
                        <p className="mt-3 text-xs leading-relaxed text-slate-600">
                          {selectedScenario.description}
                        </p>
                      )}
                    </div>

                    {savedMeta && !freshMode ? (
                      <div className="space-y-3 pt-1">
                        <div className="rounded-[3px] border border-[#cde0f5] bg-[#f4f8fd] p-3.5 space-y-1.5">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#005aa8]">
                            {t.selector.savedSessionAvailable}
                          </div>
                          <div className="font-mono text-xs text-slate-800">
                            {savedMeta.clockStr} · {savedMeta.dayLabel}
                          </div>
                          {savedMeta.playerName && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-700">
                              <User className="h-3 w-3 text-[#0067c0]" />
                              {t.selector.signedInAsPrefix}{' '}
                              <span className="font-semibold text-slate-900">
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
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-[3px] bg-[#0067c0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#005aa8] disabled:opacity-50 cursor-pointer"
                          >
                            {isLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Play className="h-3.5 w-3.5" />
                            )}
                            {t.selector.resumeSession}
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
                            className="inline-flex items-center justify-center gap-1.5 rounded-[3px] border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
                          >
                            <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                            {t.selector.startFresh}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleLaunchFresh} className="space-y-4 pt-1">
                        {activePrompt && (
                          <div className="rounded-[3px] border border-slate-200 bg-[#f8f9fa] p-3.5 space-y-2">
                            <label
                              htmlFor="curu-player-name"
                              className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-700"
                            >
                              <span className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-[#0067c0]" />
                                {activePrompt.label}
                              </span>
                              {activePrompt.required && (
                                <span className="text-[10px] font-normal text-slate-500">
                                  {t.selector.required}
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
                              className="w-full rounded-[3px] border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#0067c0] disabled:bg-slate-50 disabled:opacity-60"
                            />
                            {activePrompt.helperText && (
                              <p className="text-[11px] leading-relaxed text-slate-500">
                                {activePrompt.helperText}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="submit"
                            disabled={!canSubmitFresh}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-[3px] bg-[#0067c0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#005aa8] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                {t.selector.launching}
                              </>
                            ) : (
                              <>
                                <Play className="h-3.5 w-3.5" />
                                {freshMode
                                  ? t.selector.startFresh
                                  : t.selector.startScenario}
                              </>
                            )}
                          </button>

                          {savedMeta && freshMode && (
                            <button
                              type="button"
                              onClick={() => setFreshMode(false)}
                              className="text-xs text-slate-500 underline decoration-slate-400 hover:text-slate-900 cursor-pointer"
                            >
                              {t.selector.backToResume}
                            </button>
                          )}
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                    <div className="flex items-center gap-2.5 rounded-[3px] border border-slate-300 bg-white px-4 py-2.5 text-xs text-slate-800 shadow-lg">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0067c0]" />
                      {t.selector.loadingScenario}
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
