import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';

interface DesktopIconProps {
  label: string;
  icon: ReactNode;
  badgeCount?: number;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}

export function DesktopIcon({
  label,
  icon,
  badgeCount = 0,
  selected,
  onSelect,
  onOpen,
}: DesktopIconProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className={`group relative flex w-20 flex-col items-center gap-1 rounded-[2px] border px-1.5 py-2 text-center select-none cursor-default ${
        selected
          ? 'border-white/45 bg-white/20'
          : 'border-transparent hover:border-white/25 hover:bg-white/10'
      }`}
    >
      <div className="relative flex h-11 w-11 items-center justify-center">
        {icon}
        {/* Classic shortcut arrow badge */}
        <span className="absolute bottom-0 left-0 flex h-3.5 w-3.5 items-center justify-center rounded-[1px] border border-slate-500/80 bg-white shadow-xs">
          <ArrowUpRight className="h-2.5 w-2.5 text-[#005fb8] stroke-[2.5]" />
        </span>

        {badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d93025] px-1 text-[10px] font-bold text-white shadow">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </div>

      <span className="text-[11.5px] leading-tight font-normal text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
        {label}
      </span>
    </button>
  );
}
