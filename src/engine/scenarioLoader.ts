import { Compiler, CompilerOptions, JsonFileHandler, Story } from 'inkjs/full';
import type { ScenarioIndexEntry, ScenarioManifest } from '../types/scenario';
import { normalizeScenarioPath } from './tagParser';

export interface ScenarioSummary {
  id: string;
  title: string;
  subtitle: string;
  description: string;
}

export interface LoadedScenarioBundle {
  manifest: ScenarioManifest;
  story: Story;
  compiledFrom: 'ink' | 'json';
  compilerWarnings: string[];
}

export function resolveScenarioAssetUrl(scenarioId: string, relativePath: string): string {
  const cleanPath = normalizeScenarioPath(relativePath);
  return `/scenarios/${encodeURIComponent(scenarioId)}/${cleanPath}`;
}

export async function fetchScenarioIndex(): Promise<ScenarioSummary[]> {
  const indexRes = await fetch('/scenarios/index.json', { cache: 'no-store' });
  if (!indexRes.ok) {
    throw new Error(`Failed to fetch scenarios index (${indexRes.status})`);
  }

  const entries = (await indexRes.json()) as ScenarioIndexEntry[];
  const summaries = await Promise.all(
    entries.map(async (entry): Promise<ScenarioSummary> => {
      try {
        const manifestRes = await fetch(
          `/scenarios/${encodeURIComponent(entry.id)}/scenario.json`,
          { cache: 'no-store' }
        );
        if (!manifestRes.ok) {
          return {
            id: entry.id,
            title: entry.title ?? entry.id,
            subtitle: 'Scenario pack',
            description: '',
          };
        }
        const manifest = (await manifestRes.json()) as ScenarioManifest;
        return {
          id: manifest.id || entry.id,
          title: manifest.title || entry.title || entry.id,
          subtitle: manifest.subtitle || '',
          description: manifest.description || '',
        };
      } catch {
        return {
          id: entry.id,
          title: entry.title ?? entry.id,
          subtitle: 'Scenario pack',
          description: '',
        };
      }
    })
  );

  return summaries;
}

function compileInkSourceInBrowser(
  source: string,
  filename: string
): { story: Story; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const options = new CompilerOptions(
    filename,
    [],
    false,
    (message, errorType) => {
      if (errorType === 2) {
        errors.push(message);
      } else {
        warnings.push(message);
      }
    },
    new JsonFileHandler({ [filename]: source })
  );

  const compiler = new Compiler(source, options);
  let story: Story | null = null;
  let compileException: unknown = null;
  try {
    story = compiler.Compile();
  } catch (err) {
    compileException = err;
  }

  const allErrors = [...errors, ...(compiler.errors ?? [])];
  const allWarnings = [...warnings, ...(compiler.warnings ?? [])];

  if (!story || allErrors.length > 0) {
    const fallback =
      compileException instanceof Error
        ? compileException.message
        : `Failed to compile ${filename}`;
    throw new Error(allErrors.join('\n') || fallback);
  }

  return { story, warnings: allWarnings };
}

export async function loadScenarioBundle(scenarioId: string): Promise<LoadedScenarioBundle> {
  const manifestUrl = `/scenarios/${encodeURIComponent(scenarioId)}/scenario.json`;
  const manifestRes = await fetch(manifestUrl, { cache: 'no-store' });
  if (!manifestRes.ok) {
    throw new Error(`Scenario "${scenarioId}" manifest not found (${manifestRes.status})`);
  }

  const manifest = (await manifestRes.json()) as ScenarioManifest;
  const storyFile = manifest.storyFile || 'story.ink';
  const inkUrl = resolveScenarioAssetUrl(scenarioId, storyFile);

  if (storyFile.toLowerCase().endsWith('.ink')) {
    const inkRes = await fetch(inkUrl, { cache: 'no-store' });
    if (inkRes.ok) {
      const inkSource = await inkRes.text();
      const { story, warnings } = compileInkSourceInBrowser(inkSource, storyFile);
      return {
        manifest,
        story,
        compiledFrom: 'ink',
        compilerWarnings: warnings,
      };
    }
  }

  // Fallback to precompiled story.json
  const jsonRelative = storyFile.replace(/\.ink$/i, '.json');
  const jsonUrl = resolveScenarioAssetUrl(scenarioId, jsonRelative);
  const jsonRes = await fetch(jsonUrl, { cache: 'no-store' });
  if (!jsonRes.ok) {
    throw new Error(
      `Neither ${storyFile} nor ${jsonRelative} could be loaded for scenario "${scenarioId}"`
    );
  }

  const jsonText = await jsonRes.text();
  const story = new Story(jsonText);
  return {
    manifest,
    story,
    compiledFrom: 'json',
    compilerWarnings: [],
  };
}
