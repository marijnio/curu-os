import type { AppId } from '../types/os';
import type { FileKind, FolderName, ScenarioLocale } from '../types/scenario';

export const SUPPORTED_LOCALES: readonly ScenarioLocale[] = ['en', 'nl'];

export function resolveLocale(raw?: string | null): ScenarioLocale {
  return raw === 'nl' ? 'nl' : 'en';
}

export interface UiTranslations {
  apps: Record<AppId, string>;
  folders: Record<FolderName, string>;
  fileKinds: Record<FileKind, string>;
  timeOfDay: {
    morning: string;
    midday: string;
    afternoon: string;
    evening: string;
    night: string;
  };
  desktop: {
    loadingWorkspace: string;
    scenarioLoadError: string;
    retryScenario: string;
    dismissNotification: string;
  };
  window: {
    minimize: (title: string) => string;
    restore: string;
    maximize: string;
    close: (title: string) => string;
  };
  messages: {
    contacts: string;
    pinned: string;
    colleagues: string;
    internalChat: string;
    voiceMessagePreview: string;
    attachmentPreview: string;
    noMessagesWith: (name: string) => string;
    chooseReply: string;
    typeReply: string;
    inputPlaceholder: string;
    sendButton: string;
    isTyping: (name: string) => string;
    hookAudio: string;
    hookEmail: string;
    hookNote: string;
    hookFile: string;
    waitingInMail: string;
    waitingInChat: (name: string) => string;
    replyBadge: string;
    activeInOtherThread: string;
    noReplyNeeded: string;
    selectContact: string;
  };
  mail: {
    inbox: string;
    unreadBadge: (count: number) => string;
    searchPlaceholder: string;
    clearSearch: string;
    filters: {
      all: string;
      unread: string;
      flagged: string;
    };
    emptyInbox: string;
    noMatchingEmails: string;
    toggleFlag: string;
    flag: string;
    flagged: string;
    toLabel: string;
    you: string;
    staff: string;
    attachments: (count: number) => string;
    sentReply: string;
    sendingReply: string;
    syncingInbox: string;
    replyActions: string;
    send: string;
    selectEmail: string;
  };
  explorer: {
    thisDesk: string;
    searchPlaceholder: string;
    clearSearch: string;
    listView: string;
    gridView: string;
    searchingAllFolders: (count: number) => string;
    noMatchingFiles: string;
    emptyFolder: string;
    workspace: string;
    expand: string;
    expandPreview: string;
    selectFile: string;
  };
  notes: {
    headerTitle: string;
    newButton: string;
    newNoteButton: string;
    newNoteTooltip: string;
    noNotes: string;
    untitledNote: string;
    deleteNoteLabel: (title: string) => string;
    noteTitlePlaceholder: string;
    stampTime: (time: string) => string;
    stampTimeTitle: string;
    contentPlaceholder: string;
    updatedAt: (time: string) => string;
    stats: (words: number, lines: number) => string;
    emptyState: string;
    defaultNoteTitle: string;
    newNoteTitle: (count: number) => string;
  };
  startMenu: {
    defaultSubtitle: string;
    signedInAs: (name: string) => string;
    applications: string;
    scenario: string;
    switchScenario: string;
    directorInspector: string;
    on: string;
    off: string;
    resetProgress: string;
    restartPrompt: string;
    cancel: string;
    reset: string;
    signOut: string;
  };
  taskbar: {
    startMenuTooltip: (osName: string) => string;
    startMenuAria: (osName: string) => string;
    directorShort: string;
    pendingReply: string;
  };
  systemTray: {
    unmuteAudio: string;
    muteAudio: string;
    notifications: string;
    clearUnread: string;
    noNotifications: string;
  };
  notifications: {
    newFileTitle: string;
    newFileBody: (name: string, folderLabel: string) => string;
    newEmailTitle: (senderName: string) => string;
    noSubject: string;
    followUpSubject: string;
    voiceNotePreview: (duration: string) => string;
    sentAttachment: string;
    newNoteTitle: string;
  };
  shared: {
    open: string;
    openFile: string;
    simulated: string;
    hide: string;
    transcript: string;
    autoTranscript: string;
    pauseVoiceNote: string;
    playVoiceNote: string;
    audioProgress: string;
    loadingDocument: string;
    copyToClipboard: string;
    copied: string;
  };
  selector: {
    initializing: string;
    workstationTitle: string;
    accessRestricted: string;
    enterPasswordPrompt: string;
    accessPassword: string;
    enterPasswordPlaceholder: string;
    hidePassword: string;
    showPassword: string;
    verifying: string;
    unlockWorkstation: string;
    selectScenarioPrompt: string;
    scenarioCount: (count: number) => string;
    signOut: string;
    retry: string;
    noScenariosFound: string;
    availableScenarios: string;
    inProgress: string;
    savedSessionAvailable: string;
    signedInAsPrefix: string;
    resumeSession: string;
    startFresh: string;
    required: string;
    launching: string;
    startScenario: string;
    backToResume: string;
    loadingScenario: string;
  };
}

