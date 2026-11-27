import { create } from 'zustand';
import type { Story } from 'inkjs/full';
import type {
  ActiveChoice,
  Channel,
  ChatMessage,
  DebugLogEntry,
  EmailMessage,
  EventHook,
  EventHookType,
} from '../types/narrative';
import type {
  AppId,
  NoteItem,
  ToastNotification,
  VirtualFile,
  WindowState,
} from '../types/os';
import type { Contact, FolderName, ScenarioManifest } from '../types/scenario';
import {
  fetchAuthStatus,
  submitLogin,
  submitLogout,
  type LoginResult,
} from '../engine/authClient';
import {
  AuthRequiredError,
  fetchScenarioIndex,
  loadScenarioBundle,
  type ScenarioSummary,
} from '../engine/scenarioLoader';
import { playNotificationChime } from '../engine/soundEffects';
import {
  formatClock24,
  inferFileMeta,
  normalizeScenarioPath,
  parseClockMinutes,
  parseInkTags,
} from '../engine/tagParser';
import {
  interpolateTemplate,
  normalizePlayerPrompt,
  sanitizePlayerInput,
} from '../engine/templateVars';

const STORAGE_PREFIX = 'curu-os:v2:';
const ACTIVE_SCENARIO_KEY = 'curu-os:v2:active-scenario';
const CHECKPOINTS_PREFIX = 'curu-os:v2:checkpoints:';

export type AppPhase = 'booting' | 'login' | 'select_scenario' | 'desktop';

export interface SavedScenarioMeta {
  clockStr: string;
  dayLabel: string;
  playerName?: string;
}

let storyInstance: Story | null = null;
let sessionToken = 0;
let initStarted = false;
let queueRunning = false;
let pausedByContinueHook = false;

type DispatchBeat =
  | { kind: 'advance_time'; minutes: number }
  | { kind: 'set_time'; minutes: number }
  | { kind: 'set_day'; dayLabel: string }
  | { kind: 'contact_unlock'; contactId: string }
  | { kind: 'contact_status'; contactId: string; status: 'online' | 'away' | 'offline' }
  | {
      kind: 'unlock_file';
      path: string;
      folder?: FolderName;
      name?: string;
      receivedVia?: { channel: Channel; senderId: string };
      notify?: boolean;
    }
  | { kind: 'chat'; message: ChatMessage; typingDelayMs: number }
  | {
      kind: 'email_line';
      senderId: string;
      subject?: string;
      line: string;
      attachments: string[];
      flagEmail: boolean;
    }
  | { kind: 'register_hook'; hook: EventHook }
  | { kind: 'set_choices'; choices: ActiveChoice[] };

const dispatchQueue: DispatchBeat[] = [];

export interface PersistedSnapshot {
  inkStateJson: string;
  clockMinutes: number;
  dayLabel: string;
  contacts: Contact[];
  unlockedContactIds: string[];
  activeChannel: Channel;
  activeSenderId: string;
  activeEmailDraftId: string | null;
  chatMessages: ChatMessage[];
  unreadChatCounts: Record<string, number>;
  emails: EmailMessage[];
  files: VirtualFile[];
  notes: NoteItem[];
  activeChoices: ActiveChoice[];
  pendingHooks: EventHook[];
  pausedByContinueHook: boolean;
  playerVariables?: Record<string, string>;
}

export function getSavedScenarioMeta(
  scenarioId: string,
  variableName = 'player_name'
): SavedScenarioMeta | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${scenarioId}`);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<PersistedSnapshot>;
    if (typeof saved.inkStateJson !== 'string') return null;
    const clockMinutes =
      typeof saved.clockMinutes === 'number' && Number.isFinite(saved.clockMinutes)
        ? saved.clockMinutes
        : 9 * 60;
    const dayLabel =
      typeof saved.dayLabel === 'string' && saved.dayLabel.trim()
        ? saved.dayLabel
        : 'Day 1';
    const playerName =
      saved.playerVariables && typeof saved.playerVariables[variableName] === 'string'
        ? saved.playerVariables[variableName].trim() || undefined
        : undefined;
    return {
      clockStr: formatClock24(clockMinutes),
      dayLabel,
      playerName,
    };
  } catch {
    return null;
  }
}

export interface CheckpointRecord {
  id: string;
  name: string;
  savedAt: string;
  clockStr: string;
  dayLabel: string;
  snapshot: PersistedSnapshot;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function createDefaultWindows(): Record<AppId, WindowState> {
  return {
    messages: {
      id: 'messages',
      title: 'Messages',
      isOpen: true,
      isMinimized: false,
      isMaximized: false,
      zIndex: 12,
      position: { x: 96, y: 40 },
      size: { width: 820, height: 540 },
    },
    mail: {
      id: 'mail',
      title: 'Mail',
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 11,
      position: { x: 148, y: 64 },
      size: { width: 860, height: 550 },
    },
    explorer: {
      id: 'explorer',
      title: 'File Explorer',
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 10,
      position: { x: 204, y: 84 },
      size: { width: 900, height: 560 },
    },
    notes: {
      id: 'notes',
      title: 'Notes',
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 11,
      position: { x: 260, y: 96 },
      size: { width: 680, height: 480 },
    },
    director: {
      id: 'director',
      title: 'Director Inspector',
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 13,
      position: { x: 300, y: 44 },
      size: { width: 720, height: 540 },
    },
  };
}

function loadCheckpointsFromStorage(scenarioId: string): CheckpointRecord[] {
  try {
    const raw = localStorage.getItem(`${CHECKPOINTS_PREFIX}${scenarioId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CheckpointRecord[]) : [];
  } catch {
    return [];
  }
}

function persistCheckpointsToStorage(
  scenarioId: string,
  checkpoints: CheckpointRecord[]
): void {
  try {
    localStorage.setItem(
      `${CHECKPOINTS_PREFIX}${scenarioId}`,
      JSON.stringify(checkpoints)
    );
  } catch {
    // Ignore storage quota errors gracefully
  }
}

function buildInitialFiles(manifest: ScenarioManifest, startTime: string): VirtualFile[] {
  return manifest.files
    .filter((f) => f.unlockedByDefault)
    .map((entry) => {
      const normalized = normalizeScenarioPath(entry.path);
      return {
        ...entry,
        path: normalized,
        id: normalized,
        unlockedAt: startTime,
        opened: false,
      };
    });
}

function matchesEmailHookTarget(email: EmailMessage, target: string): boolean {
  const trimmed = target.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('sender:')) {
    const expectedSender = lower.slice('sender:'.length).trim();
    return email.senderId.toLowerCase() === expectedSender;
  }
  if (lower.startsWith('subject:')) {
    const expectedSub = lower.slice('subject:'.length).trim();
    return email.subject.toLowerCase().includes(expectedSub);
  }
  return (
    email.senderId.toLowerCase() === lower ||
    email.subject.toLowerCase().includes(lower)
  );
}

export interface OsState {
  // App lifecycle & auth
  appPhase: AppPhase;
  authEnabled: boolean;
  isAuthenticated: boolean;
  authError: string | null;
  pendingScenarioId: string | null;
  isLoading: boolean;
  loadError: string | null;
  availableScenarios: ScenarioSummary[];
  scenarioId: string;
  manifest: ScenarioManifest | null;
  compiledFrom: 'ink' | 'json' | null;
  compilerWarnings: string[];
  playerVariables: Record<string, string>;
  templateVars: Record<string, string>;

