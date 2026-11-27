import { create } from 'zustand';
import type { Story } from 'inkjs/full';
import type {
  ActiveChoice,
  Channel,
  ChatMessage,
  DebugLogEntry,
  EmailMessage,
  EventHook,
} from '../types/narrative';
import type {
  AppId,
  ToastNotification,
  VirtualFile,
  WindowState,
} from '../types/os';
import type { Contact, FolderName, ScenarioManifest } from '../types/scenario';
import {
  fetchScenarioIndex,
  loadScenarioBundle,
  type ScenarioSummary,
} from '../engine/scenarioLoader';
import {
  formatClock24,
  inferFileMeta,
  normalizeScenarioPath,
  parseClockMinutes,
  parseInkTags,
} from '../engine/tagParser';

const STORAGE_PREFIX = 'curu-os:v1:';
const ACTIVE_SCENARIO_KEY = 'curu-os:v1:active-scenario';

let storyInstance: Story | null = null;
let sessionToken = 0;
let initStarted = false;
let queueRunning = false;
let pausedByContinueHook = false;

type DispatchBeat =
  | { kind: 'advance_time'; minutes: number }
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

interface PersistedSnapshot {
  inkStateJson: string;
  clockMinutes: number;
  activeChannel: Channel;
  activeSenderId: string;
  activeEmailDraftId: string | null;
  chatMessages: ChatMessage[];
  unreadChatCounts: Record<string, number>;
  emails: EmailMessage[];
  files: VirtualFile[];
  activeChoices: ActiveChoice[];
  pendingHooks: EventHook[];
  pausedByContinueHook: boolean;
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
    director: {
      id: 'director',
      title: 'Director Inspector',
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 13,
      position: { x: 320, y: 52 },
      size: { width: 660, height: 500 },
    },
  };
}

export interface OsState {
  // App lifecycle
  isLoading: boolean;
  loadError: string | null;
  availableScenarios: ScenarioSummary[];
  scenarioId: string;
  manifest: ScenarioManifest | null;
  compiledFrom: 'ink' | 'json' | null;
  compilerWarnings: string[];

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

  // In-world clock
  clockMinutes: number;

  // Contacts & Messages
  contacts: Contact[];
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

  // Narrative routing state
  activeChannel: Channel;
  activeSenderId: string;
  activeEmailDraftId: string | null;
  activeChoices: ActiveChoice[];
  pendingHooks: EventHook[];
  debugLogs: DebugLogEntry[];

  // Actions
  initApp: () => Promise<void>;
  loadScenario: (scenarioId: string, opts?: { forceReset?: boolean }) => Promise<void>;
  resetProgress: () => Promise<void>;

  // Window actions
  openApp: (appId: AppId) => void;
  closeApp: (appId: AppId) => void;
  minimizeApp: (appId: AppId) => void;
  toggleMaximizeApp: (appId: AppId) => void;
  focusApp: (appId: AppId) => void;
  moveWindow: (appId: AppId, position: { x: number; y: number }) => void;
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
  selectChoice: (choiceIndex: number) => void;
  forceTriggerHook: (hookId: string) => void;

  // Debug helper
  getInkVariables: () => Array<{ name: string; value: string }>;
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

