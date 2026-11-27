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

export interface EventHook {
  id: string;
  event: 'on_file_open';
  targetPath: string;
  resumeMode: 'continue' | 'knot';
  targetKnot?: string;
  registeredAt: string;
}

export interface DebugLogEntry {
  id: string;
  time: string;
  type:
    | 'ink_line'
    | 'tag'
    | 'choice'
    | 'hook_registered'
    | 'hook_fired'
    | 'file_open'
    | 'error';
  summary: string;
  detail?: unknown;
}
