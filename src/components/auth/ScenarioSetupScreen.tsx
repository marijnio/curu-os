import { type CSSProperties, type FormEvent, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Monitor,
  Play,
  User,
} from 'lucide-react';
import { getTranslations, resolveLocale } from '../../engine/i18n';
import { resolveScenarioAssetUrl } from '../../engine/scenarioLoader';
import { normalizePlayerPrompt, sanitizePlayerInput } from '../../engine/templateVars';
import { useOsStore } from '../../store/useOsStore';

export function ScenarioSetupScreen() {
  const availableScenarios = useOsStore((s) => s.availableScenarios);
  const pendingScenarioId = useOsStore((s) => s.pendingScenarioId);
  const manifest = useOsStore((s) => s.manifest);
  const isLoading = useOsStore((s) => s.isLoading);
  const loadError = useOsStore((s) => s.loadError);

  const loadScenario = useOsStore((s) => s.loadScenario);
  const openScenarioSelector = useOsStore((s) => s.openScenarioSelector);

  const scenario =
    availableScenarios.find((sc) => sc.id === pendingScenarioId) ?? null;
  const activeLocale = resolveLocale(scenario?.locale ?? manifest?.locale);
  const t = getTranslations(activeLocale);
  const activePrompt = normalizePlayerPrompt(
    scenario?.playerPrompt,
    activeLocale
  );

  const [nameValue, setNameValue] = useState(activePrompt?.defaultValue || '');

  useEffect(() => {
    setNameValue(activePrompt?.defaultValue || '');
    // Reset input only when switching the target scenario
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario?.id]);

  useEffect(() => {
    if (!scenario || !activePrompt) {
      openScenarioSelector(pendingScenarioId ?? undefined);
    }
  }, [scenario, activePrompt, pendingScenarioId, openScenarioSelector]);

  useEffect(() => {
    if (!scenario) return;
    const osName = scenario.theme?.osName || 'Curu-OS';
    document.title =
      scenario.theme?.windowTitle ||
      (scenario.title ? `${scenario.title} — ${osName}` : osName);
  }, [scenario]);

  if (!scenario || !activePrompt) {
    return null;
  }

  const wallpaperStyle: CSSProperties = {};
  if (scenario.theme?.wallpaperColor) {
    wallpaperStyle.backgroundColor = scenario.theme.wallpaperColor;
  }
  if (scenario.theme?.wallpaperImage) {
    wallpaperStyle.backgroundImage = `url("${resolveScenarioAssetUrl(
      scenario.id,
      scenario.theme.wallpaperImage
    )}")`;
    wallpaperStyle.backgroundSize = 'cover';
    wallpaperStyle.backgroundPosition = 'center';
  }

  const cleanedName = sanitizePlayerInput(nameValue);
  const canSubmit =
    !isLoading && (!activePrompt.required || cleanedName.length > 0);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const finalValue =
      cleanedName || sanitizePlayerInput(activePrompt.defaultValue);
    const vars = finalValue
      ? { [activePrompt.variableName]: finalValue }
      : undefined;

    void loadScenario(scenario.id, {
      forceReset: true,
      playerVariables: vars,
    });
  };

  return (
    <div
      style={wallpaperStyle}
      className="curu-wallpaper relative flex h-screen w-screen items-center justify-center overflow-auto p-4 text-slate-900"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-[3px] border border-[#2b3b55] bg-white text-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.42)]">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] bg-[#0067c0] text-white shadow-2xs">
              <Monitor className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-slate-900">
                {scenario.theme?.osName || 'Curu-OS'}
              </h1>
              <p className="truncate text-[11px] text-slate-500">
                {t.scenarioSetup.promptSubtitle}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded border border-slate-200 bg-[#f8f9fa] px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
            {t.scenarioSetup.badge}
          </span>
        </header>

        {loadError && (
          <div className="flex items-start gap-2 border-b border-rose-200 bg-rose-50 px-5 py-2.5 text-xs text-rose-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
            <span>{loadError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4 bg-white">
          <div>
            <div className="text-sm font-semibold leading-snug text-slate-900">
              {scenario.title}
            </div>
            {scenario.subtitle && (
              <div className="mt-0.5 text-xs font-medium text-[#0067c0]">
                {scenario.subtitle}
              </div>
            )}
          </div>

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

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => openScenarioSelector(scenario.id)}
              className="inline-flex items-center justify-center gap-1.5 rounded-[3px] border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
              {t.scenarioSetup.backToScenarios}
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-[3px] bg-[#0067c0] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#005aa8] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t.scenarioSetup.entering}
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  {t.scenarioSetup.enterWorkstation}
                </>
              )}
            </button>
          </div>
        </form>

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <div className="flex items-center gap-2.5 rounded-[3px] border border-slate-300 bg-white px-4 py-2.5 text-xs text-slate-800 shadow-lg">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0067c0]" />
              {t.scenarioSetup.entering}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
