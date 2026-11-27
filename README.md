# Curu-OS

**Curu-OS** is a browser-based narrative simulation engine disguised as an everyday workplace desktop environment. Stories run through diegetic workplace tools — **Messages**, **Mail**, and **File Explorer** — powered by **Ink (`inkjs`)**, **Markdown**, **images**, and **audio**.

## Tech Stack

- **Frontend:** Vite, React 19, TypeScript, Tailwind CSS v4
- **State & Narrative:** Zustand, `inkjs` (with live `.ink` compilation & `.json` fallback), `react-markdown`, Lucide React
- **Deployment:** Multi-stage Docker (`node:20-alpine` → `nginx:alpine`) published as a multi-arch container image (`linux/amd64`, `linux/arm64`)

---

## Local Development

```bash
npm install
npm run dev
```

- Edit scenario files under `public/scenarios/<id>/` (e.g. `story.ink`, `scenario.json`, `docs/*.md`).
- Vite automatically compiles `.ink` files on startup and live-reloads on changes.
- Press **`Ctrl + Shift + D`** (or **`Cmd + Shift + D`**) or open **Curu-OS → Director / Debug Inspector** to inspect Ink variables, active choices, pending file hooks, and event logs.

### Useful Scripts

```bash
npm run compile:ink   # Compile public/scenarios/*/story.ink -> story.json
npm run validate      # Validate manifests, Ink syntax, sender IDs, and asset paths
npm run typecheck     # Run TypeScript type check
npm run build         # Compile Ink stories + typecheck + production bundle
```

### Side-by-Side External Scenario Development

If you are iterating on the engine and an external scenario pack at the same time, point `CURU_SCENARIOS_DIR` at your external `scenarios/` folder:

```bash
CURU_SCENARIOS_DIR=../my-scenario/scenarios npm run dev
CURU_SCENARIOS_DIR=../my-scenario/scenarios npm run validate
```

---

## Developing Scenarios in a Separate Repository

You can keep `curu-os` clean as an engine repository and author each narrative project in its own standalone repository containing only scenario content (`scenarios/`), a minimal `package.json`, and a `docker-compose.yml`.

### 1. Scaffold a New Scenario Repository

From this repository (or using `npx`):

```bash
node bin/curu-os.mjs init ../my-custom-scenario --id my_story --title "My Custom Story"
cd ../my-custom-scenario
npm install
npm run dev
```

Or initialize directly from GitHub without cloning `curu-os`:

```bash
npx github:q-marijn/curu-os#main init my-custom-scenario --id my_story --title "My Custom Story"
cd my-custom-scenario
npm install
npm run dev
```

Your scenario repository stays pure content:

```text
my-custom-scenario/
├── .agent/skills/curu-scenario-author/SKILL.md
├── docker-compose.yml          # Runs ghcr.io/q-marijn/curu-os + ./scenarios mount
├── package.json                # Depends on github:q-marijn/curu-os#<tag>
└── scenarios/
    ├── index.json
    └── my_story/
        ├── scenario.json       # Contacts, files, clock, optional theme
        ├── story.ink
        └── docs/
```

### 2. Local Authoring & Validation

```bash
npm run dev        # Live Ink compile + hot reload serving ./scenarios
npm run validate   # Check index.json, scenario.json, Ink syntax, and asset paths
npm run build      # Build standalone static bundle into ./dist (without demo)
```

### 3. Pinning Engine Versions

In your scenario repository, pin both `package.json` and `docker-compose.yml` to a `curu-os` release tag (for example `v0.2.0`):

- `package.json`: `"curu-os": "github:q-marijn/curu-os#v0.2.0"`
- `docker-compose.yml`: `image: ghcr.io/q-marijn/curu-os:0.2.0`

### 4. Containerized Deployment from a Scenario Repository

Every push or `v*` tag to `curu-os` publishes a multi-arch (`linux/amd64`, `linux/arm64`) image to `ghcr.io/q-marijn/curu-os`. To deploy a standalone scenario repo with Docker, copy the scenario repo's `docker-compose.yml` and `scenarios/` directory onto your Docker host and run `docker compose up -d` — no `curu-os` source clone or Node build needed on the host.

---

## Authoring Scenarios

See [SKILL.md](.agent/skills/curu-scenario-author/SKILL.md) for the complete `scenario.json` schema and `# TAG` directive reference (`CHANNEL`, `SENDER`, `SUBJECT`, `VOICE_NOTE`, `ATTACHMENT`, `FILE_UNLOCK`, `ADVANCE_TIME`, `EVENT_HOOK`, `FLAG_EMAIL`).

---

## Docker Deployment

Curu-OS is packaged so you can edit `.ink` scripts, Markdown documents, images, and `.mp3`/`.ogg` voice notes in a volume-mounted `./scenarios` directory without rebuilding the container.

1. Seed the external `./scenarios` directory from the included `public/scenarios` pack so the volume mount has the starter `demo` scenario and `index.json`:
   ```bash
   cp -r public/scenarios ./scenarios
   ```
2. Build and start the container using the included **`docker-compose.yml`**:
   ```bash
   docker compose up -d
   ```
3. Open `http://<host>:8080`.
4. Any edits you make inside `./scenarios/` (including `story.ink`, `docs/*.md`, or adding new scenario folders to `scenarios/index.json`) take effect on browser refresh because Curu-OS compiles `story.ink` in-browser and Nginx serves `/scenarios/` with `no-cache`.
