import type { Channel } from './narrative';
import type { FileCatalogEntry } from './scenario';

export type AppId = 'messages' | 'mail' | 'explorer' | 'director';

export interface WindowState {
  id: AppId;
  title: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export interface VirtualFile extends FileCatalogEntry {
  id: string;
  unlockedAt: string;
  opened: boolean;
  receivedVia?: {
    channel: Channel;
    senderId: string;
  };
}

export interface ToastNotification {
  id: string;
  appId: AppId;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  actionTarget?: {
    contactId?: string;
    emailId?: string;
    filePath?: string;
  };
}
