import type { Channel } from '../types/narrative';
import type { FileKind, FolderName } from '../types/scenario';

export interface ParsedVoiceNoteTag {
  path: string;
  duration: string;
  transcript?: string;
}

export interface ParsedFileUnlockTag {
  path: string;
  folder?: FolderName;
  name?: string;
}

export interface ParsedEventHookTag {
  event: 'on_file_open';
  targetPath: string;
  resumeMode: 'continue' | 'knot';
  targetKnot?: string;
}

export interface ParsedTagBundle {
  channel?: Channel;
  sender?: string;
  subject?: string;
  voiceNote?: ParsedVoiceNoteTag;
  attachments: string[];
  fileUnlocks: ParsedFileUnlockTag[];
  advanceMinutes: number;
  eventHooks: ParsedEventHookTag[];
  flagEmail: boolean;
  typingDelayMs?: number;
  silent: boolean;
  unknownTags: string[];
}

export function normalizeScenarioPath(rawPath: string): string {
  return rawPath.trim().replace(/^(\.\/|\/)+/, '').replace(/\\/g, '/');
}

export function parseClockMinutes(hhmm: string): number {
  const match = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(hhmm);
  if (!match) return 9 * 60;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 9 * 60;
  return hours * 60 + minutes;
}

export function formatClock(totalMinutes: number): string {
  const wrapped = ((Math.floor(totalMinutes) % 1440) + 1440) % 1440;
  const hours24 = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${String(hours12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${period}`;
}

export function formatClock24(totalMinutes: number): string {
  const wrapped = ((Math.floor(totalMinutes) % 1440) + 1440) % 1440;
  const hours24 = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  return `${String(hours24).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function getTimeOfDay(totalMinutes: number): string {
  const wrapped = ((Math.floor(totalMinutes) % 1440) + 1440) % 1440;
  const hour = Math.floor(wrapped / 60);
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 14) return 'Midday';
  if (hour >= 14 && hour < 18) return 'Afternoon';
  if (hour >= 18 && hour < 22) return 'Evening';
  return 'Night';
}

export function inferFileMeta(relativePath: string): {
  name: string;
  kind: FileKind;
  folder: FolderName;
} {
  const normalized = normalizeScenarioPath(relativePath);
  const parts = normalized.split('/');
  const name = parts[parts.length - 1] || normalized;
  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() ?? '' : '';

  if (ext === 'md' || ext === 'markdown') {
    return { name, kind: 'markdown', folder: 'Documents' };
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return { name, kind: 'image', folder: 'Images' };
  }
  if (['mp3', 'ogg', 'wav', 'm4a', 'webm'].includes(ext)) {
    return { name, kind: 'audio', folder: 'Voice Notes' };
  }
  return { name, kind: 'text', folder: 'Documents' };
}

function splitKeyColon(segment: string): { key: string; value: string } | null {
  const idx = segment.indexOf(':');
  if (idx === -1) return null;
  return {
    key: segment.slice(0, idx).trim().toUpperCase(),
    value: segment.slice(idx + 1).trim(),
  };
}

function parseFolderName(raw?: string): FolderName | undefined {
  if (!raw) return undefined;
  const lower = raw.trim().toLowerCase();
  if (lower === 'documents') return 'Documents';
  if (lower === 'images') return 'Images';
  if (lower === 'voice notes' || lower === 'voice_notes') return 'Voice Notes';
  if (lower === 'downloads') return 'Downloads';
  return undefined;
}

export function parseInkTags(rawTags: string[]): ParsedTagBundle {
  const bundle: ParsedTagBundle = {
    attachments: [],
    fileUnlocks: [],
    advanceMinutes: 0,
    eventHooks: [],
    flagEmail: false,
    silent: false,
    unknownTags: [],
  };

  for (const raw of rawTags) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const bareUpper = trimmed.toUpperCase();
    if (bareUpper === 'FLAG_EMAIL') {
      bundle.flagEmail = true;
      continue;
    }
    if (bareUpper === 'SILENT') {
      bundle.silent = true;
      continue;
    }

    const parts = trimmed.split('|').map((p) => p.trim()).filter(Boolean);
    const primary = splitKeyColon(parts[0] ?? trimmed);
    if (!primary) {
      bundle.unknownTags.push(trimmed);
      continue;
    }

    const { key, value } = primary;

    switch (key) {
      case 'CHANNEL': {
        const ch = value.toLowerCase();
        if (ch === 'chat' || ch === 'email') {
          bundle.channel = ch;
        } else {
          bundle.unknownTags.push(trimmed);
        }
        break;
      }
      case 'SENDER': {
        if (value) bundle.sender = value;
        break;
      }
      case 'SUBJECT': {
        if (value) bundle.subject = value;
        break;
      }
      case 'VOICE_NOTE': {
        const path = normalizeScenarioPath(value);
        if (!path) break;
        let duration = '0:15';
        let transcript: string | undefined;

        for (const extra of parts.slice(1)) {
          const kv = splitKeyColon(extra);
          if (!kv) continue;
          if (kv.key === 'DURATION' && kv.value) {
            duration = kv.value;
          } else if (kv.key === 'TRANSCRIPT' && kv.value) {
            transcript = kv.value;
          }
        }
        bundle.voiceNote = { path, duration, transcript };
        break;
      }
      case 'ATTACHMENT': {
        const path = normalizeScenarioPath(value);
        if (path) bundle.attachments.push(path);
        break;
      }
      case 'FILE_UNLOCK': {
        const path = normalizeScenarioPath(value);
        if (!path) break;
        let folder: FolderName | undefined;
        let name: string | undefined;
        for (const extra of parts.slice(1)) {
          const kv = splitKeyColon(extra);
          if (!kv) continue;
          if (kv.key === 'FOLDER') folder = parseFolderName(kv.value);
          if (kv.key === 'NAME' && kv.value) name = kv.value;
        }
        bundle.fileUnlocks.push({ path, folder, name });
        break;
      }
      case 'ADVANCE_TIME': {
        const mins = Number.parseInt(value, 10);
        if (!Number.isNaN(mins) && mins > 0) {
          bundle.advanceMinutes += mins;
        }
        break;
      }
      case 'EVENT_HOOK': {
        // Supports:
        // on_file_open:<path>
        // on_file_open:<path> => <knot>  (recommended in .ink since -> is an Ink divert)
        // on_file_open:<path> -> <knot>
        const hookMatch = /^on_file_open:(.+?)(?:\s*(?:=>|->)\s*([A-Za-z0-9_.]+))?$/i.exec(value);
        if (hookMatch) {
          const targetPath = normalizeScenarioPath(hookMatch[1]);
          const targetKnot = hookMatch[2]?.trim();
          bundle.eventHooks.push({
            event: 'on_file_open',
            targetPath,
            resumeMode: targetKnot ? 'knot' : 'continue',
            targetKnot,
          });
        } else {
          bundle.unknownTags.push(trimmed);
        }
        break;
      }
      case 'TYPING_DELAY': {
        const ms = Number.parseInt(value, 10);
        if (!Number.isNaN(ms) && ms >= 0) {
          bundle.typingDelayMs = ms;
        }
        break;
      }
      default: {
        bundle.unknownTags.push(trimmed);
      }
    }
  }

  return bundle;
}
