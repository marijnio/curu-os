export type ScenarioLocale = 'en' | 'nl';

export interface ScenarioIndexEntry {
  id: string;
  title?: string;
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  email: string;
  avatarColor: string;
  avatarInitials: string;
  pinned?: boolean;
  status?: 'online' | 'away' | 'offline';
  hiddenByDefault?: boolean;
}

export type FolderName = 'Documents' | 'Images' | 'Voice Notes' | 'Downloads';
export type FileKind = 'markdown' | 'image' | 'audio' | 'text';

export interface FileCatalogEntry {
  path: string;
  name: string;
  folder: FolderName;
  kind: FileKind;
  sizeLabel?: string;
  duration?: string;
  transcript?: string;
  unlockedByDefault?: boolean;
}

export interface ScenarioTheme {
  osName?: string;
  osVersion?: string;
  windowTitle?: string;
  wallpaperColor?: string;
  wallpaperImage?: string;
}

export interface PlayerPromptConfig {
  enabled?: boolean;
  variableName?: string;
  label?: string;
  placeholder?: string;
  helperText?: string;
  defaultValue?: string;
  required?: boolean;
}

export interface InitialNoteEntry {
  id?: string;
  title: string;
  content: string;
  updatedAt?: string;
}

export interface ScenarioManifest {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  locale?: ScenarioLocale;
  startTime: string;
  dayLabel: string;
  storyFile: string;
  theme?: ScenarioTheme;
  playerPrompt?: PlayerPromptConfig;
  contacts: Contact[];
  files: FileCatalogEntry[];
  initialNotes?: InitialNoteEntry[];
}
