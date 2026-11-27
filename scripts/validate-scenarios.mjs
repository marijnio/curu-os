import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectInkFiles,
  compileInkFile,
  resolveScenarioEntrypoints,
  resolveScenariosDir,
} from './compile-ink.mjs';

const __filename = fileURLToPath(import.meta.url);

const AUDIO_EXTENSIONS = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.webm']);

function normalizeScenarioRelPath(rawPath) {
  return rawPath.trim().replace(/^(\.\/|\/)+/, '').replace(/\\/g, '/');
}

function isAudioPath(relPath) {
  const ext = path.extname(relPath).toLowerCase();
  return AUDIO_EXTENSIONS.has(ext);
}

function isInsideDir(targetPath, rootDir) {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedTarget = path.resolve(targetPath);
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + path.sep);
}

function checkAssetPath({
  scenarioId,
  scenarioDir,
  relPath,
  sourceLabel,
  treatMissingAsWarning,
  errors,
  warnings,
}) {
  const normalized = normalizeScenarioRelPath(relPath);
  if (!normalized) {
    errors.push(`[${scenarioId}] Empty asset path in ${sourceLabel}`);
    return;
  }

  const resolved = path.resolve(scenarioDir, normalized);
  if (!isInsideDir(resolved, scenarioDir)) {
    errors.push(`[${scenarioId}] Path escapes scenario directory in ${sourceLabel}: "${relPath}"`);
    return;
  }

  if (!fs.existsSync(resolved)) {
    const msg = `[${scenarioId}] Missing asset "${normalized}" referenced by ${sourceLabel}`;
    if (treatMissingAsWarning || isAudioPath(normalized)) {
      warnings.push(`${msg} (synthesized fallback audio will be used if audio)`);
    } else {
      errors.push(msg);
    }
  }
}