  function persistSnapshot() {
    const state = get();
    if (!storyInstance || !state.scenarioId) return;
    try {
      const snapshot: PersistedSnapshot = {
        inkStateJson: storyInstance.state.ToJson(),
        clockMinutes: state.clockMinutes,
        activeChannel: state.activeChannel,
        activeSenderId: state.activeSenderId,
        activeEmailDraftId: state.activeEmailDraftId,
        chatMessages: state.chatMessages,
        unreadChatCounts: state.unreadChatCounts,
        emails: state.emails,
        files: state.files,
        activeChoices: state.activeChoices,
        pendingHooks: state.pendingHooks,
        pausedByContinueHook,
      };
      localStorage.setItem(
        `${STORAGE_PREFIX}${state.scenarioId}`,
        JSON.stringify(snapshot)
      );
      localStorage.setItem(ACTIVE_SCENARIO_KEY, state.scenarioId);
    } catch {
      // Ignore storage quota errors gracefully
    }
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
      const mailVisible = mailWin.isOpen && !mailWin.isMinimized && state.focusedApp === 'mail';
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
                  h.targetPath === beat.hook.targetPath &&
                  h.targetKnot === beat.hook.targetKnot &&
                  h.resumeMode === beat.hook.resumeMode
              );
              if (alreadyExists) return s;
              return { pendingHooks: [...s.pendingHooks, beat.hook] };
            });
            appendDebugLog(
              'hook_registered',
              `Waiting on file open: ${beat.hook.targetPath}${
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
      const line = rawLine.trim();
      const parsed = parseInkTags(rawTags);

      if (parsed.unknownTags.length > 0) {
        appendDebugLog('tag', `Unrecognized tags: ${parsed.unknownTags.join(', ')}`);
      }
      if (line || rawTags.length > 0) {
        appendDebugLog('ink_line', line || '(tag-only beat)', { tags: rawTags });
      }

      if (parsed.advanceMinutes > 0) {
        dispatchQueue.push({
          kind: 'advance_time',
          minutes: parsed.advanceMinutes,
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
                transcript: vn.transcript,
              },
            },
          });
        } else if (parsed.attachments.length > 0) {
          // If there is text alongside an attachment, emit text first, then attachment card(s)
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
          parsed.subject ||
          parsed.attachments.length > 0 ||
          parsed.flagEmail
        ) {
          dispatchQueue.push({
            kind: 'email_line',
            senderId: currentSenderId,
            subject:
              parsed.subject ??
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
          targetPath: hookSpec.targetPath,
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

    set({
      activeChannel: currentChannel,
      activeSenderId: currentSenderId,
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
          // Target latest email from senderOverride or activeEmailDraftId or newest email
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
          text: c.text.trim(),
          channel,
          targetId,
          silent: choiceTags.silent,
        };
      });

      // Resolve '__latest_email__' after queued email_line items execute
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
      // Fix up any '__latest_email__' choice targets once emails are created
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
    isLoading: true,
    loadError: null,
    availableScenarios: [],
    scenarioId: 'demo',
    manifest: null,
    compiledFrom: null,
    compilerWarnings: [],

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

    contacts: [],
    activeContactId: null,
    chatMessages: [],
    unreadChatCounts: {},
    typingContactId: null,

    emails: [],
    activeEmailId: null,

    files: [],
    selectedFolder: 'Documents',
    selectedFileId: null,

    activeChannel: 'chat',
    activeSenderId: 'system_guide',
    activeEmailDraftId: null,
    activeChoices: [],
    pendingHooks: [],
    debugLogs: [],

    initApp: async () => {
      if (initStarted) return;
      initStarted = true;

      try {
        const scenarios = await fetchScenarioIndex();
        const savedId = localStorage.getItem(ACTIVE_SCENARIO_KEY);
        const initialId =
          savedId && scenarios.some((s) => s.id === savedId)
            ? savedId
            : scenarios[0]?.id ?? 'demo';

        set({ availableScenarios: scenarios });
        await get().loadScenario(initialId);
      } catch (err) {
        set({
          isLoading: false,
          loadError: err instanceof Error ? err.message : String(err),
        });
      }
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

        const startMinutes = parseClockMinutes(manifest.startTime || '09:00');
        const startTimeStr = formatClock24(startMinutes);
        const defaultContact =
          manifest.contacts.find((c) => c.pinned)?.id ??
          manifest.contacts[0]?.id ??
          null;

        const initialFiles = buildInitialFiles(manifest, startTimeStr);

        if (opts?.forceReset) {
          localStorage.removeItem(`${STORAGE_PREFIX}${scenarioId}`);
        }

        const savedRaw = !opts?.forceReset
          ? localStorage.getItem(`${STORAGE_PREFIX}${scenarioId}`)
          : null;

        if (savedRaw) {
          try {
            const saved = JSON.parse(savedRaw) as PersistedSnapshot;
            story.state.LoadJson(saved.inkStateJson);
            pausedByContinueHook = Boolean(saved.pausedByContinueHook);

            set({
              isLoading: false,
              scenarioId: manifest.id || scenarioId,
              manifest,
              compiledFrom,
              compilerWarnings,
              windows: createDefaultWindows(),
              focusedApp: 'messages',
              nextZIndex: 14,
              toasts: [],
              notifications: [],
              clockMinutes: saved.clockMinutes,
              contacts: manifest.contacts,
              activeContactId: defaultContact,
              chatMessages: saved.chatMessages,
              unreadChatCounts: saved.unreadChatCounts ?? {},
              emails: saved.emails,
              activeEmailId: saved.emails[saved.emails.length - 1]?.id ?? null,
              files: saved.files,
              selectedFolder: 'Documents',
              selectedFileId: saved.files[0]?.id ?? null,
              activeChannel: saved.activeChannel,
              activeSenderId: saved.activeSenderId,
              activeEmailDraftId: saved.activeEmailDraftId,
              activeChoices: saved.activeChoices,
              pendingHooks: saved.pendingHooks,
              debugLogs: [
                {
                  id: makeId('log'),
                  time: formatClock24(saved.clockMinutes),
                  type: 'ink_line',
                  summary: `Restored saved session for "${manifest.title}"`,
                },
              ],
            });
            localStorage.setItem(ACTIVE_SCENARIO_KEY, manifest.id || scenarioId);
            return;
          } catch (restoreErr) {
            // Incompatible saved state (e.g. story.ink was edited); start fresh cleanly
            localStorage.removeItem(`${STORAGE_PREFIX}${scenarioId}`);
            console.warn('Starting fresh after incompatible saved Ink state:', restoreErr);
          }
        }

        set({
          isLoading: false,
          scenarioId: manifest.id || scenarioId,
          manifest,
          compiledFrom,
          compilerWarnings,
          windows: createDefaultWindows(),
          focusedApp: 'messages',
          nextZIndex: 14,
          toasts: [],
          notifications: [],
          clockMinutes: startMinutes,
          contacts: manifest.contacts,
          activeContactId: defaultContact,
          chatMessages: [],
          unreadChatCounts: {},
          emails: [],
          activeEmailId: null,
          files: initialFiles,
          selectedFolder: 'Documents',
          selectedFileId: initialFiles[0]?.id ?? null,
          activeChannel: 'chat',
          activeSenderId: defaultContact ?? 'system_guide',
          activeEmailDraftId: null,
          activeChoices: [],
          pendingHooks: [],
          debugLogs: [
            {
              id: makeId('log'),
              time: startTimeStr,
              type: 'ink_line',
              summary: `Loaded "${manifest.title}" (source: ${compiledFrom})`,
            },
          ],
        });

        localStorage.setItem(ACTIVE_SCENARIO_KEY, manifest.id || scenarioId);
        drainStory();
      } catch (err) {
        set({
          isLoading: false,
          loadError: err instanceof Error ? err.message : String(err),
        });
      }
    },

    resetProgress: async () => {
      const id = get().scenarioId || 'demo';
      await get().loadScenario(id, { forceReset: true });
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
      set((state) => ({
        activeEmailId: emailId,
        emails: state.emails.map((e) =>
          e.id === emailId ? { ...e, read: true } : e
        ),
      }));
    },

    toggleEmailFlag: (emailId) => {
      set((state) => ({
        emails: state.emails.map((e) =>
          e.id === emailId ? { ...e, flagged: !e.flagged } : e
        ),
      }));
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

      const hooks = get().pendingHooks;
      const matched = hooks.filter(
        (h) =>
          h.targetPath === normalized ||
          h.targetPath.split('/').pop() === targetBasename
      );

      if (matched.length === 0) {
        persistSnapshot();
        return;
      }

      set((state) => ({
        pendingHooks: state.pendingHooks.filter(
          (h) => !matched.some((m) => m.id === h.id)
        ),
      }));

      for (const hook of matched) {
        appendDebugLog(
          'hook_fired',
          `Fired hook on ${hook.targetPath}${
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
      get().onFileOpened(hook.targetPath);
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
  };
});
