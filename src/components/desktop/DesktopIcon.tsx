import type { ReactNode } from 'react';

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
      className={`group relative flex w-22 flex-col items-center gap-1.5 rounded-xl p-2.5 text-center transition select-none cursor-pointer ${
        selected
          ? 'bg-sky-500/20 ring-1 ring-sky-400/50 backdrop-blur-sm'
          : 'hover:bg-slate-800/45'
      }`}
    >
      <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700/70 bg-slate-900/80 shadow-lg transition group-hover:border-slate-500/70">
        {icon}
        {badgeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </div>
      <span className="text-xs font-medium text-slate-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] leading-tight">
        {label}
      </span>
    </button>
  );
}
