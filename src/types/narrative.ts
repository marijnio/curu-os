export type Channel = 'chat' | 'email';

export interface ChatMessage {
  id: string;
  contactId: string;
  sender: 'contact' | 'player' | 'system';
  kind: 'text' | 'voice_note' | 'attachment';
  text: string;
  timestamp: string;
  attachmentPath?: string;
  voiceNote?: {
    path: string;
    duration: string;
    transcript?: string;
  };
}

export interface EmailReplyRecord {
  text: string;
  sentAt: string;
}

export interface EmailMessage {
  id: string;
  senderId: string;
  subject: string;
  body: string[];
  timestamp: string;
  read: boolean;
  flagged: boolean;
  attachments: string[];
  replies: EmailReplyRecord[];
}

export interface ActiveChoice {
  index: number;
  text: string;
  channel: Channel;
  targetId: string;
  silent?: boolean;
}

export interface PendingChatInput {
  variableName: string;
  placeholder?: string;
  buttonLabel?: string;
  targetContactId: string;
  targetKnot: string;
}

export type EventHookType =
  | 'on_file_open'
  | 'on_audio_play'
  | 'on_email_read'
  | 'on_note_open';

export interface EventHook {
  id: string;
  event: EventHookType;
  target: string;
  resumeMode: 'continue' | 'knot';
  targetKnot?: string;
  registeredAt: string;
}

export interface DebugLogEntry {
  id: string;
  time: string;
  realTime: string;
  type:
    | 'ink_line'
    | 'tag'
    | 'choice'
    | 'input'
    | 'hook_registered'
    | 'hook_fired'
    | 'file_open'
    | 'audio_play'
    | 'email_read'
    | 'note_open'
    | 'checkpoint'
    | 'director'
    | 'error';
  summary: string;
  detail?: unknown;
}
