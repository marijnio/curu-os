import { useState } from 'react';
import {
  Download,
  FileText,
  Folder,
  Image as ImageIcon,
  Maximize2,
  Mic,
  X,
  File,
  LayoutGrid,
  List,
} from 'lucide-react';
import type { FolderName } from '../../types/scenario';
import type { VirtualFile } from '../../types/os';
import { resolveScenarioAssetUrl } from '../../engine/scenarioLoader';
import { useOsStore } from '../../store/useOsStore';
import { MarkdownViewer } from '../shared/MarkdownViewer';
import { AudioPlayer } from '../shared/AudioPlayer';

const FOLDERS: Array<{ name: FolderName; label: string }> = [
  { name: 'Documents', label: 'Documents' },
  { name: 'Images', label: 'Images' },
  { name: 'Voice Notes', label: 'Voice Notes' },
  { name: 'Downloads', label: 'Downloads' },
];

export function FileExplorerApp() {
  const scenarioId = useOsStore((s) => s.scenarioId);
  const files = useOsStore((s) => s.files);
  const selectedFolder = useOsStore((s) => s.selectedFolder);
  const selectedFileId = useOsStore((s) => s.selectedFileId);
  const contacts = useOsStore((s) => s.contacts);

  const selectFolder = useOsStore((s) => s.selectFolder);
  const selectFile = useOsStore((s) => s.selectFile);

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [modalOpen, setModalOpen] = useState(false);

  const filesInFolder = (folder: FolderName): VirtualFile[] => {
    if (folder === 'Downloads') {
      return files.filter((f) => f.folder === 'Downloads' || Boolean(f.receivedVia));
    }
    return files.filter((f) => f.folder === folder);
  };

  const visibleFiles = filesInFolder(selectedFolder);
  const selectedFile =
    files.find((f) => f.id === selectedFileId) ?? visibleFiles[0] ?? null;

  const getFolderIcon = (folder: FolderName, active: boolean) => {
    const cls = `h-4 w-4 ${active ? 'text-amber-300' : 'text-amber-400/80'}`;
    switch (folder) {
      case 'Documents':
        return <FileText className={cls} />;
      case 'Images':
        return <ImageIcon className={cls} />;
      case 'Voice Notes':
        return <Mic className={cls} />;
      case 'Downloads':
        return <Download className={cls} />;
    }
  };

  const getFileIcon = (kind: VirtualFile['kind']) => {
    switch (kind) {
      case 'markdown':
        return <FileText className="h-4 w-4 text-sky-400" />;
      case 'image':
        return <ImageIcon className="h-4 w-4 text-emerald-400" />;
      case 'audio':
        return <Mic className="h-4 w-4 text-amber-400" />;
      default:
        return <File className="h-4 w-4 text-slate-400" />;
    }
  };

  const formatSource = (file: VirtualFile) => {
    if (!file.receivedVia) return 'Workspace';
    const sender = contacts.find((c) => c.id === file.receivedVia?.senderId);
    const channelLabel = file.receivedVia.channel === 'chat' ? 'Messages' : 'Mail';
    return `${channelLabel} · ${sender?.name ?? file.receivedVia.senderId}`;
  };

  const renderPreviewContent = (file: VirtualFile) => {
    if (file.kind === 'markdown' || file.kind === 'text') {
      return <MarkdownViewer path={file.path} />;
    }
    if (file.kind === 'image') {
      return (
        <div className="flex flex-col items-center justify-center gap-3">
          <img
            src={resolveScenarioAssetUrl(scenarioId, file.path)}
            alt={file.name}
            className="max-h-[400px] w-auto rounded-lg border border-slate-700/80 bg-slate-950 object-contain shadow-xl"
          />
          <span className="font-mono text-[11px] text-slate-400">{file.path}</span>
        </div>
      );
    }
    if (file.kind === 'audio') {
      return (
        <div className="space-y-4">
          <AudioPlayer
            path={file.path}
            durationHint={file.duration}
            transcript={file.transcript}
            variant="full"
          />
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative flex h-full w-full">
      {/* Left Sidebar: Folder Tree */}
      <aside className="flex w-48 shrink-0 flex-col border-r border-slate-800 bg-slate-900/75">
        <div className="flex items-center gap-2 border-b border-slate-800 px-3.5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Folder className="h-3.5 w-3.5 text-amber-400" />
          Folders
        </div>

        <nav className="flex-1 space-y-1 p-2">
          {FOLDERS.map((folder) => {
            const list = filesInFolder(folder.name);
            const unread = list.filter((f) => !f.opened).length;
            const active = selectedFolder === folder.name;

            return (
              <button
                key={folder.name}
                type="button"
                onClick={() => selectFolder(folder.name)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition cursor-pointer ${
                  active
                    ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30 font-semibold'
                    : 'text-slate-300 border border-transparent hover:bg-slate-800/70'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  {getFolderIcon(folder.name, active)}
                  <span className="truncate">{folder.label}</span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {unread > 0 && (
                    <span className="h-2 w-2 rounded-full bg-sky-400" />
                  )}
                  <span className="font-mono text-[10px] text-slate-500">
                    {list.length}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Center Pane: File List / Grid */}
      <section className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-950/35">
        <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
          <span className="text-xs font-semibold text-slate-200">
            {selectedFolder}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className={`rounded p-1 cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              className={`rounded p-1 cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {visibleFiles.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              Folder is empty.
            </div>
          ) : viewMode === 'list' ? (
            <div className="space-y-1">
              {visibleFiles.map((file) => {
                const isSelected = selectedFile?.id === file.id;
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => selectFile(file.id)}
                    className={`flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/15 border border-sky-500/35'
                        : 'border border-transparent hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">{getFileIcon(file.kind)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {!file.opened && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                        )}
                        <span className="truncate text-xs font-medium text-slate-100">
                          {file.name}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-slate-400">
                        {formatSource(file)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {visibleFiles.map((file) => {
                const isSelected = selectedFile?.id === file.id;
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => selectFile(file.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg p-3 text-center transition cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/15 border border-sky-500/35'
                        : 'border border-slate-800/70 bg-slate-900/40 hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="relative">
                      {getFileIcon(file.kind)}
                      {!file.opened && (
                        <span className="absolute -top-1 -right-1.5 h-2 w-2 rounded-full bg-sky-400" />
                      )}
                    </div>
                    <span className="w-full truncate text-[11px] font-medium text-slate-200">
                      {file.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Right Pane: Built-in Preview */}
      <section className="flex flex-1 min-w-0 flex-col bg-slate-950/60">
        {selectedFile ? (
          <>
            <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/50 px-5 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {getFileIcon(selectedFile.kind)}
                  <span className="truncate text-xs font-semibold text-slate-100">
                    {selectedFile.name}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  {formatSource(selectedFile)}
                  {selectedFile.sizeLabel ? ` · ${selectedFile.sizeLabel}` : ''}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(true)}
                title="Expand preview"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/70 px-2.5 py-1 text-[11px] text-slate-300 transition hover:bg-slate-700 hover:text-white cursor-pointer"
              >
                <Maximize2 className="h-3 w-3" />
                Expand
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              {renderPreviewContent(selectedFile)}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-xs text-slate-500">
            Select a file to inspect its contents.
          </div>
        )}
      </section>

      {/* Expanded Preview Modal */}
      {modalOpen && selectedFile && (
        <div
          onClick={() => setModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                {getFileIcon(selectedFile.kind)}
                <span>{selectedFile.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {renderPreviewContent(selectedFile)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