export const TRANSLATIONS: Record<ScenarioLocale, UiTranslations> = {
  en: {
    apps: {
      messages: 'Messages',
      mail: 'Mail',
      explorer: 'File Explorer',
      notes: 'Notes',
      director: 'Director Inspector',
    },
    folders: {
      Documents: 'Documents',
      Images: 'Images',
      'Voice Notes': 'Voice Notes',
      Downloads: 'Downloads',
    },
    fileKinds: {
      markdown: 'Document',
      image: 'Image',
      audio: 'Audio',
      text: 'Text',
    },
    timeOfDay: {
      morning: 'Morning',
      midday: 'Midday',
      afternoon: 'Afternoon',
      evening: 'Evening',
      night: 'Night',
    },
    desktop: {
      loadingWorkspace: 'Loading workspace...',
      scenarioLoadError: 'Scenario Load Error',
      retryScenario: 'Retry Scenario',
      dismissNotification: 'Dismiss notification',
    },
    window: {
      minimize: (title) => `Minimize ${title}`,
      restore: 'Restore window',
      maximize: 'Maximize window',
      close: (title) => `Close ${title}`,
    },
    messages: {
      contacts: 'Contacts',
      pinned: 'Pinned',
      colleagues: 'Colleagues',
      internalChat: 'Internal Chat',
      voiceMessagePreview: 'Voice message',
      attachmentPreview: 'Sent a file',
      noMessagesWith: (name) => `No messages with ${name} yet.`,
      chooseReply: 'Choose a reply',
      typeReply: 'Type a reply',
      inputPlaceholder: 'Type your response...',
      sendButton: 'Send',
      isTyping: (name) => `${name} is typing...`,
      hookAudio: 'Listen to the voice note to continue.',
      hookEmail: 'Open and read the incoming email in Mail to continue.',
      hookNote: 'Open the note in Notes to continue.',
      hookFile: 'Open the shared file in File Explorer to continue.',
      waitingInMail: 'A reply is waiting in Mail.',
      waitingInChat: (name) => `Reply waiting in ${name}'s chat`,
      replyBadge: 'Reply',
      activeInOtherThread: 'Active conversation is in another thread.',
      noReplyNeeded: 'No reply needed right now.',
      selectContact: 'Select a contact to view messages.',
    },
    mail: {
      inbox: 'Inbox',
      unreadBadge: (count) => `${count} unread`,
      searchPlaceholder: 'Search mail...',
      clearSearch: 'Clear mail search',
      filters: {
        all: 'all',
        unread: 'unread',
        flagged: 'flagged',
      },
      emptyInbox: 'Your inbox is currently empty.',
      noMatchingEmails: 'No emails match your filter.',
      toggleFlag: 'Toggle flag',
      flag: 'Flag',
      flagged: 'Flagged',
      toLabel: 'To:',
      you: 'You',
      staff: 'Staff',
      attachments: (count) => `Attachments (${count})`,
      sentReply: 'Sent Reply',
      sendingReply: 'Sending reply...',
      syncingInbox: 'Syncing...',
      replyActions: 'Reply Actions',
      send: 'Send',
      selectEmail: 'Select an email to read.',
    },
    explorer: {
      thisDesk: 'This Desk',
      searchPlaceholder: 'Search all files...',
      clearSearch: 'Clear file search',
      listView: 'List view',
      gridView: 'Grid view',
      searchingAllFolders: (count) => `Searching all folders (${count})`,
      noMatchingFiles: 'No matching files found.',
      emptyFolder: 'This folder is empty.',
      workspace: 'Workspace',
      expand: 'Expand',
      expandPreview: 'Expand preview',
      selectFile: 'Select a file to inspect its contents.',
    },
    notes: {
      headerTitle: 'Incident Log',
      newButton: 'New',
      newNoteButton: '+ New Note',
      newNoteTooltip: 'New note',
      noNotes: 'No notes yet.',
      untitledNote: 'Untitled Note',
      deleteNoteLabel: (title) => `Delete ${title}`,
      noteTitlePlaceholder: 'Note title...',
      stampTime: (time) => `Stamp Time (${time})`,
      stampTimeTitle: 'Insert current in-world timestamp at cursor',
      contentPlaceholder:
        'Record observations, badge IDs, timestamps, or response decisions...',
      updatedAt: (time) => `Updated ${time}`,
      stats: (words, lines) => `${words} words · ${lines} lines · Autosaved`,
      emptyState: 'Create a note to start logging shift details.',
      defaultNoteTitle: 'Shift Notes',
      newNoteTitle: (count) => `Incident Note ${count}`,
    },
    startMenu: {
      defaultSubtitle: 'Workplace Terminal',
      signedInAs: (name) => `Signed in as ${name}`,
      applications: 'Applications',
      scenario: 'Scenario',
      switchScenario: 'Switch Scenario...',
      directorInspector: 'Director / Debug Inspector',
      on: 'ON',
      off: 'OFF',
      resetProgress: 'Reset Progress',
      restartPrompt: 'Restart scenario?',
      cancel: 'Cancel',
      reset: 'Reset',
      signOut: 'Sign Out',
    },
    taskbar: {
      startMenuTooltip: (osName) => `${osName} Menu`,
      startMenuAria: (osName) => `${osName} Start Menu`,
      directorShort: 'Director',
      pendingReply: 'Reply waiting',
    },
    systemTray: {
      unmuteAudio: 'Unmute audio',
      muteAudio: 'Mute audio',
      notifications: 'Notifications',
      clearUnread: 'Clear unread',
      noNotifications: 'No new notifications.',
    },
    notifications: {
      newFileTitle: 'New File Available',
      newFileBody: (name, folderLabel) => `${name} added to ${folderLabel}`,
      newEmailTitle: (senderName) => `New Email from ${senderName}`,
      noSubject: '(No Subject)',
      followUpSubject: '(Follow-up)',
      voiceNotePreview: (duration) => `Voice note (${duration})`,
      sentAttachment: 'Sent an attachment',
      newNoteTitle: 'New Note Added',
    },
    shared: {
      open: 'Open',
      openFile: 'Open File',
      simulated: 'Simulated',
      hide: 'Hide',
      transcript: 'Transcript',
      autoTranscript: 'Auto-Transcript',
      pauseVoiceNote: 'Pause voice note',
      playVoiceNote: 'Play voice note',
      audioProgress: 'Audio playback progress',
      loadingDocument: 'Loading document...',
      copyToClipboard: 'Click to copy',
      copied: 'Copied',
    },
    selector: {
      initializing: 'Initializing workspace...',
      workstationTitle: 'Curu-OS Workstation',
      accessRestricted: 'Access Restricted',
      enterPasswordPrompt:
        'Enter your access password to unlock available scenarios.',
      accessPassword: 'Access Password',
      enterPasswordPlaceholder: 'Enter password...',
      hidePassword: 'Hide password',
      showPassword: 'Show password',
      verifying: 'Verifying...',
      unlockWorkstation: 'Unlock Workstation',
      selectScenarioPrompt: 'Select a scenario to start your shift',
      scenarioCount: (count) =>
        `${count} ${count === 1 ? 'Scenario' : 'Scenarios'}`,
      signOut: 'Sign Out',
      retry: 'Retry',
      noScenariosFound: 'No scenarios were found in the scenario index.',
      availableScenarios: 'Available Scenarios',
      inProgress: 'In Progress',
      savedSessionAvailable: 'Saved Session Available',
      signedInAsPrefix: 'Signed in as',
      resumeSession: 'Resume Session',
      startFresh: 'Start Fresh',
      required: 'Required',
      launching: 'Launching...',
      startScenario: 'Start Scenario',
      backToResume: 'Back to Resume',
      loadingScenario: 'Loading scenario...',
    },
  },
  nl: {
    apps: {
      messages: 'Berichten',
      mail: 'Mail',
      explorer: 'Bestanden',
      notes: 'Notities',
      director: 'Director Inspector',
    },
    folders: {
      Documents: 'Documenten',
      Images: 'Afbeeldingen',
      'Voice Notes': 'Spraakberichten',
      Downloads: 'Downloads',
    },
    fileKinds: {
      markdown: 'Document',
      image: 'Afbeelding',
      audio: 'Audio',
      text: 'Tekst',
    },
    timeOfDay: {
      morning: 'Ochtend',
      midday: 'Middag',
      afternoon: 'Namiddag',
      evening: 'Avond',
      night: 'Nacht',
    },
    desktop: {
      loadingWorkspace: 'Werkomgeving laden...',
      scenarioLoadError: 'Fout bij laden van scenario',
      retryScenario: 'Scenario opnieuw proberen',
      dismissNotification: 'Melding sluiten',
    },
    window: {
      minimize: (title) => `${title} minimaliseren`,
      restore: 'Venster herstellen',
      maximize: 'Venster maximaliseren',
      close: (title) => `${title} sluiten`,
    },
    messages: {
      contacts: 'Contacten',
      pinned: 'Vastgezet',
      colleagues: 'Collega’s',
      internalChat: 'Interne chat',
      voiceMessagePreview: 'Spraakbericht',
      attachmentPreview: 'Bestand verzonden',
      noMessagesWith: (name) => `Nog geen berichten met ${name}.`,
      chooseReply: 'Kies een antwoord',
      typeReply: 'Typ een antwoord',
      inputPlaceholder: 'Typ je antwoord...',
      sendButton: 'Versturen',
      isTyping: (name) => `${name} is aan het typen...`,
      hookAudio: 'Beluister het spraakbericht om door te gaan.',
      hookEmail: 'Open en lees de binnengekomen e-mail in Mail om door te gaan.',
      hookNote: 'Open de notitie in Notities om door te gaan.',
      hookFile: 'Open het gedeelde bestand in Bestanden om door te gaan.',
      waitingInMail: 'Er wacht een antwoord in Mail.',
      waitingInChat: (name) => `Er wacht een antwoord in de chat met ${name}`,
      replyBadge: 'Antwoord',
      activeInOtherThread: 'Het actieve gesprek bevindt zich in een andere chat.',
      noReplyNeeded: 'Momenteel geen reactie nodig.',
      selectContact: 'Selecteer een contact om berichten te bekijken.',
    },
    mail: {
      inbox: 'Postvak IN',
      unreadBadge: (count) => `${count} ongelezen`,
      searchPlaceholder: 'Zoek in e-mail...',
      clearSearch: 'Zoekopdracht wissen',
      filters: {
        all: 'alle',
        unread: 'ongelezen',
        flagged: 'gemarkeerd',
      },
      emptyInbox: 'Je postvak is momenteel leeg.',
      noMatchingEmails: 'Geen e-mails komen overeen met je filter.',
      toggleFlag: 'Markering wisselen',
      flag: 'Markeren',
      flagged: 'Gemarkeerd',
      toLabel: 'Aan:',
      you: 'Jij',
      staff: 'Medewerker',
      attachments: (count) => `Bijlagen (${count})`,
      sentReply: 'Verzonden antwoord',
      sendingReply: 'Antwoord verzenden...',
      syncingInbox: 'Synchroniseren...',
      replyActions: 'Antwoordopties',
      send: 'Versturen',
      selectEmail: 'Selecteer een e-mail om te lezen.',
    },
    explorer: {
      thisDesk: 'Werkplek',
      searchPlaceholder: 'Zoek in alle bestanden...',
      clearSearch: 'Zoekopdracht wissen',
      listView: 'Lijstweergave',
      gridView: 'Rasterweergave',
      searchingAllFolders: (count) => `Zoeken in alle mappen (${count})`,
      noMatchingFiles: 'Geen overeenkomende bestanden gevonden.',
      emptyFolder: 'Deze map is leeg.',
      workspace: 'Werkomgeving',
      expand: 'Uitvouwen',
      expandPreview: 'Voorbeeld uitvouwen',
      selectFile: 'Selecteer een bestand om de inhoud te bekijken.',
    },
    notes: {
      headerTitle: 'Notities',
      newButton: 'Nieuw',
      newNoteButton: '+ Nieuwe notitie',
      newNoteTooltip: 'Nieuwe notitie',
      noNotes: 'Nog geen notities.',
      untitledNote: 'Naamloze notitie',
      deleteNoteLabel: (title) => `${title} verwijderen`,
      noteTitlePlaceholder: 'Titel van notitie...',
      stampTime: (time) => `Tijdstempel (${time})`,
      stampTimeTitle: 'Voeg huidige tijdstempel in op cursorpositie',
      contentPlaceholder:
        'Noteer observaties, pasnummers, tijdstippen of vervolgstappen...',
      updatedAt: (time) => `Bijgewerkt om ${time}`,
      stats: (words, lines) =>
        `${words} woorden · ${lines} regels · Automatisch opgeslagen`,
      emptyState: 'Maak een notitie aan om bevindingen vast te leggen.',
      defaultNoteTitle: 'Werknotities',
      newNoteTitle: (count) => `Notitie ${count}`,
    },
    startMenu: {
      defaultSubtitle: 'Werkplekterminal',
      signedInAs: (name) => `Ingelogd als ${name}`,
      applications: 'Toepassingen',
      scenario: 'Scenario',
      switchScenario: 'Scenario wisselen...',
      directorInspector: 'Director / Debug Inspector',
      on: 'AAN',
      off: 'UIT',
      resetProgress: 'Voortgang resetten',
      restartPrompt: 'Scenario herstarten?',
      cancel: 'Annuleren',
      reset: 'Resetten',
      signOut: 'Uitloggen',
    },
    taskbar: {
      startMenuTooltip: (osName) => `${osName}-menu`,
      startMenuAria: (osName) => `${osName}-startmenu`,
      directorShort: 'Director',
      pendingReply: 'Antwoord wacht',
    },
    systemTray: {
      unmuteAudio: 'Geluid aanzetten',
      muteAudio: 'Geluid dempen',
      notifications: 'Meldingen',
      clearUnread: 'Ongelezen wissen',
      noNotifications: 'Geen nieuwe meldingen.',
    },
    notifications: {
      newFileTitle: 'Nieuw bestand beschikbaar',
      newFileBody: (name, folderLabel) => `${name} toegevoegd aan ${folderLabel}`,
      newEmailTitle: (senderName) => `Nieuwe e-mail van ${senderName}`,
      noSubject: '(Geen onderwerp)',
      followUpSubject: '(Vervolg)',
      voiceNotePreview: (duration) => `Spraakbericht (${duration})`,
      sentAttachment: 'Bijlage verzonden',
      newNoteTitle: 'Nieuwe notitie toegevoegd',
    },
    shared: {
      open: 'Openen',
      openFile: 'Bestand openen',
      simulated: 'Gesimuleerd',
      hide: 'Verbergen',
      transcript: 'Transcript',
      autoTranscript: 'Automatisch transcript',
      pauseVoiceNote: 'Spraakbericht pauzeren',
      playVoiceNote: 'Spraakbericht afspelen',
      audioProgress: 'Voortgang van audio',
      loadingDocument: 'Document laden...',
      copyToClipboard: 'Klik om te kopiëren',
      copied: 'Gekopieerd',
    },
    selector: {
      initializing: 'Werkomgeving initialiseren...',
      workstationTitle: 'Curu-OS Werkstation',
      accessRestricted: 'Toegang beperkt',
      enterPasswordPrompt:
        'Voer je toegangswachtwoord in om beschikbare scenario’s te ontgrendelen.',
      accessPassword: 'Toegangswachtwoord',
      enterPasswordPlaceholder: 'Voer wachtwoord in...',
      hidePassword: 'Wachtwoord verbergen',
      showPassword: 'Wachtwoord tonen',
      verifying: 'Controleren...',
      unlockWorkstation: 'Werkstation ontgrendelen',
      selectScenarioPrompt: 'Selecteer een scenario om te beginnen',
      scenarioCount: (count) =>
        `${count} ${count === 1 ? 'scenario' : 'scenario’s'}`,
      signOut: 'Uitloggen',
      retry: 'Opnieuw',
      noScenariosFound: 'Geen scenario’s gevonden in de scenario-index.',
      availableScenarios: 'Beschikbare scenario’s',
      inProgress: 'Bezig',
      savedSessionAvailable: 'Opgeslagen sessie beschikbaar',
      signedInAsPrefix: 'Ingelogd als',
      resumeSession: 'Sessie hervatten',
      startFresh: 'Opnieuw beginnen',
      required: 'Verplicht',
      launching: 'Starten...',
      startScenario: 'Scenario starten',
      backToResume: 'Terug naar hervatten',
      loadingScenario: 'Scenario laden...',
    },
  },
};

export function getTranslations(locale?: ScenarioLocale | null): UiTranslations {
  return TRANSLATIONS[resolveLocale(locale)];
}

export function getLocalizedTimeOfDay(
  totalMinutes: number,
  locale?: ScenarioLocale | null
): string {
  const t = getTranslations(locale).timeOfDay;
  const wrapped = ((Math.floor(totalMinutes) % 1440) + 1440) % 1440;
  const hour = Math.floor(wrapped / 60);
  if (hour >= 5 && hour < 12) return t.morning;
  if (hour >= 12 && hour < 14) return t.midday;
  if (hour >= 14 && hour < 18) return t.afternoon;
  if (hour >= 18 && hour < 22) return t.evening;
  return t.night;
}

export function selectLocale(state: {
  manifest: { locale?: ScenarioLocale } | null;
}): ScenarioLocale {
  return resolveLocale(state.manifest?.locale);
}

export function selectTranslations(state: {
  manifest: { locale?: ScenarioLocale } | null;
}): UiTranslations {
  return getTranslations(state.manifest?.locale);
}
