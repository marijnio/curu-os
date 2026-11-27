import { useRef, type ReactNode } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import type { WindowState } from '../../types/os';
import { useOsStore } from '../../store/useOsStore';

interface WindowProps {
  windowState: WindowState;
  icon: ReactNode;
  children: ReactNode;
}

export function Window({ windowState, icon, children }: WindowProps) {
  const focusedApp = useOsStore((s) => s.focusedApp);
  const focusApp = useOsStore((s) => s.focusApp);
  const closeApp = useOsStore((s) => s.closeApp);
  const minimizeApp = useOsStore((s) => s.minimizeApp);
  const toggleMaximizeApp = useOsStore((s) => s.toggleMaximizeApp);
  const moveWindow = useOsStore((s) => s.moveWindow);

  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    originX: number;
    originY: number;
  } | null>(null);

  if (!windowState.isOpen || windowState.isMinimized) {
    return null;
  }

  const isFocused = focusedApp === windowState.id;

  const handleTitlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    focusApp(windowState.id);
    if (windowState.isMaximized) return;

    const header = e.currentTarget;
    header.setPointerCapture(e.pointerId);

    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      originX: windowState.position.x,
      originY: windowState.position.y,
    };
  };

  const handleTitlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current || windowState.isMaximized) return;

    const dx = e.clientX - dragStartRef.current.pointerX;
    const dy = e.clientY - dragStartRef.current.pointerY;

    const maxX = Math.max(80, window.innerWidth - 160);
    const maxY = Math.max(80, window.innerHeight - 80);

    const nextX = Math.max(
      -windowState.size.width + 180,
      Math.min(maxX, dragStartRef.current.originX + dx)
    );
    const nextY = Math.max(0, Math.min(maxY, dragStartRef.current.originY + dy));

    moveWindow(windowState.id, { x: nextX, y: nextY });
  };

  const handleTitlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current) {
      dragStartRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  const style: React.CSSProperties = windowState.isMaximized
    ? {
        top: 0,
        left: 0,
        right: 0,
        bottom: 40,
        zIndex: windowState.zIndex,
      }
    : {
        left: windowState.position.x,
        top: windowState.position.y,
        width: `min(${windowState.size.width}px, calc(100vw - 24px))`,
        height: `min(${windowState.size.height}px, calc(100vh - 56px))`,
        zIndex: windowState.zIndex,
      };

  return (
    <div
      style={style}
      onPointerDown={() => focusApp(windowState.id)}
      className={`fixed flex flex-col overflow-hidden border bg-white text-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.42)] ${
        windowState.isMaximized ? 'rounded-none border-none' : 'rounded-[3px]'
      } ${isFocused ? 'border-[#2b3b55]' : 'border-[#94a3b8]'}`}
    >
      {/* Flat Light Desktop Title Bar */}
      <div
        onPointerDown={handleTitlePointerDown}
        onPointerMove={handleTitlePointerMove}
        onPointerUp={handleTitlePointerUp}
        onDoubleClick={(e) => {
          if (!(e.target as HTMLElement).closest('button')) {
            toggleMaximizeApp(windowState.id);
          }
        }}
        className={`flex h-8 shrink-0 items-center justify-between border-b border-slate-200 pl-2.5 select-none ${
          windowState.isMaximized ? 'cursor-default' : 'cursor-default'
        } ${
          isFocused
            ? 'bg-white text-slate-800'
            : 'bg-[#f1f3f5] text-slate-500'
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-normal">
          <span className="flex items-center">{icon}</span>
          <span>{windowState.title}</span>
        </div>

        <div className="flex h-full items-stretch">
          <button
            type="button"
            onClick={() => minimizeApp(windowState.id)}
            aria-label={`Minimize ${windowState.title}`}
            className="flex h-8 w-11 items-center justify-center text-slate-700 transition-colors hover:bg-slate-200/80 hover:text-slate-950"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => toggleMaximizeApp(windowState.id)}
            aria-label={windowState.isMaximized ? 'Restore window' : 'Maximize window'}
            className="flex h-8 w-11 items-center justify-center text-slate-700 transition-colors hover:bg-slate-200/80 hover:text-slate-950"
          >
            {windowState.isMaximized ? (
              <Copy className="h-3 w-3" />
            ) : (
              <Square className="h-3 w-3" />
            )}
          </button>
          <button
            type="button"
            onClick={() => closeApp(windowState.id)}
            aria-label={`Close ${windowState.title}`}
            className="flex h-8 w-11 items-center justify-center text-slate-700 transition-colors hover:bg-[#e81123] hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* App Content */}
      <div className="flex-1 min-h-0 overflow-hidden bg-white">
        {children}
      </div>
    </div>
  );
}
