import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Compiler, CompilerOptions, JsonFileHandler } from 'inkjs/full';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SCENARIOS_DIR = path.join(ROOT_DIR, 'public', 'scenarios');

export function compileInkFile(inkPath) {
  const source = fs.readFileSync(inkPath, 'utf8');
  const filename = path.basename(inkPath);
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
    new JsonFileHandler({ [filename]: source })
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
    throw new Error(`Failed to compile ${inkPath}:\n${errText}`);
  }

  const outPath = inkPath.replace(/\.ink$/i, '.json');
  const json = story.ToJson();
  if (!json) {
    throw new Error(`Compiler produced empty JSON for ${inkPath}`);
  }
  fs.writeFileSync(outPath, json, 'utf8');
  return { inkPath, outPath, warnings: allWarnings };
}

export function compileAllScenarios(scenariosDir = SCENARIOS_DIR) {
  if (!fs.existsSync(scenariosDir)) {
    return [];
  }

  const results = [];
  const entries = fs.readdirSync(scenariosDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const scenarioDir = path.join(scenariosDir, entry.name);
    const inkFiles = fs
      .readdirSync(scenarioDir)
      .filter((name) => name.toLowerCase().endsWith('.ink'));

    for (const file of inkFiles) {
      const result = compileInkFile(path.join(scenarioDir, file));
      results.push(result);
    }
  }
  return results;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
  try {
    const compiled = compileAllScenarios();
    if (compiled.length === 0) {
      console.log('[compile-ink] No .ink files found under public/scenarios.');
    } else {
      for (const item of compiled) {
        const relIn = path.relative(ROOT_DIR, item.inkPath);
        const relOut = path.relative(ROOT_DIR, item.outPath);
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
