import { useEffect } from 'react';
import {
  AlertCircle,
  Clock,
  Layers,
  Loader2,
  LogOut,
  Monitor,
  Play,
  User,
} from 'lucide-react';
import { getTranslations, resolveLocale } from '../../engine/i18n';
import { getResumableScenario, useOsStore } from '../../store/useOsStore';

export function StartScreen() {
  const authEnabled = useOsStore((s) => s.authEnabled);
  const isLoading = useOsStore((s) => s.isLoading);
  const loadError = useOsStore((s) => s.loadError);
  const availableScenarios = useOsStore((s) => s.availableScenarios);
  const manifest = useOsStore((s) => s.manifest);
  useOsStore((s) => s.savedProgressVersion);

  const initApp = useOsStore((s) => s.initApp);
  const logout = useOsStore((s) => s.logout);
  const loadScenario = useOsStore((s) => s.loadScenario);
  const openScenarioSelector = useOsStore((s) => s.openScenarioSelector);

  const resumable = getResumableScenario(availableScenarios);
  const activeLocale = resolveLocale(
    resumable?.scenario.locale ?? availableScenarios[0]?.locale ?? manifest?.locale
  );
  const t = getTranslations(activeLocale);

  useEffect(() => {
    document.title = 'Curu-OS';
  }, []);

  return (
    <div className="curu-wallpaper relative flex h-screen w-screen items-center justify-center overflow-auto p-4 text-slate-900">
      <div className="relative w-full max-w-md overflow-hidden rounded-[3px] border border-[#2b3b55] bg-white text-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.42)]">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[3px] bg-[#0067c0] text-white shadow-2xs">
              <Monitor className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-900">Curu-OS</h1>
              <p className="text-[11px] text-slate-500">
                {t.startScreen.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {availableScenarios.length > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded border border-slate-200 bg-[#f8f9fa] px-2 py-1 font-mono text-[10px] text-slate-600">
                <Layers className="h-3 w-3 text-[#0067c0]" />
                {t.selector.scenarioCount(availableScenarios.length)}
              </span>
            )}

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

        <div className="p-5 space-y-4 bg-white">
          {resumable ? (
            <>
              <div className="rounded-[3px] border border-[#cde0f5] bg-[#f4f8fd] p-3.5 space-y-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#005aa8]">
                  {t.startScreen.lastSession}
                </div>
                <div className="text-sm font-semibold leading-snug text-slate-900">
                  {resumable.scenario.title}
                </div>
                {resumable.scenario.subtitle && (
                  <div className="text-xs font-medium text-[#0067c0]">
                    {resumable.scenario.subtitle}
                  </div>
                )}
                <div className="flex items-center gap-1.5 pt-0.5 font-mono text-xs text-slate-700">
                  <Clock className="h-3.5 w-3.5 text-[#0067c0]" />
                  <span>
                    {resumable.savedMeta.clockStr} · {resumable.savedMeta.dayLabel}
                  </span>
                </div>
                {resumable.savedMeta.playerName && (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-700">
                    <User className="h-3.5 w-3.5 text-[#0067c0]" />
                    {t.selector.signedInAsPrefix}{' '}
                    <span className="font-semibold text-slate-900">
                      {resumable.savedMeta.playerName}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => void loadScenario(resumable.scenario.id)}
                  className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#0067c0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#005aa8] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  {t.startScreen.resumeSession}
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => openScenarioSelector(resumable.scenario.id)}
                  className="flex w-full items-center justify-center gap-2 rounded-[3px] border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  <Layers className="h-3.5 w-3.5 text-slate-500" />
                  {t.startScreen.selectScenario}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs leading-relaxed text-slate-600">
                {t.startScreen.welcomePrompt}
              </p>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => openScenarioSelector()}
                className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#0067c0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#005aa8] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                <Layers className="h-3.5 w-3.5" />
                {t.startScreen.selectScenario}
              </button>
            </>
          )}
        </div>

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <div className="flex items-center gap-2.5 rounded-[3px] border border-slate-300 bg-white px-4 py-2.5 text-xs text-slate-800 shadow-lg">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0067c0]" />
              {t.startScreen.resuming}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