function scanInkTags(inkSource) {
  const contactRefs = [];
  const assets = [];
  const tagErrors = [];

  const lines = inkSource.split(/\r?\n/);
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx += 1) {
    const rawLine = lines[lineIdx];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;

    // Strip inline // comments when not preceded by : (e.g. URLs)
    const cleanLine = rawLine.replace(/(^|\s)\/\/.*$/, '');
    const segments = cleanLine.split('#').slice(1);

    for (let seg of segments) {
      // On choice lines (`+ # CHANNEL: chat # SENDER: id [Choice text]`), strip choice bracket text
      const bracketIdx = seg.indexOf('[');
      if (bracketIdx !== -1 && (trimmed.startsWith('+') || trimmed.startsWith('*'))) {
        seg = seg.slice(0, bracketIdx);
      }

      const normalizedTag = seg.replace(/\\\|/g, '|').trim();
      if (!normalizedTag) continue;

      const pipeParts = normalizedTag.split('|').map((p) => p.trim()).filter(Boolean);
      const primary = pipeParts[0] ?? '';
      const colonIdx = primary.indexOf(':');
      if (colonIdx === -1) continue;

      const key = primary.slice(0, colonIdx).trim().toUpperCase();
      const value = primary.slice(colonIdx + 1).trim();
      const lineNum = lineIdx + 1;

      if (!value) {
        if (
          key === 'SET_TIME' ||
          key === 'CONTACT_STATUS' ||
          key === 'EVENT_HOOK' ||
          key === 'NOTE_ADD'
        ) {
          tagErrors.push({ lineNum, message: `Empty value in # ${key}` });
        }
        continue;
      }

      if (key === 'SENDER' || key === 'CONTACT_UNLOCK') {
        contactRefs.push({ id: value, tag: key, lineNum });
      } else if (key === 'CONTACT_STATUS') {
        contactRefs.push({ id: value, tag: key, lineNum });
        const rawStatus = (pipeParts[1] ?? '').trim().toLowerCase();
        const statusVal = rawStatus.startsWith('status:')
          ? rawStatus.slice('status:'.length).trim()
          : rawStatus;
        if (
          statusVal !== 'online' &&
          statusVal !== 'away' &&
          statusVal !== 'offline'
        ) {
          tagErrors.push({
            lineNum,
            message: `Invalid # CONTACT_STATUS "${rawStatus || '(missing)'}" (expected online, away, or offline)`,
          });
        }
      } else if (key === 'SET_TIME') {
        const match = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(value);
        const hours = match ? Number(match[1]) : -1;
        const mins = match ? Number(match[2]) : -1;
        if (!match || hours < 0 || hours > 23 || mins < 0 || mins > 59) {
          tagErrors.push({
            lineNum,
            message: `Invalid # SET_TIME "${value}" (expected 24-hour HH:MM)`,
          });
        }
      } else if (key === 'ATTACHMENT' || key === 'FILE_UNLOCK') {
        assets.push({ path: value, kind: key, lineNum });
      } else if (key === 'VOICE_NOTE') {
        assets.push({ path: value, kind: 'VOICE_NOTE', lineNum, isAudio: true });
      } else if (key === 'NOTE_ADD') {
        for (const extra of pipeParts.slice(1)) {
          const extraColon = extra.indexOf(':');
          if (extraColon === -1) {
            tagErrors.push({
              lineNum,
              message: `Invalid # NOTE_ADD parameter "${extra}" (expected content:<text> or id:<note_id>)`,
            });
            continue;
          }
          const paramKey = extra.slice(0, extraColon).trim().toLowerCase();
          const paramVal = extra.slice(extraColon + 1).trim();
          if (paramKey !== 'content' && paramKey !== 'id') {
            tagErrors.push({
              lineNum,
              message: `Unknown # NOTE_ADD parameter "${paramKey}" (expected content or id)`,
            });
          } else if (paramKey === 'id' && !paramVal) {
            tagErrors.push({
              lineNum,
              message: 'Empty id in # NOTE_ADD',
            });
          }
        }
      } else if (key === 'EVENT_HOOK') {
        const match =
          /^(on_file_open|on_audio_play|on_email_read|on_note_open):(.*?)(?:\s*(?:=>|->)\s*([A-Za-z0-9_.]+))?$/i.exec(
            value
          );
        if (!match) {
          tagErrors.push({
            lineNum,
            message: `Invalid # EVENT_HOOK "${value}" (expected on_file_open:<path>, on_audio_play:<path>, on_email_read:<matcher>, or on_note_open:<id_or_title>)`,
          });
        } else {
          const eventKind = match[1].toLowerCase();
          const target = match[2].trim();
          if (!target) {
            tagErrors.push({
              lineNum,
              message: `Empty target in # EVENT_HOOK (${eventKind})`,
            });
          } else if (eventKind === 'on_file_open') {
            assets.push({ path: target, kind: 'EVENT_HOOK', lineNum });
          } else if (eventKind === 'on_audio_play') {
            assets.push({
              path: target,
              kind: 'EVENT_HOOK',
              lineNum,
              isAudio: true,
            });
          }
        }
      }
    }
  }

  return { contactRefs, assets, tagErrors };
}

