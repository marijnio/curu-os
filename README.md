# Curu-OS

**Curu-OS** is a browser-based narrative simulation engine disguised as an everyday workplace desktop environment. Stories run through diegetic workplace tools — **Messages**, **Mail**, and **File Explorer** — powered by **Ink (`inkjs`)**, **Markdown**, **images**, and **audio**.

## Tech Stack

- **Frontend:** Vite, React 19, TypeScript, Tailwind CSS v4
- **State & Narrative:** Zustand, `inkjs` (with live `.ink` compilation & `.json` fallback), `react-markdown`, Lucide React
- **Deployment:** Multi-stage Docker (`node:20-alpine` → `nginx:alpine`) ready for Synology Container Manager

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
npm run typecheck     # Run TypeScript type check
npm run build         # Compile Ink stories + typecheck + production bundle
```

---

## Authoring Scenarios

See [SKILL.md](.agent/skills/curu-scenario-author/SKILL.md) for the complete `scenario.json` schema and `# TAG` directive reference (`CHANNEL`, `SENDER`, `SUBJECT`, `VOICE_NOTE`, `ATTACHMENT`, `FILE_UNLOCK`, `ADVANCE_TIME`, `EVENT_HOOK`, `FLAG_EMAIL`).

---

## Synology DiskStation Deployment (Container Manager)

Curu-OS is packaged so you can edit `.ink` scripts, Markdown documents, images, and `.mp3`/`.ogg` voice notes directly on your NAS without rebuilding the container.

1. Copy the repository onto a Synology shared folder (for example `/volume1/docker/curu-os`).
2. Seed the external `./scenarios` directory from the included `public/scenarios` pack so the volume mount has the starter `demo` scenario and `index.json`:
   ```bash
   cp -r public/scenarios ./scenarios
   ```
3. Open **Container Manager** on DSM → go to the **Project** tab → click **Create**.
4. Point the Project path to `/volume1/docker/curu-os` and select the existing **`docker-compose.yml`**.
5. Build and start the project. Curu-OS will be available at:
   `http://<synology-ip>:8080`
6. Any edits you make inside `/volume1/docker/curu-os/scenarios/` (including `story.ink`, `docs/*.md`, or adding new scenario folders to `scenarios/index.json`) take effect on browser refresh because Curu-OS compiles `story.ink` in-browser and Nginx serves `/scenarios/` with `no-cache`.
