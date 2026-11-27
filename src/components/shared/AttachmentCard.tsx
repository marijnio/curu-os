import { FileText, Image as ImageIcon, Mic, ExternalLink, File } from 'lucide-react';
import { inferFileMeta, normalizeScenarioPath } from '../../engine/tagParser';
import { useOsStore } from '../../store/useOsStore';

interface AttachmentCardProps {
  path: string;
  compact?: boolean;
}

export function AttachmentCard({ path, compact = false }: AttachmentCardProps) {
  const normalized = normalizeScenarioPath(path);
  const files = useOsStore((s) => s.files);
  const manifest = useOsStore((s) => s.manifest);
  const openFileInExplorer = useOsStore((s) => s.openFileInExplorer);

  const file =
    files.find((f) => f.id === normalized) ??
    manifest?.files.find((f) => normalizeScenarioPath(f.path) === normalized);
  const fallback = inferFileMeta(normalized);

  const name = file?.name ?? fallback.name;
  const kind = file?.kind ?? fallback.kind;
  const folder = file?.folder ?? fallback.folder;

  const Icon =
    kind === 'markdown'
      ? FileText
      : kind === 'image'
        ? ImageIcon
        : kind === 'audio'
          ? Mic
          : File;

  return (
    <button
      type="button"
      onClick={() => openFileInExplorer(normalized)}
      className={`group flex w-full items-center justify-between gap-3 rounded-lg border border-slate-700/80 bg-slate-900/85 text-left transition hover:border-sky-500/60 hover:bg-slate-800/90 cursor-pointer ${
        compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-500/15 text-sky-400 border border-sky-500/20">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-slate-100 group-hover:text-sky-200">
            {name}
          </div>
          <div className="truncate text-[11px] text-slate-400">
            {folder} · {kind === 'markdown' ? 'Document' : kind.toUpperCase()}
          </div>
        </div>
      </div>

      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-sky-400 opacity-80 group-hover:opacity-100">
        Open
        <ExternalLink className="h-3 w-3" />
      </span>
    </button>
  );
}
