import { useRef } from 'react';
import { Clock, Plus, StickyNote, Trash2 } from 'lucide-react';
import { selectTranslations } from '../../engine/i18n';
import { formatClock24 } from '../../engine/tagParser';
import { useOsStore } from '../../store/useOsStore';

export function NotesApp() {
  const notes = useOsStore((s) => s.notes);
  const activeNoteId = useOsStore((s) => s.activeNoteId);
  const clockMinutes = useOsStore((s) => s.clockMinutes);
  const dayLabel = useOsStore((s) => s.dayLabel);

  const selectNote = useOsStore((s) => s.selectNote);
  const createNote = useOsStore((s) => s.createNote);
  const updateNote = useOsStore((s) => s.updateNote);
  const deleteNote = useOsStore((s) => s.deleteNote);
  const t = useOsStore(selectTranslations);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const activeNote =
    notes.find((n) => n.id === activeNoteId) ?? notes[0] ?? null;

  const handleStampTime = () => {
    if (!activeNote) return;
    const stamp = `[${formatClock24(clockMinutes)}] `;
    const el = textareaRef.current;

    if (!el) {
      updateNote(activeNote.id, { content: `${activeNote.content}${stamp}` });
      return;
    }

    const start = el.selectionStart ?? activeNote.content.length;
    const end = el.selectionEnd ?? activeNote.content.length;
    const nextContent =
      activeNote.content.slice(0, start) +
      stamp +
      activeNote.content.slice(end);

    updateNote(activeNote.id, { content: nextContent });

    window.requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      const nextCursor = start + stamp.length;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const wordCount = activeNote?.content.trim()
    ? activeNote.content.trim().split(/\s+/).length
    : 0;
  const lineCount = activeNote
    ? activeNote.content.split(/\r?\n/).length
    : 0;

  return (
    <div className="flex h-full w-full bg-white text-slate-900">
      {/* Left Sidebar: Notes List */}
      <aside className="flex w-52 shrink-0 flex-col border-r border-slate-200 bg-[#f7f8fa]">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            <StickyNote className="h-3.5 w-3.5 text-amber-600" />
            {t.notes.headerTitle}
          </div>
          <button
            type="button"
            onClick={() => createNote()}
            title={t.notes.newNoteTooltip}
            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <Plus className="h-3 w-3" />
            {t.notes.newButton}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {notes.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              {t.notes.noNotes}
            </div>
          ) : (
            notes.map((note) => {
              const isSelected = activeNote?.id === note.id;
              return (
                <div
                  key={note.id}
                  onClick={() => selectNote(note.id)}
                  className={`group flex items-start justify-between gap-1.5 rounded-[3px] px-2.5 py-2 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#e6f0fa] ring-1 ring-[#99c8f2]'
                      : 'hover:bg-slate-200/60'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-slate-900">
                      {note.title || t.notes.untitledNote}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-slate-500">
                      <span>{note.updatedAt}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNote(note.id);
                    }}
                    aria-label={t.notes.deleteNoteLabel(
                      note.title || t.notes.untitledNote
                    )}
                    className="rounded p-1 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-rose-100 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Editor */}
      <section className="flex flex-1 min-w-0 flex-col bg-white">
        {activeNote ? (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-[#f8f9fa] px-4 py-2">
              <input
                type="text"
                value={activeNote.title}
                onChange={(e) =>
                  updateNote(activeNote.id, { title: e.target.value })
                }
                placeholder={t.notes.noteTitlePlaceholder}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={handleStampTime}
                title={t.notes.stampTimeTitle}
                className="inline-flex shrink-0 items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-[#0067c0] hover:bg-[#eef6fc] hover:text-[#004e96] cursor-pointer"
              >
                <Clock className="h-3 w-3 text-[#0067c0]" />
                {t.notes.stampTime(formatClock24(clockMinutes))}
              </button>
            </header>

            <textarea
              ref={textareaRef}
              value={activeNote.content}
              onChange={(e) =>
                updateNote(activeNote.id, { content: e.target.value })
              }
              placeholder={t.notes.contentPlaceholder}
              className="flex-1 w-full resize-none bg-white p-4 font-mono text-[13px] leading-relaxed text-slate-800 outline-none placeholder:text-slate-400"
            />

            <footer className="flex items-center justify-between border-t border-slate-200 bg-[#f8f9fa] px-4 py-1.5 text-[11px] text-slate-500">
              <span>
                {dayLabel} · {t.notes.updatedAt(activeNote.updatedAt)}
              </span>
              <span className="font-mono">
                {t.notes.stats(wordCount, lineCount)}
              </span>
            </footer>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-xs text-slate-400">
            <StickyNote className="h-8 w-8 opacity-35" />
            <p>{t.notes.emptyState}</p>
            <button
              type="button"
              onClick={() => createNote()}
              className="mt-1 rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {t.notes.newNoteButton}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
