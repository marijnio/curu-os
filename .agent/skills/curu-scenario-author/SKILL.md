---
name: curu-scenario-author
description: Author, extend, and validate self-contained Curu-OS narrative scenario packs using Ink (story.ink), scenario.json, Markdown docs, and media assets without modifying React UI code.
---

# Curu-OS Scenario Authoring Guide

Curu-OS separates its React desktop runtime from self-contained **Scenario Packs** located either in an external scenario repository at `scenarios/<scenario_id>/` (recommended for separate projects), inside the engine repo at `public/scenarios/<scenario_id>/`, or at `./scenarios/<scenario_id>/` when mounted into a Docker container.

## 1. Scenario Directory Layout

```text
scenarios/                      # (or public/scenarios/ inside the curu-os engine repo)
├── index.json                  # Registry array listing every selectable scenario
└── <scenario_id>/
    ├── scenario.json           # Contacts, initial clock, metadata, optional theme, and file catalog
    ├── story.ink               # Branching Ink narrative script (compiled to story.json)
    ├── story.json              # Compiled Ink JSON (auto-generated on dev/build/compile)
    ├── docs/                   # Markdown documents (*.md)
    └── media/                  # Images (*.png, *.jpg, *.svg, *.webp) and Audio (*.mp3, *.ogg, *.wav)
```

Register every new scenario in `scenarios/index.json` (or `public/scenarios/index.json` in the engine repo):

```json
[
  { "id": "demo", "title": "First Morning — Meridian Archive" },
  { "id": "your_id", "title": "Your Scenario Title" }
]
```

---

## 2. `scenario.json` Schema

```json
{
  "id": "demo",
  "title": "First Morning — Meridian Archive",
  "subtitle": "Day 1 Shift · Archive Operations",
  "description": "Short summary shown in Scenario Selector.",
  "locale": "en",
  "startTime": "09:00",
  "dayLabel": "Monday · Day 1",
  "storyFile": "story.ink",
  "playerPrompt": {
    "enabled": true,
    "variableName": "player_name",
    "label": "Analyst Name",
    "placeholder": "e.g. Alex Mercer",
    "helperText": "Colleagues and shift briefings will address you by this name.",
    "required": true
  },
  "theme": {
    "osName": "Curu-OS",
    "osVersion": "v0.1",
    "windowTitle": "First Morning — Meridian Archive",
    "wallpaperColor": "#1b2d6b",
    "wallpaperImage": "media/wallpaper.jpg"
  },
  "contacts": [
    {
      "id": "system_guide",
      "name": "System Guide",
      "role": "Curu-OS Onboarding Assistant",
      "email": "guide@curu-os.local",
      "avatarColor": "#059669",
      "avatarInitials": "SG",
      "pinned": true,
      "status": "online"
    }
  ],
  "files": [
    {
      "path": "docs/day1_briefing.md",
      "name": "Day1_Briefing.md",
      "folder": "Documents",
      "kind": "markdown",
      "sizeLabel": "2.4 KB",
      "unlockedByDefault": false
    }
  ],
  "initialNotes": [
    {
      "id": "shift_checklist",
      "title": "Shift Checklist — {{player_name}}",
      "content": "- Review incoming messages\n- Verify access log timestamps",
      "updatedAt": "09:00"
    }
  ]
}
```

### Field Notes
- `locale` (optional): UI language for OS chrome, apps, notifications, and Scenario Selector (`"en"` | `"nl"`, defaults to `"en"`). Note that internal `files[].folder` enum values in `scenario.json` must remain `"Documents" | "Images" | "Voice Notes" | "Downloads"` even when `locale` is `"nl"`.
- `startTime`: 24-hour `"HH:MM"` string (e.g. `"09:00"`).
- `playerPrompt` (optional): Prompts the player for a pre-start variable (typically their name) before launching a fresh scenario:
  - `enabled`: Boolean (defaults to `true` when `playerPrompt` is present).
  - `variableName`: Ink & template variable identifier (defaults to `"player_name"`). Declare `VAR player_name = "Default"` in `story.ink` to use `{player_name}` in dialogue, choices, and `# TAG` directives.
  - `label`, `placeholder`, `helperText`, `defaultValue`: Form UI copy.
  - `required`: Boolean (defaults to `true`).
  - **Markdown & Template Interpolation:** Use `{{player_name}}` (or `{{any_ink_global}}`) inside `docs/*.md`, voice note transcripts, `initialNotes`, `# NOTE_ADD`, and manifest labels (`dayLabel`).
- `theme` (optional): Customize OS branding and desktop background without writing React code:
  - `osName`: Start Menu & taskbar branding (defaults to `"Curu-OS"`).
  - `osVersion`: Start Menu version badge (defaults to `"v0.1"`).
  - `windowTitle`: Browser tab `<title>` override (defaults to `"<title> — <osName>"`).
  - `wallpaperColor`: CSS background color for the desktop (defaults to `"#1b2d6b"`).
  - `wallpaperImage`: Scenario-relative path under the scenario directory (e.g. `"media/wallpaper.jpg"`).