export function validateScenarios(scenariosDir = resolveScenariosDir()) {
  const resolvedDir = path.resolve(scenariosDir);
  const errors = [];
  const warnings = [];
  let scenariosChecked = 0;

  if (!fs.existsSync(resolvedDir)) {
    return {
      ok: false,
      errors: [`Scenarios directory not found: ${resolvedDir}`],
      warnings,
      scenariosChecked,
    };
  }

  const indexPath = path.join(resolvedDir, 'index.json');
  if (!fs.existsSync(indexPath)) {
    return {
      ok: false,
      errors: [`Missing scenario registry: ${indexPath}`],
      warnings,
      scenariosChecked,
    };
  }

  let indexEntries;
  try {
    indexEntries = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  } catch (err) {
    return {
      ok: false,
      errors: [
        `Invalid JSON in ${indexPath}: ${err instanceof Error ? err.message : String(err)}`,
      ],
      warnings,
      scenariosChecked,
    };
  }

  if (!Array.isArray(indexEntries) || indexEntries.length === 0) {
    return {
      ok: false,
      errors: [`${indexPath} must be a non-empty JSON array of scenario entries.`],
      warnings,
      scenariosChecked,
    };
  }

  const seenIds = new Set();

  for (const entry of indexEntries) {
    const scenarioId = typeof entry?.id === 'string' ? entry.id.trim() : '';
    if (!scenarioId) {
      errors.push('Scenario entry in index.json is missing a non-empty string "id".');
      continue;
    }

    if (seenIds.has(scenarioId)) {
      errors.push(`Duplicate scenario id "${scenarioId}" in index.json.`);
      continue;
    }
    seenIds.add(scenarioId);

    const scenarioDir = path.join(resolvedDir, scenarioId);
    if (!isInsideDir(scenarioDir, resolvedDir) || !fs.existsSync(scenarioDir)) {
      errors.push(`[${scenarioId}] Scenario directory not found: ${scenarioDir}`);
      continue;
    }

    scenariosChecked += 1;

    const manifestPath = path.join(scenarioDir, 'scenario.json');
    if (!fs.existsSync(manifestPath)) {
      errors.push(`[${scenarioId}] Missing manifest: ${manifestPath}`);
      continue;
    }

    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (err) {
      errors.push(
        `[${scenarioId}] Invalid JSON in scenario.json: ${err instanceof Error ? err.message : String(err)}`
      );
      continue;
    }

    if (typeof manifest.id !== 'string' || !manifest.id.trim()) {
      errors.push(`[${scenarioId}] scenario.json is missing required string "id".`);
    } else if (manifest.id !== scenarioId) {
      warnings.push(
        `[${scenarioId}] scenario.json "id" ("${manifest.id}") differs from folder/index id ("${scenarioId}").`
      );
    }

    if (typeof manifest.title !== 'string' || !manifest.title.trim()) {
      errors.push(`[${scenarioId}] scenario.json is missing required string "title".`);
    }

    if (
      manifest.locale !== undefined &&
      manifest.locale !== 'en' &&
      manifest.locale !== 'nl'
    ) {
      errors.push(
        `[${scenarioId}] scenario.json "locale" must be "en" or "nl" when provided (got ${JSON.stringify(manifest.locale)}).`
      );
    }

    if (typeof manifest.startTime !== 'string' || !/^\d{1,2}:\d{2}$/.test(manifest.startTime)) {
      errors.push(
        `[${scenarioId}] scenario.json "startTime" must be a 24-hour "HH:MM" string (got ${JSON.stringify(manifest.startTime)}).`
      );
    }

    const contactIds = new Set();
    if (!Array.isArray(manifest.contacts)) {
      errors.push(`[${scenarioId}] scenario.json "contacts" must be an array.`);
    } else {
      for (const contact of manifest.contacts) {
        if (!contact || typeof contact.id !== 'string' || !contact.id.trim()) {
          errors.push(`[${scenarioId}] Contact entry is missing a valid "id".`);
          continue;
        }
        if (typeof contact.name !== 'string' || !contact.name.trim()) {
          errors.push(`[${scenarioId}] Contact "${contact.id}" is missing a "name".`);
        }
        contactIds.add(contact.id);
      }
    }

    if (!Array.isArray(manifest.files)) {
      errors.push(`[${scenarioId}] scenario.json "files" must be an array.`);
    } else {
      for (const fileEntry of manifest.files) {
        if (!fileEntry || typeof fileEntry.path !== 'string' || !fileEntry.path.trim()) {
          errors.push(`[${scenarioId}] File catalog entry is missing a valid "path".`);
          continue;
        }
        if (typeof fileEntry.name !== 'string' || !fileEntry.name.trim()) {
          errors.push(`[${scenarioId}] File entry "${fileEntry.path}" is missing "name".`);
        }
        if (typeof fileEntry.folder !== 'string' || !fileEntry.folder.trim()) {
          errors.push(`[${scenarioId}] File entry "${fileEntry.path}" is missing "folder".`);
        }
        if (typeof fileEntry.kind !== 'string' || !fileEntry.kind.trim()) {
          errors.push(`[${scenarioId}] File entry "${fileEntry.path}" is missing "kind".`);
        }

        checkAssetPath({
          scenarioId,
          scenarioDir,
          relPath: fileEntry.path,
          sourceLabel: 'scenario.json files[]',
          treatMissingAsWarning: fileEntry.kind === 'audio',
          errors,
          warnings,
        });
      }
    }

    if (manifest.initialNotes !== undefined) {
      if (!Array.isArray(manifest.initialNotes)) {
        errors.push(`[${scenarioId}] scenario.json "initialNotes" must be an array when provided.`);
      } else {
        const seenNoteIds = new Set();
        manifest.initialNotes.forEach((noteEntry, idx) => {
          if (!noteEntry || typeof noteEntry !== 'object' || Array.isArray(noteEntry)) {
            errors.push(`[${scenarioId}] scenario.json initialNotes[${idx}] must be an object.`);
            return;
          }
          if (typeof noteEntry.title !== 'string' || !noteEntry.title.trim()) {
            errors.push(`[${scenarioId}] scenario.json initialNotes[${idx}] is missing a non-empty string "title".`);
          }
          if (typeof noteEntry.content !== 'string') {
            errors.push(`[${scenarioId}] scenario.json initialNotes[${idx}] must have a string "content".`);
          }
          if (noteEntry.id !== undefined) {
            if (typeof noteEntry.id !== 'string' || !noteEntry.id.trim()) {
              errors.push(`[${scenarioId}] scenario.json initialNotes[${idx}].id must be a non-empty string when provided.`);
            } else {
              const trimmedId = noteEntry.id.trim();
              if (seenNoteIds.has(trimmedId)) {
                errors.push(`[${scenarioId}] Duplicate initialNotes id "${trimmedId}" in scenario.json.`);
              }
              seenNoteIds.add(trimmedId);
            }
          }
          if (
            noteEntry.updatedAt !== undefined &&
            (typeof noteEntry.updatedAt !== 'string' || !noteEntry.updatedAt.trim())
          ) {
            errors.push(`[${scenarioId}] scenario.json initialNotes[${idx}].updatedAt must be a non-empty string when provided.`);
          }
        });
      }
    }

    if (manifest.theme !== undefined) {
      if (typeof manifest.theme !== 'object' || manifest.theme === null || Array.isArray(manifest.theme)) {
        errors.push(`[${scenarioId}] scenario.json "theme" must be an object when provided.`);
      } else if (typeof manifest.theme.wallpaperImage === 'string' && manifest.theme.wallpaperImage.trim()) {
        checkAssetPath({
          scenarioId,
          scenarioDir,
          relPath: manifest.theme.wallpaperImage,
          sourceLabel: 'scenario.json theme.wallpaperImage',
          treatMissingAsWarning: false,
          errors,
          warnings,
        });
      }
    }

    let promptVarName = null;
    if (manifest.playerPrompt !== undefined) {
      const pp = manifest.playerPrompt;
      if (typeof pp !== 'object' || pp === null || Array.isArray(pp)) {
        errors.push(`[${scenarioId}] scenario.json "playerPrompt" must be an object when provided.`);
      } else {
        for (const boolField of ['enabled', 'required']) {
          if (pp[boolField] !== undefined && typeof pp[boolField] !== 'boolean') {
            errors.push(`[${scenarioId}] scenario.json playerPrompt.${boolField} must be a boolean.`);
          }
        }
        for (const strField of ['variableName', 'label', 'placeholder', 'helperText', 'defaultValue']) {
          if (pp[strField] !== undefined && typeof pp[strField] !== 'string') {
            errors.push(`[${scenarioId}] scenario.json playerPrompt.${strField} must be a string.`);
          }
        }
        if (typeof pp.variableName === 'string' && pp.variableName.trim()) {
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(pp.variableName.trim())) {
            errors.push(
              `[${scenarioId}] scenario.json playerPrompt.variableName "${pp.variableName}" must be a valid identifier (/^[A-Za-z_][A-Za-z0-9_]*$/).`
            );
          }
        }
        if (pp.enabled !== false) {
          promptVarName =
            typeof pp.variableName === 'string' && pp.variableName.trim()
              ? pp.variableName.trim()
              : 'player_name';
        }
      }
    }

    const entrypoints = resolveScenarioEntrypoints(scenarioDir);
    const storyFileRef = typeof manifest.storyFile === 'string' ? manifest.storyFile : 'story.ink';
    if (entrypoints.length === 0) {
      const jsonFallback = path.resolve(scenarioDir, storyFileRef.replace(/\.ink$/i, '.json'));
      if (!fs.existsSync(jsonFallback)) {
        errors.push(`[${scenarioId}] No .ink entrypoint or precompiled .json story found.`);
      }
    } else {
      for (const inkPath of entrypoints) {
        try {
          const result = compileInkFile(inkPath, scenarioDir);
          for (const warn of result.warnings) {
            warnings.push(`[${scenarioId}] Ink warning (${path.basename(inkPath)}): ${warn}`);
          }
        } catch (err) {
          errors.push(
            `[${scenarioId}] Ink compile error: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    const inkFiles = collectInkFiles(scenarioDir);
    if (promptVarName && Object.keys(inkFiles).length > 0) {
      const varDeclRe = new RegExp(`^\\s*VAR\\s+${promptVarName}\\b`, 'm');
      const hasVarDecl = Object.values(inkFiles).some((src) => varDeclRe.test(src));
      if (!hasVarDecl) {
        warnings.push(
          `[${scenarioId}] playerPrompt is enabled for "${promptVarName}", but no \`VAR ${promptVarName} = "..."\` declaration was found in .ink files (it will still work in Markdown {{${promptVarName}}} templates).`
        );
      }
    }
    for (const [relInkPath, inkSource] of Object.entries(inkFiles)) {
      const { contactRefs, assets, tagErrors } = scanInkTags(inkSource);
      for (const err of tagErrors) {
        errors.push(`[${scenarioId}] ${relInkPath}:${err.lineNum} ${err.message}`);
      }
      for (const ref of contactRefs) {
        if (!contactIds.has(ref.id)) {
          warnings.push(
            `[${scenarioId}] ${relInkPath}:${ref.lineNum} references # ${ref.tag}: "${ref.id}" which is not in scenario.json contacts[].`
          );
        }
      }
      for (const asset of assets) {
        checkAssetPath({
          scenarioId,
          scenarioDir,
          relPath: asset.path,
          sourceLabel: `${relInkPath}:${asset.lineNum} (# ${asset.kind})`,
          treatMissingAsWarning: Boolean(asset.isAudio),
          errors,
          warnings,
        });
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    scenariosChecked,
  };
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
  const scenariosDir = resolveScenariosDir(parseScenariosArg(process.argv.slice(2)));
  const result = validateScenarios(scenariosDir);

  for (const warn of result.warnings) {
    console.warn(`[validate] warning: ${warn}`);
  }
  for (const err of result.errors) {
    console.error(`[validate] error: ${err}`);
  }

  console.log(
    `[validate] Checked ${result.scenariosChecked} scenario(s) in ${scenariosDir} — ${result.errors.length} error(s), ${result.warnings.length} warning(s).`
  );

  if (!result.ok) {
    process.exit(1);
  }
}