  // Desktop / Windows
  windows: Record<AppId, WindowState>;
  focusedApp: AppId | null;
  nextZIndex: number;
  startMenuOpen: boolean;
  notificationsOpen: boolean;
  toasts: ToastNotification[];
  notifications: ToastNotification[];
  muted: boolean;
  instantTyping: boolean;

  // In-world clock & day/phase
  clockMinutes: number;
  dayLabel: string;

  // Contacts & Messages
  contacts: Contact[];
  unlockedContactIds: string[];
  activeContactId: string | null;
  chatMessages: ChatMessage[];
  unreadChatCounts: Record<string, number>;
  typingContactId: string | null;

  // Mail
  emails: EmailMessage[];
  activeEmailId: string | null;

  // File Explorer
  files: VirtualFile[];
  selectedFolder: FolderName;
  selectedFileId: string | null;

  // Notes / Incident Log
  notes: NoteItem[];
  activeNoteId: string | null;

  // Narrative routing state
  activeChannel: Channel;
  activeSenderId: string;
  activeEmailDraftId: string | null;
  activeChoices: ActiveChoice[];
  pendingHooks: EventHook[];
  debugLogs: DebugLogEntry[];
  checkpoints: CheckpointRecord[];

  // Actions
  initApp: () => Promise<void>;
  login: (password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  openScenarioSelector: (preselectId?: string) => void;
  loadScenario: (
    scenarioId: string,
    opts?: { forceReset?: boolean; playerVariables?: Record<string, string> }
  ) => Promise<void>;
  resetProgress: (opts?: { returnToSetup?: boolean }) => Promise<void>;

  // Window actions
  openApp: (appId: AppId) => void;
  closeApp: (appId: AppId) => void;
  minimizeApp: (appId: AppId) => void;
  toggleMaximizeApp: (appId: AppId) => void;
  focusApp: (appId: AppId) => void;
  moveWindow: (appId: AppId, position: { x: number; y: number }) => void;
  resizeWindow: (
    appId: AppId,
    size: { width: number; height: number },
    position?: { x: number; y: number }
  ) => void;
  toggleStartMenu: (open?: boolean) => void;
  toggleNotifications: (open?: boolean) => void;
  dismissToast: (id: string) => void;
  markAllNotificationsRead: () => void;
  clickNotification: (notification: ToastNotification) => void;
  toggleMuted: () => void;
  toggleInstantTyping: () => void;

  // App interactions
  selectContact: (contactId: string) => void;
  selectEmail: (emailId: string) => void;
  toggleEmailFlag: (emailId: string) => void;
  selectFolder: (folder: FolderName) => void;
  selectFile: (fileId: string) => void;
  openFileInExplorer: (filePath: string) => void;
  onFileOpened: (filePath: string) => void;
  onAudioPlayed: (filePath: string) => void;
  selectChoice: (choiceIndex: number) => void;
  forceTriggerHook: (hookId: string) => void;

  // Notes actions
  selectNote: (noteId: string) => void;
  createNote: (title?: string) => void;
  updateNote: (noteId: string, patch: { title?: string; content?: string }) => void;
  deleteNote: (noteId: string) => void;

  // Director & Checkpoint helpers
  getInkVariables: () => Array<{ name: string; value: string }>;
  getInkKnots: () => string[];
  jumpToKnot: (knotName: string) => void;
  setInkVariable: (name: string, rawValue: string) => void;
  saveCheckpoint: (name?: string) => void;
  restoreCheckpoint: (checkpointId: string) => boolean;
  deleteCheckpoint: (checkpointId: string) => void;
  exportSaveJson: () => string;
  importSaveJson: (rawJson: string) => { ok: boolean; error?: string };
}

export const useOsStore = create<OsState>((set, get) => {
  function appendDebugLog(
    type: DebugLogEntry['type'],
    summary: string,
    detail?: unknown
  ) {
    const time = formatClock24(get().clockMinutes);
    set((state) => ({
      debugLogs: [
        ...state.debugLogs.slice(-199),
        { id: makeId('log'), time, type, summary, detail },
      ],
    }));
  }

  function pushNotification(
    appId: AppId,
    title: string,
    body: string,
    actionTarget?: ToastNotification['actionTarget']
  ) {
    const timestamp = formatClock24(get().clockMinutes);
    const item: ToastNotification = {
      id: makeId('notif'),
      appId,
      title,
      body,
      timestamp,
      read: false,
      actionTarget,
    };

    if (!get().muted) {
      playNotificationChime(
        appId === 'mail' ? 'email' : appId === 'explorer' ? 'file' : 'chat'
      );
    }

    set((state) => ({
      notifications: [item, ...state.notifications].slice(0, 30),
      toasts: [...state.toasts, item].slice(-3),
    }));

    const capturedToken = sessionToken;
    window.setTimeout(() => {
      if (capturedToken !== sessionToken) return;
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== item.id),
      }));
    }, 4500);
  }

  function upsertFile(
    rawPath: string,
    opts?: {
      folder?: FolderName;
      name?: string;
      receivedVia?: { channel: Channel; senderId: string };
      notify?: boolean;
    }
  ): VirtualFile {
    const normalized = normalizeScenarioPath(rawPath);
    const state = get();
    const existing = state.files.find((f) => f.id === normalized);
    const catalogEntry = state.manifest?.files.find(
      (f) => normalizeScenarioPath(f.path) === normalized
    );
    const inferred = inferFileMeta(normalized);
    const clockStr = formatClock24(state.clockMinutes);

    if (existing) {
      if (opts?.receivedVia && !existing.receivedVia) {
        const updated: VirtualFile = {
          ...existing,
          receivedVia: opts.receivedVia,
        };
        set((s) => ({
          files: s.files.map((f) => (f.id === normalized ? updated : f)),
        }));
        return updated;
      }
      return existing;
    }

    const created: VirtualFile = {
      id: normalized,
      path: normalized,
      name: opts?.name ?? catalogEntry?.name ?? inferred.name,
      folder: opts?.folder ?? catalogEntry?.folder ?? inferred.folder,
      kind: catalogEntry?.kind ?? inferred.kind,
      sizeLabel: catalogEntry?.sizeLabel,
      duration: catalogEntry?.duration,
      transcript: catalogEntry?.transcript,
      unlockedAt: clockStr,
      opened: false,
      receivedVia: opts?.receivedVia,
    };

    set((s) => ({
      files: [...s.files, created],
    }));

    if (opts?.notify) {
      pushNotification(
        'explorer',
        'New File Available',
        `${created.name} added to ${created.folder}`,
        { filePath: created.id }
      );
    }

    return created;
  }

  function collectTemplateVars(
    playerVariables: Record<string, string>
  ): Record<string, string> {
    const vars: Record<string, string> = { ...playerVariables };
    if (!storyInstance) return vars;
    try {
      const vs = storyInstance.variablesState as unknown as {
        _globalVariables?: Map<string, unknown>;
        $: (name: string) => unknown;
      };
      const map = vs._globalVariables;
      if (!map) return vars;
      for (const key of map.keys()) {
        const val = storyInstance.variablesState.$(key);
        if (typeof val === 'string') {
          vars[key] = val;
        } else if (typeof val === 'number' || typeof val === 'boolean') {
          vars[key] = String(val);
        }
      }
    } catch {
      // Ignore variable inspection errors gracefully
    }
    return vars;
  }

  function buildCurrentSnapshot(): PersistedSnapshot | null {
    const state = get();
    if (!storyInstance || !state.scenarioId) return null;
    return {
      inkStateJson: storyInstance.state.ToJson(),
      clockMinutes: state.clockMinutes,
      dayLabel: state.dayLabel,
      contacts: state.contacts,
      unlockedContactIds: state.unlockedContactIds,
      activeChannel: state.activeChannel,
      activeSenderId: state.activeSenderId,
      activeEmailDraftId: state.activeEmailDraftId,
      chatMessages: state.chatMessages,
      unreadChatCounts: state.unreadChatCounts,
      emails: state.emails,
      files: state.files,
      notes: state.notes,
      activeChoices: state.activeChoices,
      pendingHooks: state.pendingHooks,
      pausedByContinueHook,
      playerVariables: state.playerVariables,
    };
  }

  function persistSnapshot() {
    const state = get();
    const snapshot = buildCurrentSnapshot();
    if (!snapshot || !state.scenarioId) return;
    try {
      localStorage.setItem(
        `${STORAGE_PREFIX}${state.scenarioId}`,
        JSON.stringify(snapshot)
      );
      localStorage.setItem(ACTIVE_SCENARIO_KEY, state.scenarioId);
    } catch {
      // Ignore storage quota errors gracefully
    }
  }

  function applySnapshot(saved: PersistedSnapshot, reason: string): boolean {
    const manifest = get().manifest;
    if (!storyInstance || !manifest) return false;

    storyInstance.state.LoadJson(saved.inkStateJson);
    sessionToken += 1;
    dispatchQueue.length = 0;
    queueRunning = false;
    pausedByContinueHook = Boolean(saved.pausedByContinueHook);

    const contacts = Array.isArray(saved.contacts) && saved.contacts.length > 0
      ? saved.contacts
      : manifest.contacts;
    const unlockedContactIds = Array.isArray(saved.unlockedContactIds)
      ? saved.unlockedContactIds
      : contacts.filter((c) => !c.hiddenByDefault).map((c) => c.id);
    const defaultContact =
      contacts.find((c) => c.pinned && unlockedContactIds.includes(c.id))?.id ??
      contacts.find((c) => unlockedContactIds.includes(c.id))?.id ??
      contacts[0]?.id ??
      null;
    const notes =
      Array.isArray(saved.notes) && saved.notes.length > 0
        ? saved.notes
        : [
            {
              id: 'note_default',
              title: 'Shift Notes',
              content: '',
              updatedAt: formatClock24(saved.clockMinutes),
            },
          ];
    const playerVariables =
      saved.playerVariables && typeof saved.playerVariables === 'object'
        ? saved.playerVariables
        : {};
    const templateVars = collectTemplateVars(playerVariables);

    set({
      appPhase: 'desktop',
      pendingScenarioId: null,
      isLoading: false,
      windows: createDefaultWindows(),
      focusedApp: 'messages',
      nextZIndex: 14,
      toasts: [],
      notifications: [],
      typingContactId: null,
      clockMinutes: saved.clockMinutes,
      dayLabel: saved.dayLabel || manifest.dayLabel || 'Day 1',
      contacts,
      unlockedContactIds,
      activeContactId: defaultContact,
      chatMessages: saved.chatMessages,
      unreadChatCounts: saved.unreadChatCounts ?? {},
      emails: saved.emails,
      activeEmailId: saved.emails[saved.emails.length - 1]?.id ?? null,
      files: saved.files,
      selectedFolder: 'Documents',
      selectedFileId: saved.files[0]?.id ?? null,
      notes,
      activeNoteId: notes[0]?.id ?? null,
      activeChannel: saved.activeChannel,
      activeSenderId: saved.activeSenderId,
      activeEmailDraftId: saved.activeEmailDraftId,
      activeChoices: saved.activeChoices,
      pendingHooks: saved.pendingHooks,
      playerVariables,
      templateVars,
      debugLogs: [
        {
          id: makeId('log'),
          time: formatClock24(saved.clockMinutes),
          type: 'checkpoint',
          summary: reason,
        },
      ],
    });

    persistSnapshot();
    return true;
  }

  function applyEmailLine(beat: Extract<DispatchBeat, { kind: 'email_line' }>) {
    const state = get();
    const sender = state.contacts.find((c) => c.id === beat.senderId);
    const senderName = sender?.name ?? beat.senderId;
    const timestamp = formatClock24(state.clockMinutes);

    for (const att of beat.attachments) {
      upsertFile(att, {
        receivedVia: { channel: 'email', senderId: beat.senderId },
      });
    }

    const shouldCreateNewEmail =
      Boolean(beat.subject) ||
      !state.activeEmailDraftId ||
      !state.emails.some(
        (e) => e.id === state.activeEmailDraftId && e.senderId === beat.senderId
      );

    if (shouldCreateNewEmail) {
      const newEmail: EmailMessage = {
        id: makeId('mail'),
        senderId: beat.senderId,
        subject: beat.subject || '(No Subject)',
        body: beat.line ? [beat.line] : [],
        timestamp,
        read: false,
        flagged: beat.flagEmail,
        attachments: [...beat.attachments],
        replies: [],
      };

      set((s) => ({
        emails: [...s.emails, newEmail],
        activeEmailDraftId: newEmail.id,
        activeEmailId: s.activeEmailId ?? newEmail.id,
      }));

      const mailWin = state.windows.mail;
      const mailVisible =
        mailWin.isOpen && !mailWin.isMinimized && state.focusedApp === 'mail';
      if (!mailVisible) {
        pushNotification('mail', `New Email from ${senderName}`, newEmail.subject, {
          emailId: newEmail.id,
        });
      }
    } else {
      const targetId = state.activeEmailDraftId!;
      set((s) => ({
        emails: s.emails.map((e) => {
          if (e.id !== targetId) return e;
          const mergedAttachments = Array.from(
            new Set([...e.attachments, ...beat.attachments])
          );
          return {
            ...e,
            body: beat.line ? [...e.body, beat.line] : e.body,
            attachments: mergedAttachments,
            flagged: e.flagged || beat.flagEmail,
          };
        }),
      }));
    }
  }

  function deliverChatMessage(msg: ChatMessage) {
    const state = get();
    const msgWin = state.windows.messages;
    const isViewingThisThread =
      msgWin.isOpen &&
      !msgWin.isMinimized &&
      state.focusedApp === 'messages' &&
      state.activeContactId === msg.contactId;

    set((s) => ({
      typingContactId: null,
      unlockedContactIds: s.unlockedContactIds.includes(msg.contactId)
        ? s.unlockedContactIds
        : [...s.unlockedContactIds, msg.contactId],
      chatMessages: [...s.chatMessages, msg],
      unreadChatCounts: isViewingThisThread
        ? s.unreadChatCounts
        : {
            ...s.unreadChatCounts,
            [msg.contactId]: (s.unreadChatCounts[msg.contactId] ?? 0) + 1,
          },
    }));

    if (!isViewingThisThread && msg.sender === 'contact') {
      const sender = state.contacts.find((c) => c.id === msg.contactId);
      const preview =
        msg.kind === 'voice_note'
          ? `Voice note (${msg.voiceNote?.duration ?? '0:15'})`
          : msg.text || 'Sent an attachment';
      pushNotification('messages', sender?.name ?? msg.contactId, preview, {
        contactId: msg.contactId,
      });
    }
  }

  async function processDispatchQueue(token: number) {
    if (queueRunning) return;
    queueRunning = true;

    try {
      while (dispatchQueue.length > 0) {
        if (token !== sessionToken) return;
        const beat = dispatchQueue.shift()!;

        switch (beat.kind) {
          case 'advance_time': {
            set((s) => ({ clockMinutes: s.clockMinutes + beat.minutes }));
            break;
          }
          case 'set_time': {
            set({ clockMinutes: beat.minutes });
            break;
          }
          case 'set_day': {
            set({ dayLabel: beat.dayLabel });
            break;
          }
          case 'contact_unlock': {
            set((s) => ({
              unlockedContactIds: s.unlockedContactIds.includes(beat.contactId)
                ? s.unlockedContactIds
                : [...s.unlockedContactIds, beat.contactId],
            }));
            break;
          }
          case 'contact_status': {
            set((s) => ({
              contacts: s.contacts.map((c) =>
                c.id === beat.contactId ? { ...c, status: beat.status } : c
              ),
            }));
            break;
          }
          case 'unlock_file': {
            upsertFile(beat.path, {
              folder: beat.folder,
              name: beat.name,
              receivedVia: beat.receivedVia,
              notify: beat.notify,
            });
            break;
          }
          case 'chat': {
            const delay = get().instantTyping ? 0 : beat.typingDelayMs;
            if (delay > 0) {
              set({ typingContactId: beat.message.contactId });
              await new Promise((resolve) => window.setTimeout(resolve, delay));
              if (token !== sessionToken) return;
            }
            const stamped: ChatMessage = {
              ...beat.message,
              timestamp: formatClock24(get().clockMinutes),
            };
            deliverChatMessage(stamped);
            break;
          }
          case 'email_line': {
            applyEmailLine(beat);
            break;
          }
          case 'register_hook': {
            set((s) => {
              const alreadyExists = s.pendingHooks.some(
                (h) =>
                  h.event === beat.hook.event &&
                  h.target === beat.hook.target &&
                  h.targetKnot === beat.hook.targetKnot &&
                  h.resumeMode === beat.hook.resumeMode
              );
              if (alreadyExists) return s;
              return { pendingHooks: [...s.pendingHooks, beat.hook] };
            });
            appendDebugLog(
              'hook_registered',
              `Waiting on ${beat.hook.event}: ${beat.hook.target}${
                beat.hook.targetKnot ? ` -> ${beat.hook.targetKnot}` : ' (pause/continue)'
              }`
            );
            break;
          }
          case 'set_choices': {
            set({ activeChoices: beat.choices });
            break;
          }
        }
      }
      if (token === sessionToken) {
        persistSnapshot();
      }
    } finally {
      if (token === sessionToken) {
        set({ typingContactId: null });
      }
      queueRunning = false;
    }
  }

  function executeHooks(matched: EventHook[]) {
    set((state) => ({
      pendingHooks: state.pendingHooks.filter(
        (h) => !matched.some((m) => m.id === h.id)
      ),
    }));

    for (const hook of matched) {
      appendDebugLog(
        'hook_fired',
        `Fired ${hook.event} on ${hook.target}${
          hook.targetKnot ? ` -> ${hook.targetKnot}` : ' (resuming)'
        }`
      );

      if (!storyInstance) continue;
      try {
        if (hook.resumeMode === 'knot' && hook.targetKnot) {
          storyInstance.ChoosePathString(hook.targetKnot);
          drainStory();
        } else {
          pausedByContinueHook = false;
          drainStory();
        }
      } catch (err) {
        appendDebugLog(
          'error',
          `Hook execution failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  function fireMatchingHooks(
    event: EventHookType,
    predicate: (hook: EventHook) => boolean
  ): boolean {
    const matched = get().pendingHooks.filter(
      (h) => h.event === event && predicate(h)
    );
    if (matched.length === 0) {
      return false;
    }
    executeHooks(matched);
    return true;
  }

  function drainStory() {
    if (!storyInstance) return;

    let currentChannel: Channel = get().activeChannel;
    let currentSenderId: string =
      get().activeSenderId ||
      get().contacts[0]?.id ||
      'system_guide';
    let lastEmailSenderId: string | null = null;
    let shouldPauseForContinueHook = false;

    const maxSteps = 200;
    let steps = 0;

    while (storyInstance.canContinue && steps < maxSteps) {
      steps += 1;
      const rawLine = storyInstance.Continue() ?? '';
      const rawTags = storyInstance.currentTags ?? [];
      const vars = collectTemplateVars(get().playerVariables);
      const line = interpolateTemplate(rawLine.trim(), vars);
      const parsed = parseInkTags(rawTags);
      const interpolatedSubject = parsed.subject
        ? interpolateTemplate(parsed.subject, vars)
        : undefined;
      const interpolatedDayLabel = parsed.setDayLabel
        ? interpolateTemplate(parsed.setDayLabel, vars)
        : undefined;

      if (parsed.unknownTags.length > 0) {
        appendDebugLog('tag', `Unrecognized tags: ${parsed.unknownTags.join(', ')}`);
      }
      if (line || rawTags.length > 0) {
        appendDebugLog('ink_line', line || '(tag-only beat)', { tags: rawTags });
      }

      if (parsed.setTimeMinutes !== undefined) {
        dispatchQueue.push({
          kind: 'set_time',
          minutes: parsed.setTimeMinutes,
        });
      }
      if (parsed.advanceMinutes > 0) {
        dispatchQueue.push({
          kind: 'advance_time',
          minutes: parsed.advanceMinutes,
        });
      }
      if (interpolatedDayLabel) {
        dispatchQueue.push({
          kind: 'set_day',
          dayLabel: interpolatedDayLabel,
        });
      }
      for (const contactId of parsed.contactUnlocks) {
        dispatchQueue.push({
          kind: 'contact_unlock',
          contactId,
        });
      }
      for (const statusUpdate of parsed.contactStatuses) {
        dispatchQueue.push({
          kind: 'contact_status',
          contactId: statusUpdate.contactId,
          status: statusUpdate.status,
        });
      }

      if (parsed.channel) {
        currentChannel = parsed.channel;
      }
      if (parsed.sender) {
        currentSenderId = parsed.sender;
      }

      // Standalone file unlocks
      for (const unlock of parsed.fileUnlocks) {
        dispatchQueue.push({
          kind: 'unlock_file',
          path: unlock.path,
          folder: unlock.folder,
          name: unlock.name,
          notify: true,
        });
      }

      if (currentChannel === 'chat') {
        lastEmailSenderId = null;

        // Register attachments in File Explorer via Unified Media Routing
        for (const attPath of parsed.attachments) {
          dispatchQueue.push({
            kind: 'unlock_file',
            path: attPath,
            receivedVia: { channel: 'chat', senderId: currentSenderId },
          });
        }

        if (parsed.voiceNote) {
          const vn = parsed.voiceNote;
          dispatchQueue.push({
            kind: 'unlock_file',
            path: vn.path,
            folder: 'Voice Notes',
            receivedVia: { channel: 'chat', senderId: currentSenderId },
          });

          dispatchQueue.push({
            kind: 'chat',
            typingDelayMs: parsed.typingDelayMs ?? 550,
            message: {
              id: makeId('msg'),
              contactId: currentSenderId,
              sender: 'contact',
              kind: 'voice_note',
              text: line,
              timestamp: '',
              attachmentPath: vn.path,
              voiceNote: {
                path: vn.path,
                duration: vn.duration,
                transcript: vn.transcript ? interpolateTemplate(vn.transcript, vars) : vn.transcript,
              },
            },
          });
        } else if (parsed.attachments.length > 0) {
          if (line) {
            dispatchQueue.push({
              kind: 'chat',
              typingDelayMs: parsed.typingDelayMs ?? 600,
              message: {
                id: makeId('msg'),
                contactId: currentSenderId,
                sender: 'contact',
                kind: 'text',
                text: line,
                timestamp: '',
              },
            });
          }
          for (const attPath of parsed.attachments) {
            dispatchQueue.push({
              kind: 'chat',
              typingDelayMs: line ? 350 : parsed.typingDelayMs ?? 550,
              message: {
                id: makeId('msg'),
                contactId: currentSenderId,
                sender: 'contact',
                kind: 'attachment',
                text: '',
                timestamp: '',
                attachmentPath: attPath,
              },
            });
          }
        } else if (line) {
          dispatchQueue.push({
            kind: 'chat',
            typingDelayMs: parsed.typingDelayMs ?? 600,
            message: {
              id: makeId('msg'),
              contactId: currentSenderId,
              sender: 'contact',
              kind: 'text',
              text: line,
              timestamp: '',
            },
          });
        }
      } else {
        // Email channel
        const emailSenderChanged =
          lastEmailSenderId !== null && lastEmailSenderId !== currentSenderId;
        lastEmailSenderId = currentSenderId;

        if (
          line ||
          interpolatedSubject ||
          parsed.attachments.length > 0 ||
          parsed.flagEmail
        ) {
          dispatchQueue.push({
            kind: 'email_line',
            senderId: currentSenderId,
            subject:
              interpolatedSubject ??
              (emailSenderChanged ? '(Follow-up)' : undefined),
            line,
            attachments: parsed.attachments,
            flagEmail: parsed.flagEmail,
          });
        }
      }

      // Register any EVENT_HOOKs on this line
      for (const hookSpec of parsed.eventHooks) {
        const hook: EventHook = {
          id: makeId('hook'),
          event: hookSpec.event,
          target: hookSpec.target,
          resumeMode: hookSpec.resumeMode,
          targetKnot: hookSpec.targetKnot,
          registeredAt: formatClock24(get().clockMinutes),
        };
        dispatchQueue.push({ kind: 'register_hook', hook });
        if (hookSpec.resumeMode === 'continue') {
          shouldPauseForContinueHook = true;
        }
      }

      if (shouldPauseForContinueHook) {
        break;
      }
    }

    pausedByContinueHook = shouldPauseForContinueHook;

    const latestVars = collectTemplateVars(get().playerVariables);
    set({
      activeChannel: currentChannel,
      activeSenderId: currentSenderId,
      templateVars: latestVars,
    });

    if (!shouldPauseForContinueHook) {
      const choices: ActiveChoice[] = storyInstance.currentChoices.map((c) => {
        const choiceTags = parseInkTags(c.tags ?? []);
        const channel = choiceTags.channel ?? currentChannel;
        const senderOverride = choiceTags.sender;

        let targetId: string;
        if (channel === 'chat') {
          targetId = senderOverride ?? currentSenderId;
        } else {
          const state = get();
          const queuedEmailExists = dispatchQueue.some((b) => b.kind === 'email_line');
          if (senderOverride) {
            const match = [...state.emails]
              .reverse()
              .find((e) => e.senderId === senderOverride);
            targetId = match?.id ?? state.activeEmailDraftId ?? '__latest_email__';
          } else if (queuedEmailExists) {
            targetId = '__latest_email__';
          } else {
            targetId =
              state.activeEmailDraftId ??
              state.emails[state.emails.length - 1]?.id ??
              '__latest_email__';
          }
        }

        return {
          index: c.index,
          text: interpolateTemplate(c.text.trim(), latestVars),
          channel,
          targetId,
          silent: choiceTags.silent,
        };
      });

      dispatchQueue.push({
        kind: 'set_choices',
        choices,
      });
    } else {
      dispatchQueue.push({
        kind: 'set_choices',
        choices: [],
      });
    }

    void processDispatchQueue(sessionToken).then(() => {
      const currentChoices = get().activeChoices;
      if (currentChoices.some((c) => c.targetId === '__latest_email__')) {
        const emails = get().emails;
        const latestId =
          get().activeEmailDraftId ?? emails[emails.length - 1]?.id ?? '';
        set({
          activeChoices: currentChoices.map((c) =>
            c.targetId === '__latest_email__' ? { ...c, targetId: latestId } : c
          ),
        });
        persistSnapshot();
      }
    });
  }

  return {
    appPhase: 'booting',
    authEnabled: false,
    isAuthenticated: false,
    authError: null,
    pendingScenarioId: null,
    isLoading: true,
    loadError: null,
    availableScenarios: [],
    scenarioId: 'demo',
    manifest: null,
    compiledFrom: null,
    compilerWarnings: [],
    playerVariables: {},
    templateVars: {},

    windows: createDefaultWindows(),
    focusedApp: 'messages',
    nextZIndex: 14,
    startMenuOpen: false,
    notificationsOpen: false,
    toasts: [],
    notifications: [],
    muted: false,
    instantTyping: false,

    clockMinutes: 9 * 60,
    dayLabel: 'Day 1',

    contacts: [],
    unlockedContactIds: [],
    activeContactId: null,
    chatMessages: [],
    unreadChatCounts: {},
    typingContactId: null,

    emails: [],
    activeEmailId: null,

    files: [],
    selectedFolder: 'Documents',
    selectedFileId: null,

    notes: [],
    activeNoteId: null,

    activeChannel: 'chat',
    activeSenderId: 'system_guide',
    activeEmailDraftId: null,
    activeChoices: [],
    pendingHooks: [],
    debugLogs: [],
    checkpoints: [],

    initApp: async () => {
      if (initStarted) return;
      initStarted = true;

      set({ appPhase: 'booting', isLoading: true, loadError: null, authError: null });

      try {
        const auth = await fetchAuthStatus();
        if (auth.authEnabled && !auth.authenticated) {
          set({
            authEnabled: true,
            isAuthenticated: false,
            appPhase: 'login',
            isLoading: false,
            loadError: null,
          });
          return;
        }

        set({
          authEnabled: auth.authEnabled,
          isAuthenticated: true,
        });

        const scenarios = await fetchScenarioIndex();
        const savedId = localStorage.getItem(ACTIVE_SCENARIO_KEY);
        set({ availableScenarios: scenarios });

        if (savedId && scenarios.some((s) => s.id === savedId)) {
          await get().loadScenario(savedId);
        } else {
          set({
            appPhase: 'select_scenario',
            pendingScenarioId: scenarios[0]?.id ?? null,
            isLoading: false,
          });
        }
      } catch (err) {
        if (err instanceof AuthRequiredError) {
          localStorage.removeItem(ACTIVE_SCENARIO_KEY);
          set({
            authEnabled: true,
            isAuthenticated: false,
            appPhase: 'login',
            isLoading: false,
            loadError: null,
          });
          return;
        }
        set({
          appPhase: 'select_scenario',
          isLoading: false,
          loadError: err instanceof Error ? err.message : String(err),
        });
        initStarted = false;
      }
    },

    login: async (password) => {
      set({ authError: null });
      const result = await submitLogin(password);
      if (!result.ok) {
        set({ authError: result.error ?? 'Invalid access password.' });
        return result;
      }

      set({
        isAuthenticated: true,
        authError: null,
        isLoading: true,
        loadError: null,
      });

      try {
        const scenarios = await fetchScenarioIndex();
        set({
          availableScenarios: scenarios,
          appPhase: 'select_scenario',
          pendingScenarioId: scenarios[0]?.id ?? null,
          isLoading: false,
        });
      } catch (err) {
        if (err instanceof AuthRequiredError) {
          set({
            isAuthenticated: false,
            appPhase: 'login',
            authError: 'Session expired. Please sign in again.',
            isLoading: false,
          });
          return { ok: false, error: 'Session expired. Please sign in again.' };
        }
        set({
          appPhase: 'select_scenario',
          isLoading: false,
          loadError: err instanceof Error ? err.message : String(err),
        });
        initStarted = false;
      }

      return { ok: true };
    },

    logout: async () => {
      await submitLogout();
      localStorage.removeItem(ACTIVE_SCENARIO_KEY);
      sessionToken += 1;
      dispatchQueue.length = 0;
      queueRunning = false;
      pausedByContinueHook = false;
      storyInstance = null;

      set({
        isAuthenticated: false,
        appPhase: 'login',
        authError: null,
        isLoading: false,
        startMenuOpen: false,
        notificationsOpen: false,
        typingContactId: null,
        toasts: [],
      });
    },

    openScenarioSelector: (preselectId) => {
      localStorage.removeItem(ACTIVE_SCENARIO_KEY);
      sessionToken += 1;
      dispatchQueue.length = 0;
      queueRunning = false;

      set((state) => ({
        appPhase: 'select_scenario',
        pendingScenarioId:
          preselectId ?? state.scenarioId ?? state.availableScenarios[0]?.id ?? null,
        startMenuOpen: false,
        notificationsOpen: false,
        typingContactId: null,
        toasts: [],
      }));
    },

    loadScenario: async (scenarioId, opts) => {
      sessionToken += 1;
      dispatchQueue.length = 0;
      queueRunning = false;
      pausedByContinueHook = false;

      set({
        isLoading: true,
        loadError: null,
        startMenuOpen: false,
        notificationsOpen: false,
        typingContactId: null,
      });

      try {
        const bundle = await loadScenarioBundle(scenarioId);
        const { manifest, story, compiledFrom, compilerWarnings } = bundle;
        storyInstance = story;

        const resolvedId = manifest.id || scenarioId;
        const checkpoints = loadCheckpointsFromStorage(resolvedId);

        const startMinutes = parseClockMinutes(manifest.startTime || '09:00');
        const startTimeStr = formatClock24(startMinutes);
        const initialUnlockedContacts = manifest.contacts
          .filter((c) => !c.hiddenByDefault)
          .map((c) => c.id);
        const defaultContact =
          manifest.contacts.find(
            (c) => c.pinned && initialUnlockedContacts.includes(c.id)
          )?.id ??
          manifest.contacts.find((c) => initialUnlockedContacts.includes(c.id))?.id ??
          manifest.contacts[0]?.id ??
          null;

        const initialFiles = buildInitialFiles(manifest, startTimeStr);
        const initialNotes: NoteItem[] = [
          {
            id: 'note_default',
            title: 'Shift Notes',
            content: '',
            updatedAt: startTimeStr,
          },
        ];

        set({
          scenarioId: resolvedId,
          manifest,
          compiledFrom,
          compilerWarnings,
          checkpoints,
        });

        if (opts?.forceReset) {
          localStorage.removeItem(`${STORAGE_PREFIX}${resolvedId}`);
        }

        const savedRaw = !opts?.forceReset
          ? localStorage.getItem(`${STORAGE_PREFIX}${resolvedId}`)
          : null;

        if (savedRaw) {
          try {
            const saved = JSON.parse(savedRaw) as PersistedSnapshot;
            if (
              applySnapshot(
                saved,
                `Restored saved session for "${manifest.title}"`
              )
            ) {
              localStorage.setItem(ACTIVE_SCENARIO_KEY, resolvedId);
              return;
            }
          } catch (restoreErr) {
            localStorage.removeItem(`${STORAGE_PREFIX}${resolvedId}`);
            console.warn(
              'Starting fresh after incompatible saved Ink state:',
              restoreErr
            );
          }
        }

        // Resolve pre-start player variables and inject declared globals into Ink
        const resolvedVars: Record<string, string> = {};
        if (opts?.playerVariables) {
          for (const [k, v] of Object.entries(opts.playerVariables)) {
            const cleaned = sanitizePlayerInput(v);
            if (cleaned) {
              resolvedVars[k] = cleaned;
            }
          }
        }
        const prompt = normalizePlayerPrompt(manifest.playerPrompt);
        if (prompt && !resolvedVars[prompt.variableName] && prompt.defaultValue) {
          const cleanedDefault = sanitizePlayerInput(prompt.defaultValue);
          if (cleanedDefault) {
            resolvedVars[prompt.variableName] = cleanedDefault;
          }
        }

        const vs = storyInstance.variablesState as unknown as {
          _globalVariables?: Map<string, unknown>;
          $: (name: string, val?: unknown) => unknown;
        };
        const injectedLogs: DebugLogEntry[] = [];
        for (const [key, val] of Object.entries(resolvedVars)) {
          if (vs._globalVariables?.has(key)) {
            vs.$(key, val);
          } else {
            injectedLogs.push({
              id: makeId('log'),
              time: startTimeStr,
              type: 'tag',
              summary: `Pre-start variable "${key}" is not declared as VAR in story.ink (available for Markdown {{${key}}} only).`,
            });
          }
        }

        const initialTemplateVars = collectTemplateVars(resolvedVars);
        const initialDayLabel = interpolateTemplate(
          manifest.dayLabel || 'Day 1',
          initialTemplateVars
        );

        set({
          appPhase: 'desktop',
          pendingScenarioId: null,
          isLoading: false,
          windows: createDefaultWindows(),
          focusedApp: 'messages',
          nextZIndex: 14,
          toasts: [],
          notifications: [],
          clockMinutes: startMinutes,
          dayLabel: initialDayLabel,
          contacts: manifest.contacts,
          unlockedContactIds: initialUnlockedContacts,
          activeContactId: defaultContact,
          chatMessages: [],
          unreadChatCounts: {},
          emails: [],
          activeEmailId: null,
          files: initialFiles,
          selectedFolder: 'Documents',
          selectedFileId: initialFiles[0]?.id ?? null,
          notes: initialNotes,
          activeNoteId: initialNotes[0].id,
          activeChannel: 'chat',
          activeSenderId: defaultContact ?? 'system_guide',
          activeEmailDraftId: null,
          activeChoices: [],
          pendingHooks: [],
          playerVariables: resolvedVars,
          templateVars: initialTemplateVars,
          debugLogs: [
            {
              id: makeId('log'),
              time: startTimeStr,
              type: 'ink_line',
              summary: `Loaded "${manifest.title}" (source: ${compiledFrom})`,
            },
            ...injectedLogs,
          ],
        });

        localStorage.setItem(ACTIVE_SCENARIO_KEY, resolvedId);
        drainStory();
      } catch (err) {
        if (err instanceof AuthRequiredError) {
          localStorage.removeItem(ACTIVE_SCENARIO_KEY);
          set({
            authEnabled: true,
            isAuthenticated: false,
            appPhase: 'login',
            authError: 'Session expired. Please sign in again.',
            isLoading: false,
          });
          return;
        }
        set({
          isLoading: false,
          loadError: err instanceof Error ? err.message : String(err),
        });
      }
    },

    resetProgress: async (opts) => {
      const state = get();
      const id = state.scenarioId || 'demo';
      if (opts?.returnToSetup && normalizePlayerPrompt(state.manifest?.playerPrompt)) {
        localStorage.removeItem(`${STORAGE_PREFIX}${id}`);
        get().openScenarioSelector(id);
        return;
      }
      await get().loadScenario(id, {
        forceReset: true,
        playerVariables: state.playerVariables,
      });
    },

    openApp: (appId) => {
      set((state) => {
        const nextZ = state.nextZIndex + 1;
        const nextWindows = {
          ...state.windows,
          [appId]: {
            ...state.windows[appId],
            isOpen: true,
            isMinimized: false,
            zIndex: nextZ,
          },
        };

        let nextUnread = state.unreadChatCounts;
        if (appId === 'messages' && state.activeContactId) {
          nextUnread = {
            ...state.unreadChatCounts,
            [state.activeContactId]: 0,
          };
        }

        return {
          windows: nextWindows,
          focusedApp: appId,
          nextZIndex: nextZ,
          startMenuOpen: false,
          notificationsOpen: false,
          unreadChatCounts: nextUnread,
        };
      });
    },

    closeApp: (appId) => {
      set((state) => ({
        windows: {
          ...state.windows,
          [appId]: { ...state.windows[appId], isOpen: false, isMinimized: false },
        },
        focusedApp: state.focusedApp === appId ? null : state.focusedApp,
      }));
    },

    minimizeApp: (appId) => {
      set((state) => ({
        windows: {
          ...state.windows,
          [appId]: { ...state.windows[appId], isMinimized: true },
        },
        focusedApp: state.focusedApp === appId ? null : state.focusedApp,
      }));
    },

    toggleMaximizeApp: (appId) => {
      set((state) => {
        const nextZ = state.nextZIndex + 1;
        const win = state.windows[appId];
        return {
          windows: {
            ...state.windows,
            [appId]: {
              ...win,
              isMaximized: !win.isMaximized,
              isMinimized: false,
              zIndex: nextZ,
            },
          },
          focusedApp: appId,
          nextZIndex: nextZ,
        };
      });
    },

    focusApp: (appId) => {
      set((state) => {
        const win = state.windows[appId];
        if (!win.isOpen) return state;
        const nextZ = state.nextZIndex + 1;

        let nextUnread = state.unreadChatCounts;
        if (appId === 'messages' && state.activeContactId) {
          nextUnread = {
            ...state.unreadChatCounts,
            [state.activeContactId]: 0,
          };
        }

        return {
          windows: {
            ...state.windows,
            [appId]: { ...win, isMinimized: false, zIndex: nextZ },
          },
          focusedApp: appId,
          nextZIndex: nextZ,
          startMenuOpen: false,
          notificationsOpen: false,
          unreadChatCounts: nextUnread,
        };
      });
    },

    moveWindow: (appId, position) => {
      set((state) => ({
        windows: {
          ...state.windows,
          [appId]: { ...state.windows[appId], position },
        },
      }));
    },

    resizeWindow: (appId, size, position) => {
      set((state) => ({
        windows: {
          ...state.windows,
          [appId]: {
            ...state.windows[appId],
            size,
            ...(position ? { position } : {}),
          },
        },
      }));
    },

    toggleStartMenu: (open) => {
      set((state) => ({
        startMenuOpen: typeof open === 'boolean' ? open : !state.startMenuOpen,
        notificationsOpen: false,
      }));
    },

    toggleNotifications: (open) => {
      set((state) => ({
        notificationsOpen:
          typeof open === 'boolean' ? open : !state.notificationsOpen,
        startMenuOpen: false,
      }));
    },

    dismissToast: (id) => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    },

    markAllNotificationsRead: () => {
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
      }));
    },

    clickNotification: (notification) => {
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notification.id ? { ...n, read: true } : n
        ),
        toasts: state.toasts.filter((t) => t.id !== notification.id),
        notificationsOpen: false,
      }));

      if (notification.actionTarget?.filePath) {
        get().openFileInExplorer(notification.actionTarget.filePath);
        return;
      }

      get().openApp(notification.appId);
      if (notification.actionTarget?.contactId) {
        get().selectContact(notification.actionTarget.contactId);
      }
      if (notification.actionTarget?.emailId) {
        get().selectEmail(notification.actionTarget.emailId);
      }
    },

    toggleMuted: () => set((s) => ({ muted: !s.muted })),
    toggleInstantTyping: () => set((s) => ({ instantTyping: !s.instantTyping })),

    selectContact: (contactId) => {
      set((state) => ({
        activeContactId: contactId,
        unreadChatCounts: {
          ...state.unreadChatCounts,
          [contactId]: 0,
        },
      }));
    },

    selectEmail: (emailId) => {
      const targetEmail = get().emails.find((e) => e.id === emailId);
      if (!targetEmail) return;
      const wasUnread = !targetEmail.read;

      set((state) => ({
        activeEmailId: emailId,
        emails: state.emails.map((e) =>
          e.id === emailId ? { ...e, read: true } : e
        ),
      }));

      if (wasUnread) {
        appendDebugLog('email_read', `Read email: "${targetEmail.subject}"`);
      }

      const fired = fireMatchingHooks('on_email_read', (hook) =>
        matchesEmailHookTarget(targetEmail, hook.target)
      );
      if (!fired && wasUnread) {
        persistSnapshot();
      }
    },

    toggleEmailFlag: (emailId) => {
      set((state) => ({
        emails: state.emails.map((e) =>
          e.id === emailId ? { ...e, flagged: !e.flagged } : e
        ),
      }));
      persistSnapshot();
    },

    selectFolder: (folder) => {
      set({ selectedFolder: folder });
    },

    selectFile: (fileId) => {
      set({ selectedFileId: fileId });
      get().onFileOpened(fileId);
    },

    openFileInExplorer: (filePath) => {
      const normalized = normalizeScenarioPath(filePath);
      const file = upsertFile(normalized);

      const currentFolder = get().selectedFolder;
      const targetFolder =
        currentFolder === 'Downloads' && file.receivedVia ? 'Downloads' : file.folder;

      set({
        selectedFolder: targetFolder,
        selectedFileId: file.id,
      });

      get().openApp('explorer');
      get().onFileOpened(file.id);
    },

    onFileOpened: (filePath) => {
      const normalized = normalizeScenarioPath(filePath);
      const targetBasename = normalized.split('/').pop() ?? normalized;

      set((state) => ({
        files: state.files.map((f) =>
          f.id === normalized ? { ...f, opened: true } : f
        ),
      }));

      appendDebugLog('file_open', `Opened file: ${normalized}`);

      const fired = fireMatchingHooks(
        'on_file_open',
        (h) =>
          h.target === normalized ||
          (h.target.split('/').pop() ?? h.target) === targetBasename
      );

      if (!fired) {
        persistSnapshot();
      }
    },

    onAudioPlayed: (filePath) => {
      const normalized = normalizeScenarioPath(filePath);
      const targetBasename = normalized.split('/').pop() ?? normalized;

      appendDebugLog('audio_play', `Played audio: ${normalized}`);

      fireMatchingHooks(
        'on_audio_play',
        (h) =>
          h.target === normalized ||
          (h.target.split('/').pop() ?? h.target) === targetBasename
      );
    },

    selectChoice: (choiceIndex) => {
      if (!storyInstance) return;
      const choice = get().activeChoices.find((c) => c.index === choiceIndex);
      if (!choice) return;

      const timestamp = formatClock24(get().clockMinutes);

      if (!choice.silent) {
        if (choice.channel === 'chat') {
          const playerBubble: ChatMessage = {
            id: makeId('msg'),
            contactId: choice.targetId,
            sender: 'player',
            kind: 'text',
            text: choice.text,
            timestamp,
          };
          set((s) => ({
            chatMessages: [...s.chatMessages, playerBubble],
          }));
        } else {
          set((s) => ({
            emails: s.emails.map((e) =>
              e.id === choice.targetId
                ? {
                    ...e,
                    read: true,
                    replies: [...e.replies, { text: choice.text, sentAt: timestamp }],
                  }
                : e
            ),
          }));
        }
      }

      appendDebugLog('choice', `Selected [${choice.channel}]: "${choice.text}"`);
      set({ activeChoices: [] });

      try {
        storyInstance.ChooseChoiceIndex(choiceIndex);
        drainStory();
      } catch (err) {
        appendDebugLog(
          'error',
          `Choice execution failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    },

    forceTriggerHook: (hookId) => {
      const hook = get().pendingHooks.find((h) => h.id === hookId);
      if (!hook) return;
      executeHooks([hook]);
    },

    selectNote: (noteId) => {
      set({ activeNoteId: noteId });
    },

    createNote: (title) => {
      const nowStr = formatClock24(get().clockMinutes);
      const count = get().notes.length + 1;
      const note: NoteItem = {
        id: makeId('note'),
        title: title?.trim() || `Incident Note ${count}`,
        content: '',
        updatedAt: nowStr,
      };
      set((s) => ({
        notes: [note, ...s.notes],
        activeNoteId: note.id,
      }));
      persistSnapshot();
    },

    updateNote: (noteId, patch) => {
      const nowStr = formatClock24(get().clockMinutes);
      set((s) => ({
        notes: s.notes.map((n) =>
          n.id === noteId ? { ...n, ...patch, updatedAt: nowStr } : n
        ),
      }));
      persistSnapshot();
    },

    deleteNote: (noteId) => {
      set((s) => {
        const remaining = s.notes.filter((n) => n.id !== noteId);
        const nextActive =
          s.activeNoteId === noteId ? (remaining[0]?.id ?? null) : s.activeNoteId;
        return { notes: remaining, activeNoteId: nextActive };
      });
      persistSnapshot();
    },

    getInkVariables: () => {
      if (!storyInstance) return [];
      try {
        const vs = storyInstance.variablesState as unknown as {
          _globalVariables?: Map<string, unknown>;
          $: (name: string) => unknown;
        };
        const map = vs._globalVariables;
        if (!map) return [];
        const vars: Array<{ name: string; value: string }> = [];
        for (const key of map.keys()) {
          const val = storyInstance.variablesState.$(key);
          vars.push({
            name: key,
            value: typeof val === 'string' ? val : JSON.stringify(val),
          });
        }
        return vars;
      } catch {
        return [];
      }
    },

    getInkKnots: () => {
      if (!storyInstance) return [];
      try {
        const container = storyInstance.mainContentContainer as unknown as {
          namedContent?: Map<string, unknown> | Record<string, unknown>;
        };
        const named = container?.namedContent;
        if (!named) return [];
        const keys =
          named instanceof Map
            ? Array.from(named.keys())
            : Object.keys(named);
        return keys
          .filter((k) => !k.startsWith('$') && k !== 'global decl')
          .sort();
      } catch {
        return [];
      }
    },

    jumpToKnot: (knotName) => {
      if (!storyInstance || !knotName) return;
      sessionToken += 1;
      dispatchQueue.length = 0;
      queueRunning = false;
      pausedByContinueHook = false;

      set({
        activeChoices: [],
        typingContactId: null,
      });

      appendDebugLog('director', `Jumped to knot: ${knotName}`);
      try {
        storyInstance.ChoosePathString(knotName);
        drainStory();
      } catch (err) {
        appendDebugLog(
          'error',
          `Knot jump failed (${knotName}): ${err instanceof Error ? err.message : String(err)}`
        );
      }
    },

    setInkVariable: (name, rawValue) => {
      if (!storyInstance) return;
      const trimmed = rawValue.trim();
      let parsed: string | number | boolean = rawValue;
      if (trimmed === 'true') {
        parsed = true;
      } else if (trimmed === 'false') {
        parsed = false;
      } else if (trimmed !== '' && !Number.isNaN(Number(trimmed))) {
        parsed = Number(trimmed);
      }

      try {
        storyInstance.variablesState.$(name, parsed);
        set((state) => ({
          templateVars: collectTemplateVars(state.playerVariables),
        }));
        appendDebugLog('director', `Set variable ${name} = ${JSON.stringify(parsed)}`);
        persistSnapshot();
      } catch (err) {
        appendDebugLog(
          'error',
          `Failed to set variable "${name}": ${err instanceof Error ? err.message : String(err)}`
        );
      }
    },

    saveCheckpoint: (name) => {
      const snapshot = buildCurrentSnapshot();
      const scenarioId = get().scenarioId;
      if (!snapshot || !scenarioId) return;

      const clockStr = formatClock24(snapshot.clockMinutes);
      const count = get().checkpoints.length + 1;
      const record: CheckpointRecord = {
        id: makeId('cp'),
        name: name?.trim() || `Checkpoint ${count} (${clockStr})`,
        savedAt: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        clockStr,
        dayLabel: snapshot.dayLabel,
        snapshot,
      };

      const next = [record, ...get().checkpoints].slice(0, 25);
      set({ checkpoints: next });
      persistCheckpointsToStorage(scenarioId, next);
      appendDebugLog('checkpoint', `Saved checkpoint: "${record.name}"`);
    },

    restoreCheckpoint: (checkpointId) => {
      const record = get().checkpoints.find((c) => c.id === checkpointId);
      if (!record) return false;
      return applySnapshot(record.snapshot, `Restored checkpoint: "${record.name}"`);
    },

    deleteCheckpoint: (checkpointId) => {
      const scenarioId = get().scenarioId;
      const next = get().checkpoints.filter((c) => c.id !== checkpointId);
      set({ checkpoints: next });
      if (scenarioId) {
        persistCheckpointsToStorage(scenarioId, next);
      }
    },

    exportSaveJson: () => {
      const snapshot = buildCurrentSnapshot();
      return JSON.stringify(
        {
          scenarioId: get().scenarioId,
          exportedAt: new Date().toISOString(),
          snapshot,
        },
        null,
        2
      );
    },

    importSaveJson: (rawJson) => {
      try {
        const parsed = JSON.parse(rawJson) as {
          scenarioId?: string;
          snapshot?: PersistedSnapshot;
        } & Partial<PersistedSnapshot>;

        const snapshot: PersistedSnapshot | undefined = parsed.snapshot
          ? parsed.snapshot
          : typeof parsed.inkStateJson === 'string'
            ? (parsed as PersistedSnapshot)
            : undefined;

        if (!snapshot || typeof snapshot.inkStateJson !== 'string') {
          return { ok: false, error: 'Invalid save JSON: missing snapshot.inkStateJson' };
        }

        const ok = applySnapshot(snapshot, 'Imported save snapshot from JSON');
        return ok
          ? { ok: true }
          : { ok: false, error: 'Story runtime not ready to restore snapshot.' };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
});
