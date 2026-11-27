#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, createServer, preview } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { compileAllScenarios } from '../scripts/compile-ink.mjs';
import { validateScenarios } from '../scripts/validate-scenarios.mjs';
import { curuScenariosPlugin } from '../scripts/scenarios-plugin.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENGINE_ROOT = path.resolve(__dirname, '..');

function readEngineVersion() {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ENGINE_ROOT, 'package.json'), 'utf8')
    );
    return pkg.version || '0.1.0';
  } catch {
    return '0.1.0';
  }
}

function parseCliArgs(argv) {
  const flags = {};
  const positionals = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      flags.help = true;
    } else if (arg === '--version' || arg === '-v') {
      flags.version = true;
    } else if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else {
        const key = arg.slice(2);
        const next = argv[i + 1];
        if (next && !next.startsWith('-')) {
          flags[key] = next;
          i += 1;
        } else {
          flags[key] = true;
        }
      }
    } else {
      positionals.push(arg);
    }
  }

  return { command: positionals[0], args: positionals.slice(1), flags };
}

function resolveConsumerScenariosDir(flagValue) {
  if (typeof flagValue === 'string' && flagValue.trim()) {
    return path.resolve(process.cwd(), flagValue);
  }
  if (process.env.CURU_SCENARIOS_DIR) {
    return path.resolve(process.cwd(), process.env.CURU_SCENARIOS_DIR);
  }
  return path.resolve(process.cwd(), 'scenarios');
}

function assertScenariosDirExists(scenariosDir) {
  if (!fs.existsSync(scenariosDir)) {
    console.error(`[curu-os] Scenarios directory not found: ${scenariosDir}`);
    console.error(
      `[curu-os] Run "curu-os init" to scaffold a scenario repo or pass "--scenarios <path>".`
    );
    process.exit(1);
  }
}

function slugifyScenarioId(raw) {
  const cleaned = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'my_scenario';
}

