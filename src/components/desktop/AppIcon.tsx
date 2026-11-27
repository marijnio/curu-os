import { Bug, Folder, Mail, MessageSquare, StickyNote } from 'lucide-react';
import type { AppId } from '../../types/os';

interface AppIconProps {
  appId: AppId;
  className?: string;
}

export function AppIcon({ appId, className = 'h-4 w-4' }: AppIconProps) {
  switch (appId) {
    case 'messages':
      return <MessageSquare className={`${className} fill-[#25b864] text-[#25b864]`} />;
    case 'mail':
      return <Mail className={`${className} text-[#4ca3dd]`} />;
    case 'explorer':
      return <Folder className={`${className} fill-[#eab308] text-[#ca8a04]`} />;
    case 'notes':
      return <StickyNote className={`${className} text-[#f59e0b]`} />;
    case 'director':
      return <Bug className={`${className} text-slate-300`} />;
  }
}