- `contacts[].id`: Must match `# SENDER: <contact_id>` tags in `story.ink`.
- `contacts[].pinned`: Set `true` on `"system_guide"` to keep it pinned at the top of Messages.
- `contacts[].status`: `"online" | "away" | "offline"`.
- `contacts[].hiddenByDefault`: Set `true` to hide a contact in Messages until unlocked via `# CONTACT_UNLOCK: <id>` or an incoming message.
- `files[].folder`: `"Documents" | "Images" | "Voice Notes" | "Downloads"`.
- `files[].kind`: `"markdown" | "image" | "audio" | "text"`.
- `files[].unlockedByDefault`: Set `true` for starting workspace files; otherwise leave `false` and unlock dynamically with `# ATTACHMENT`, `# VOICE_NOTE`, or `# FILE_UNLOCK`.
- `initialNotes` (optional): Pre-populates the **Notes** app when starting a fresh scenario (falls back to a blank `"Shift Notes"` entry when omitted or empty):
  - `id` (optional): Stable note ID used by `# EVENT_HOOK: on_note_open:<id>` (auto-generated as `note_init_<n>` if omitted).
  - `title` & `content`: Strings supporting `{{template}}` variable interpolation.
  - `updatedAt` (optional): Timestamp label (defaults to `startTime`).

---

## 3. Ink Tag Bridge (`#` Stage Directions)

Curu-OS interprets Ink `#` tags attached to story lines and choices as desktop OS events.

| Tag Syntax | Behavior |
| :--- | :--- |
| `# CHANNEL: chat \| email` | Sets active delivery channel (`chat` or `email`) for this line and subsequent lines until changed. |
| `# SENDER: <contact_id>` | Sets active contact ID for chat bubbles or email sender. |
| `# SUBJECT: <text>` | Starts a new email when `# CHANNEL: email` is active. Subsequent email lines without `# SUBJECT:` append paragraphs to the same email. |
| `# VOICE_NOTE: <path> \| duration: <mm:ss> \| transcript: <text>` | Sends a playable voice message bubble in Messages and registers the file in `Voice Notes` and `Downloads`. Escape `\|` inside `.ink` files (`\\|` in source) because `|` is an Ink delimiter. If the audio file is absent, Curu-OS plays a synthesized cadence fallback automatically. |
| `# ATTACHMENT: <path>` | Attaches a clickable file card to the current chat message or email and registers it in File Explorer (`Unified Media Routing`). |
| `# FILE_UNLOCK: <path>` | Unlocks a file directly in File Explorer (optional `\| folder: Documents \| name: Custom.md`). |
| `# NOTE_ADD: <title> \| content: <text>` | Appends a new note in **Notes** stamped with the current clock, shows a toast notification, and increments the Notes unread badge until opened. Supports optional `\| id: <note_id>`, `\\|` escaping in `.ink`, `\n` line breaks, and `{{template}}` vars. |
| `# ADVANCE_TIME: <minutes>` | Advances the in-world taskbar clock by `<minutes>` integer minutes. |
| `# SET_TIME: <HH:MM>` | Sets the in-world taskbar clock directly to 24-hour `<HH:MM>` (e.g., `14:30`). |
| `# SET_DAY: <label>` | Updates the current day/phase label shown in the System Tray and Notifications header (e.g., `Phase 2 · Escalation`). |
| `# CONTACT_UNLOCK: <contact_id>` | Reveals a contact marked `hiddenByDefault: true` in Messages. |
| `# CONTACT_STATUS: <contact_id> \| online\|away\|offline` | Updates a contact's presence indicator in Messages (escape `\|` as `\\|` in `.ink` source). |
| `# EVENT_HOOK: on_file_open:<path> => <knot>` | Fires when `<path>` is opened in File Explorer (`=> <knot>` jumps to `<knot>`; omit `=> <knot>` to pause and resume `Continue()`). Use `=>` instead of `->` in `.ink` files. |
| `# EVENT_HOOK: on_audio_play:<path> [=> <knot>]` | Fires when `<path>` starts playing in Messages or File Explorer (works with both real audio and simulated fallback). |
| `# EVENT_HOOK: on_email_read:<matcher> [=> <knot>]` | Fires when a matching email is opened in Mail (`sender:<id>`, `subject:<text>`, or bare `<id_or_subject>`). |
| `# EVENT_HOOK: on_note_open:<id_or_title> [=> <knot>]` | Fires when a matching note is selected in Notes (`id:<note_id>`, `title:<text>`, or bare `<id_or_title>`). |
| `# INPUT: <ink_var> \| placeholder: <hint> [\| button: <label>] [\| target: <contact_id>] => <knot>` | Pauses the story and shows a free-text input box in the targeted contact's Messages thread (defaults `target` to active `# SENDER` and `button` to localized `"Send"`). Escape `\|` as `\\|` in `.ink` source. |
| `# FLAG_EMAIL` | Marks the active email as flagged in Mail. |
| `# TYPING_DELAY: <ms>` | Overrides typing indicator duration in ms for the current chat line. |
| `# DELAY: <ms \| Ns>` | Pauses delivery for the specified duration (milliseconds or seconds, e.g. `4000` or `4s`) before applying this line's email, chat, file, note, or time update. Use `0` to skip default email arrival delay. |
| `# SILENT` | Placed on an Ink choice to avoid echoing the choice text as an outgoing player chat bubble. |

