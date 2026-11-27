import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Compiler, CompilerOptions, JsonFileHandler } from 'inkjs/full';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ENGINE_ROOT = path.resolve(__dirname, '..');
export const DEFAULT_SCENARIOS_DIR = path.join(ENGINE_ROOT, 'public', 'scenarios');

export function resolveScenariosDir(explicitDir) {
  if (explicitDir) {
    return path.resolve(explicitDir);
  }
  if (process.env.CURU_SCENARIOS_DIR) {
    return path.resolve(process.env.CURU_SCENARIOS_DIR);
  }
  return DEFAULT_SCENARIOS_DIR;
}

export function collectInkFiles(dir, baseDir = dir, acc = {}) {
  if (!fs.existsSync(dir)) return acc;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectInkFiles(fullPath, baseDir, acc);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.ink')) {
      const relPosix = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      acc[relPosix] = fs.readFileSync(fullPath, 'utf8');
    }
  }
  return acc;
}

export function resolveScenarioEntrypoints(scenarioDir) {
  const manifestPath = path.join(scenarioDir, 'scenario.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (typeof manifest?.storyFile === 'string' && manifest.storyFile.toLowerCase().endsWith('.ink')) {
        const target = path.resolve(scenarioDir, manifest.storyFile);
        if (fs.existsSync(target)) {
          return [target];
        }
      }
    } catch {
      // Fall through to default discovery; validate-scenarios will report invalid JSON
    }
  }

  const defaultStory = path.join(scenarioDir, 'story.ink');
  if (fs.existsSync(defaultStory)) {
    return [defaultStory];
  }

  return fs
    .readdirSync(scenarioDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.ink'))
    .map((entry) => path.join(scenarioDir, entry.name));
}

export function compileInkFile(inkPath, scenarioDir = path.dirname(inkPath)) {
  const resolvedScenarioDir = path.resolve(scenarioDir);
  const resolvedInkPath = path.resolve(inkPath);
  const source = fs.readFileSync(resolvedInkPath, 'utf8');
  const filename = path.relative(resolvedScenarioDir, resolvedInkPath).replace(/\\/g, '/');
  const fileMap = collectInkFiles(resolvedScenarioDir);
  fileMap[filename] = source;

  const errors = [];
  const warnings = [];

  const options = new CompilerOptions(
    filename,
    [],
    false,
    (message, errorType) => {
      // ErrorType: 0 = Author, 1 = Warning, 2 = Error
      if (errorType === 2) {
        errors.push(message);
      } else {
        warnings.push(message);
      }
    },
    new JsonFileHandler(fileMap)
  );

  const compiler = new Compiler(source, options);
  let story = null;
  let compileException = null;
  try {
    story = compiler.Compile();
  } catch (err) {
    compileException = err;
  }

  const allErrors = [...errors, ...(compiler.errors ?? [])];
  const allWarnings = [...warnings, ...(compiler.warnings ?? [])];

  if (!story || allErrors.length > 0) {
    const errText =
      allErrors.length > 0
        ? allErrors.join('\n')
        : compileException instanceof Error
          ? compileException.message
          : 'Unknown Ink compilation failure';
    throw new Error(`Failed to compile ${resolvedInkPath}:\n${errText}`);
  }

  const outPath = resolvedInkPath.replace(/\.ink$/i, '.json');
  const json = story.ToJson();
  if (!json) {
    throw new Error(`Compiler produced empty JSON for ${resolvedInkPath}`);
  }
  fs.writeFileSync(outPath, json, 'utf8');
  return { inkPath: resolvedInkPath, outPath, warnings: allWarnings };
}

export function compileAllScenarios(scenariosDir = resolveScenariosDir()) {
  const resolvedDir = path.resolve(scenariosDir);
  if (!fs.existsSync(resolvedDir)) {
    return [];
  }

  const results = [];
  const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const scenarioDir = path.join(resolvedDir, entry.name);
    const entrypoints = resolveScenarioEntrypoints(scenarioDir);

    for (const inkPath of entrypoints) {
      const result = compileInkFile(inkPath, scenarioDir);
      results.push(result);
    }
  }
  return results;
}

function parseScenariosArg(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--scenarios' && argv[i + 1]) {
      return argv[i + 1];
    }
    if (arg.startsWith('--scenarios=')) {
      return arg.slice('--scenarios='.length);
    }
  }
  return undefined;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
  try {
    const scenariosDir = resolveScenariosDir(parseScenariosArg(process.argv.slice(2)));
    const compiled = compileAllScenarios(scenariosDir);
    if (compiled.length === 0) {
      console.log(`[compile-ink] No .ink files found under ${scenariosDir}.`);
    } else {
      for (const item of compiled) {
        const relIn = path.relative(process.cwd(), item.inkPath);
        const relOut = path.relative(process.cwd(), item.outPath);
        console.log(`[compile-ink] ${relIn} -> ${relOut}`);
        for (const warn of item.warnings) {
          console.warn(`[compile-ink] warning: ${warn}`);
        }
      }
    }
  } catch (err) {
    console.error('[compile-ink] Error:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