function writeIfMissing(filePath, content, created, skipped) {
  if (fs.existsSync(filePath)) {
    skipped.push(filePath);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  created.push(filePath);
}

function writeTargetFile(filePath, content, { overwrite, created, updated, skipped }) {
  const existed = fs.existsSync(filePath);
  if (existed && !overwrite) {
    skipped.push(filePath);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  if (existed) {
    updated.push(filePath);
  } else {
    created.push(filePath);
  }
}

function buildScenarioConstraintsRule(engineVersion) {
  return `---
trigger: always_on
---

# Curu-OS Scenario Repository Constraints (Engine v${engineVersion})

This repository contains **scenario content only** and runs on the external \`curu-os\` engine (\`v${engineVersion}\`).

- **No UI or engine code here:** Never create React components, CSS, Vite config changes, or modify files inside \`node_modules/curu-os/\`.
- **Author under \`scenarios/\` only:** Keep all narrative content inside \`scenarios/index.json\` and \`scenarios/<scenario_id>/\` (\`scenario.json\`, \`.ink\` scripts with optional \`INCLUDE\`, \`docs/*.md\`, \`media/*\`).
- **Follow the authoring skill:** Read \`.agent/skills/curu-scenario-author/SKILL.md\` before authoring or editing scenarios, and use only the built-in desktop apps (\`Messages\`, \`Mail\`, \`File Explorer\`, \`Notes\`) and documented Ink \`# TAG\` directives.
- **Respect engine boundaries:** Never invent unsupported \`# TAG\` directives or fake unsupported UI mechanics. If a requested feature is not supported by Curu-OS \`v${engineVersion}\`, clearly explain that it requires an engine update in the \`curu-os\` repository first.
- **Always validate:** Run \`npm run validate\` after scenario edits to verify Ink compilation, \`scenario.json\` schemas, sender IDs, and asset paths.
`;
}

function syncAgentFiles(targetDir, { overwrite }) {
  const version = readEngineVersion();
  const created = [];
  const updated = [];
  const skipped = [];

  const skillSrc = path.join(
    ENGINE_ROOT,
    '.agent',
    'skills',
    'curu-scenario-author',
    'SKILL.md'
  );
  if (fs.existsSync(skillSrc)) {
    writeTargetFile(
      path.join(targetDir, '.agent', 'skills', 'curu-scenario-author', 'SKILL.md'),
      fs.readFileSync(skillSrc, 'utf8'),
      { overwrite, created, updated, skipped }
    );
  }

  writeTargetFile(
    path.join(targetDir, '.agent', 'rules', 'curu-scenario-constraints.md'),
    buildScenarioConstraintsRule(version),
    { overwrite, created, updated, skipped }
  );

  return { version, created, updated, skipped };
}

function printHelp() {
  console.log(`curu-os v${readEngineVersion()} — Curu-OS Narrative Engine CLI

Usage:
  curu-os <command> [options]

Commands:
  dev         Start local Vite dev server with live Ink compilation & hot reload
  build       Compile scenarios and build standalone static bundle
  preview     Preview the built static bundle locally
  compile     Compile .ink stories to .json in the scenarios directory
  validate    Validate index.json, scenario.json manifests, Ink scripts, and assets
  init        Scaffold a new standalone scenario repository
  sync-skill  Refresh Antigravity authoring skill & constraints rule from installed engine

Options:
  --scenarios <dir>   Path to scenarios directory (default: ./scenarios or $CURU_SCENARIOS_DIR)
  --out <dir>         Output directory for build/preview (default: ./dist)
  --port <number>     Server port (default: 5173 for dev, 4173 for preview)
  --host [addr]       Bind server host (pass --host for 0.0.0.0)
  --base <path>       Base public path for static build (default: /)

Init Options:
  curu-os init [dir] [--id <scenario_id>] [--title "<Title>"] [--engine <pkg-ref>]
`);
}

async function runDev(flags) {
  const scenariosDir = resolveConsumerScenariosDir(flags.scenarios);
  assertScenariosDirExists(scenariosDir);

  const port = flags.port ? Number.parseInt(String(flags.port), 10) : 5173;
  const host = flags.host === true ? true : typeof flags.host === 'string' ? flags.host : undefined;

  const server = await createServer({
    configFile: false,
    root: ENGINE_ROOT,
    publicDir: false,
    cacheDir: path.resolve(process.cwd(), 'node_modules/.vite-curu-os'),
    plugins: [
      react(),
      tailwindcss(),
      curuScenariosPlugin({ scenariosDir, isExternal: true }),
    ],
    server: {
      port: Number.isNaN(port) ? 5173 : port,
      host,
      fs: {
        allow: [ENGINE_ROOT, scenariosDir, process.cwd()],
      },
    },
  });

  await server.listen();
  console.log(`[curu-os] Serving external scenarios from: ${scenariosDir}`);
  server.printUrls();
}

async function runBuild(flags) {
  const scenariosDir = resolveConsumerScenariosDir(flags.scenarios);
  assertScenariosDirExists(scenariosDir);

  const outDir = path.resolve(
    process.cwd(),
    typeof flags.out === 'string' ? flags.out : 'dist'
  );
  const base = typeof flags.base === 'string' ? flags.base : '/';

  await build({
    configFile: false,
    root: ENGINE_ROOT,
    base,
    publicDir: false,
    cacheDir: path.resolve(process.cwd(), 'node_modules/.vite-curu-os'),
    plugins: [
      react(),
      tailwindcss(),
      curuScenariosPlugin({ scenariosDir, isExternal: true }),
    ],
    build: {
      target: 'es2022',
      outDir,
      emptyOutDir: true,
    },
  });

  console.log(`[curu-os] Standalone bundle built at: ${outDir}`);
}

async function runPreview(flags) {
  const outDir = path.resolve(
    process.cwd(),
    typeof flags.out === 'string' ? flags.out : 'dist'
  );
  if (!fs.existsSync(outDir)) {
    console.error(`[curu-os] Build directory not found: ${outDir}. Run "curu-os build" first.`);
    process.exit(1);
  }

  const port = flags.port ? Number.parseInt(String(flags.port), 10) : 4173;
  const host = flags.host === true ? true : typeof flags.host === 'string' ? flags.host : undefined;

  const previewServer = await preview({
    configFile: false,
    root: ENGINE_ROOT,
    build: { outDir },
    preview: {
      port: Number.isNaN(port) ? 4173 : port,
      host,
    },
  });

  previewServer.printUrls();
}

function runCompile(flags) {
  const scenariosDir = resolveConsumerScenariosDir(flags.scenarios);
  assertScenariosDirExists(scenariosDir);

  const compiled = compileAllScenarios(scenariosDir);
  if (compiled.length === 0) {
    console.log(`[curu-os] No .ink files found under ${scenariosDir}.`);
    return;
  }
  for (const item of compiled) {
    const relIn = path.relative(process.cwd(), item.inkPath);
    const relOut = path.relative(process.cwd(), item.outPath);
    console.log(`[curu-os] compiled ${relIn} -> ${relOut}`);
    for (const warn of item.warnings) {
      console.warn(`[curu-os] warning: ${warn}`);
    }
  }
}

function runValidate(flags) {
  const scenariosDir = resolveConsumerScenariosDir(flags.scenarios);
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

function runInit(args, flags) {
  const targetDir = path.resolve(process.cwd(), args[0] || '.');
  const defaultTitle =
    typeof flags.title === 'string' && flags.title.trim()
      ? flags.title.trim()
      : 'My Custom Scenario';
  const scenarioId = slugifyScenarioId(
    typeof flags.id === 'string' ? flags.id : 'my_scenario'
  );
  const engineRef =
    typeof flags.engine === 'string' && flags.engine.trim()
      ? flags.engine.trim()
      : 'github:q-marijn/curu-os#main';
  const projectName = slugifyScenarioId(path.basename(targetDir)).replace(/_/g, '-');

  const created = [];
  const skipped = [];

  writeIfMissing(
    path.join(targetDir, 'package.json'),
    `${JSON.stringify(
      {
        name: projectName || 'curu-scenario-project',
        private: true,
        version: '0.1.0',
        type: 'module',
        scripts: {
          dev: 'curu-os dev',
          validate: 'curu-os validate',
          'compile:ink': 'curu-os compile',
          build: 'curu-os build',
          preview: 'curu-os preview',
          'sync-skill': 'curu-os sync-skill',
        },
        devDependencies: {
          'curu-os': engineRef,
        },
      },
      null,
      2
    )}\n`,
    created,
    skipped
  );

  writeIfMissing(
    path.join(targetDir, 'docker-compose.yml'),
    `services:
  curu-os:
    image: ghcr.io/q-marijn/curu-os:latest
    container_name: ${projectName || 'curu-os-scenario'}
    ports:
      - "8080:80"
    # Optional: set CURU_PASSWORD to require login before accessing scenarios
    # environment:
    #   - CURU_PASSWORD=change-me
    #   - CURU_SESSION_SECRET=replace-with-random-hex
    #   - CURU_SESSION_TTL_HOURS=24
    volumes:
      - ./scenarios:/usr/share/nginx/html/scenarios:ro
    restart: unless-stopped
`,
    created,
    skipped
  );

  writeIfMissing(
    path.join(targetDir, '.gitignore'),
    `node_modules/
dist/
.DS_Store
*.log
scenarios/*/story.json
`,
    created,
    skipped
  );

  writeIfMissing(
    path.join(targetDir, 'scenarios', 'index.json'),
    `${JSON.stringify([{ id: scenarioId, title: defaultTitle }], null, 2)}\n`,
    created,
    skipped
  );

  writeIfMissing(
    path.join(targetDir, 'scenarios', scenarioId, 'scenario.json'),
    `${JSON.stringify(
      {
        id: scenarioId,
        title: defaultTitle,
        subtitle: 'Day 1 · Custom Shift',
        description: 'A custom narrative scenario powered by Curu-OS.',
        startTime: '09:00',
        dayLabel: 'Monday · Day 1',
        storyFile: 'story.ink',
        theme: {
          osName: 'Curu-OS',
          osVersion: 'v0.4',
          wallpaperColor: '#1b2d6b',
        },
        contacts: [
          {
            id: 'system_guide',
            name: 'System Guide',
            role: 'Workspace Assistant',
            email: 'guide@curu-os.local',
            avatarColor: '#059669',
            avatarInitials: 'SG',
            pinned: true,
            status: 'online',
          },
        ],
        files: [
          {
            path: 'docs/welcome.md',
            name: 'Welcome.md',
            folder: 'Documents',
            kind: 'markdown',
            sizeLabel: '1.0 KB',
            unlockedByDefault: false,
          },
        ],
      },
      null,
      2
    )}\n`,
    created,
    skipped
  );

  writeIfMissing(
    path.join(targetDir, 'scenarios', scenarioId, 'story.ink'),
    `-> start

=== start ===
# CHANNEL: chat
# SENDER: system_guide
Welcome to ${defaultTitle}.
# ATTACHMENT: docs/welcome.md
I sent over a starter document — open Welcome.md to verify reactive file hooks work. # EVENT_HOOK: on_file_open:docs/welcome.md => after_welcome
-> DONE

=== after_welcome ===
# CHANNEL: chat
# SENDER: system_guide
# ADVANCE_TIME: 3
Nice — your external scenario repository is wired up and running cleanly.
+ [Continue exploring]
    -> outro

=== outro ===
# CHANNEL: chat
# SENDER: system_guide
Edit scenarios/${scenarioId}/story.ink to start building your story!
-> END
`,
    created,
    skipped
  );

  writeIfMissing(
    path.join(targetDir, 'scenarios', scenarioId, 'docs', 'welcome.md'),
    `# ${defaultTitle}

This scenario lives in its own repository and runs on the **Curu-OS** engine.

- Edit \`scenarios/${scenarioId}/story.ink\` for dialogue and choices.
- Edit \`scenarios/${scenarioId}/scenario.json\` for contacts, files, clock, and optional \`theme\` overrides.
- Run \`npm run validate\` before deploying to verify Ink compilation and asset paths.
`,
    created,
    skipped
  );

  writeIfMissing(
    path.join(targetDir, 'README.md'),
    `# ${defaultTitle}

A standalone scenario repository powered by [Curu-OS](https://github.com/q-marijn/curu-os).

## Local Authoring

\`\`\`bash
npm install
npm run dev
\`\`\`

- Edit scenarios under \`scenarios/${scenarioId}/\`.
- Validate manifests, Ink syntax, and asset paths:
  \`\`\`bash
  npm run validate
  \`\`\`
- Build a standalone static site (\`dist/\`) with only this repo's scenarios:
  \`\`\`bash
  npm run build
  \`\`\`

## Pinning the Engine Version

Update \`package.json\` and \`docker-compose.yml\` to pin a specific Curu-OS release tag (e.g. \`v0.2.0\`):

- \`package.json\`: \`"curu-os": "github:q-marijn/curu-os#v0.2.0"\`
- \`docker-compose.yml\`: \`image: ghcr.io/q-marijn/curu-os:0.2.0\`

After upgrading the \`curu-os\` dependency, refresh Antigravity's authoring skill and workspace constraints rule:

\`\`\`bash
npm install
npm run sync-skill
\`\`\`

## Docker Deployment

1. Copy \`docker-compose.yml\` and \`scenarios/\` onto your Docker host (or deploy directly from this repository).
2. Start the container with \`docker compose up -d\`.
3. Open \`http://<host>:8080\`. Edits in \`scenarios/\` take effect on browser refresh.
`,
    created,
    skipped
  );

  const synced = syncAgentFiles(targetDir, { overwrite: false });
  created.push(...synced.created);
  skipped.push(...synced.skipped);

  console.log(`[curu-os] Initialized scenario project in ${targetDir}`);
  console.log(`  Created ${created.length} file(s)${skipped.length ? `, skipped ${skipped.length} existing file(s)` : ''}.`);
  console.log('\nNext steps:');
  if (targetDir !== process.cwd()) {
    console.log(`  cd ${path.relative(process.cwd(), targetDir) || '.'}`);
  }
  console.log('  npm install');
  console.log('  npm run dev');
}

function runSyncSkill(args) {
  const targetDir = path.resolve(process.cwd(), args[0] || '.');
  const { version, created, updated } = syncAgentFiles(targetDir, {
    overwrite: true,
  });

  console.log(
    `[curu-os] Synced Antigravity skill and constraints rule for engine v${version} in ${targetDir}:`
  );
  for (const file of [...created, ...updated]) {
    console.log(`  - ${path.relative(targetDir, file)}`);
  }
}

async function main() {
  const { command, args, flags } = parseCliArgs(process.argv.slice(2));

  if (flags.version && !command) {
    console.log(`curu-os v${readEngineVersion()}`);
    return;
  }

  if (!command || flags.help) {
    printHelp();
    return;
  }

  switch (command) {
    case 'dev':
      await runDev(flags);
      break;
    case 'build':
      await runBuild(flags);
      break;
    case 'preview':
      await runPreview(flags);
      break;
    case 'compile':
      runCompile(flags);
      break;
    case 'validate':
      runValidate(flags);
      break;
    case 'init':
      runInit(args, flags);
      break;
    case 'sync-skill':
      runSyncSkill(args);
      break;
    default:
      console.error(`[curu-os] Unknown command: "${command}"`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('[curu-os] Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