### Multi-File Ink Scripts (`INCLUDE`)
Large scenarios can split their narrative across multiple `.ink` files inside the scenario folder using `INCLUDE chapters/phase2.ink` in `story.ink` (supported by both the CLI compiler and browser live-compilation).

---

## 4. Authoring Patterns & Best Practices

### Pacing Multi-Channel Beats
Always declare `# CHANNEL:` and `# SENDER:` at the start of a knot or whenever switching between **Messages** and **Mail**:

```ink
=== react_to_doc ===
# CHANNEL: chat
# SENDER: system_guide
# ADVANCE_TIME: 5
Notice that timestamp on line 4? Check your inbox.

# CHANNEL: email
# SENDER: elena_vance
# SUBJECT: Quick check-in before the 9:30 sync
# ATTACHMENT: docs/access_log_extract.md
# FLAG_EMAIL
Take a look at the attached extract and let me know how you want to handle it.

+ [Escalate formally to Security.]
    -> branch_escalate
+ [Ask Elena privately first.]
    -> branch_quiet
```

### Choice Routing
- Choices inherit the most recent `# CHANNEL` and `# SENDER` (for email, the most recent email created in that beat).
- You can override a specific choice's destination using tags on the choice line itself:
  `+ # CHANNEL: chat # SENDER: system_guide [Ping System Guide instead]`

### Reactive File Hooks
Attach `# EVENT_HOOK:` on a spoken line and use `-> DONE` right after so the story waits cleanly for the player to inspect the file:

```ink
# ATTACHMENT: docs/day1_briefing.md
Open the briefing to proceed. # EVENT_HOOK: on_file_open:docs/day1_briefing.md => after_briefing_opened
-> DONE
```

### Free-Text Chat Input (`# INPUT:`)
Use `# INPUT:` when you want the player to type a genuine observation or short message in **Messages** instead of picking from multiple-choice buttons:

```ink
VAR observation_report = ""

=== ask_observation ===
# CHANNEL: chat
# SENDER: jan_smit
Wat zie je op de foto in de map Afbeeldingen? Beschrijf kort wat opvalt.
# INPUT: observation_report \| placeholder: Beschrijf je observatie... \| button: Versturen \| target: jan_smit => after_observation
-> DONE

=== after_observation ===
# CHANNEL: chat
# SENDER: jan_smit
Helder, dank je wel voor je bericht ("{observation_report}"). Ik log het direct.
-> END
```

- `target` defaults to the active `# SENDER` when omitted, and `button` defaults to `"Send"` (or `"Versturen"` when `locale: "nl"`).
- Submitting appends the player's message as an outgoing chat bubble, writes the text to `VAR <ink_var>` (when declared in `.ink`) and template variables (`{var}` in Ink / `{{var}}` in Markdown/notes), logs the full submission to the **Director Inspector** Event Log (`input`), and jumps to `=> <knot>`.
- If the player is viewing another contact thread when `# INPUT:` activates, Messages highlights the target thread in the sidebar and shows a clickable footer jump button.

### Inline Formatting & Click-to-Copy Chips
Chat messages in **Messages** (both incoming and outgoing) and email body paragraphs in **Mail** support lightweight, safe inline Markdown without raw HTML:
- `**bold**` renders as **bold** emphasis (useful for step headings or warnings).
- `*italic*` renders as *italic* emphasis.
- `` `value` `` renders as an interactive **click-to-copy** monospace chip that copies the literal text inside the backticks to the player's clipboard and shows a brief `"Copied"` / `"Gekopieerd"` confirmation.

This is especially helpful when Curu-OS acts as a companion workbench alongside an external application, letting players copy exact values with one click:

```ink
# CHANNEL: chat
# SENDER: jan_smit
**Stap 1:** Open zaak `DH1` op adres `Ringbaan Noord 97, Tilburg` en maak taak `camera spotten` aan.
```

Plain text without Markdown delimiters and line breaks render as-is, and Ink `{variable}` interpolation runs before inline formatting so interpolated values inside `` `{case_id}` `` are also copyable.

---

## 5. Validation Workflow

After editing or creating a scenario pack:
1. Run `npm run validate` (or `curu-os validate`) to verify `index.json`, `scenario.json` schemas, Ink compilation, `# SENDER` IDs, and asset paths.
2. Run `npm run compile:ink` if you only want to compile `story.ink` into `story.json` with zero errors.
3. Run `npm run dev` and inspect the live state in **Start Menu → Director / Debug Inspector** (`Ctrl/Cmd + Shift + D`).
