import { FileText, Image as ImageIcon, Mic, ExternalLink, File } from 'lucide-react';
import { selectTranslations } from '../../engine/i18n';
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
  const t = useOsStore(selectTranslations);

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
      className={`group flex w-full items-center justify-between gap-3 rounded-md border border-slate-300 bg-white text-left transition hover:border-[#0067c0] hover:bg-[#f0f7ff] cursor-pointer ${
        compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-200 bg-[#f4f6f8] text-[#0067c0]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-slate-800 group-hover:text-[#004e96]">
            {name}
          </div>
          <div className="truncate text-[11px] text-slate-500">
            {t.folders[folder]} · {t.fileKinds[kind]}
          </div>
        </div>
      </div>

      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[#0067c0]">
        {t.shared.open}
        <ExternalLink className="h-3 w-3" />
      </span>
    </button>
  );
}
