import { useState } from 'react';
import {
  ChevronRight,
  Download,
  FileText,
  Folder,
  Image as ImageIcon,
  Maximize2,
  Mic,
  Search,
  X,
  File,
  LayoutGrid,
  List,
} from 'lucide-react';
import type { FolderName } from '../../types/scenario';
import type { VirtualFile } from '../../types/os';
import { selectTranslations } from '../../engine/i18n';
import { resolveScenarioAssetUrl } from '../../engine/scenarioLoader';
import { useOsStore } from '../../store/useOsStore';
import { MarkdownViewer } from '../shared/MarkdownViewer';
import { AudioPlayer } from '../shared/AudioPlayer';

const FOLDERS: FolderName[] = [
  'Documents',
  'Images',
  'Voice Notes',
  'Downloads',
];

export function FileExplorerApp() {
  const scenarioId = useOsStore((s) => s.scenarioId);
  const files = useOsStore((s) => s.files);
  const selectedFolder = useOsStore((s) => s.selectedFolder);
  const selectedFileId = useOsStore((s) => s.selectedFileId);
  const contacts = useOsStore((s) => s.contacts);

  const selectFolder = useOsStore((s) => s.selectFolder);
  const selectFile = useOsStore((s) => s.selectFile);
  const t = useOsStore(selectTranslations);

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filesInFolder = (folder: FolderName): VirtualFile[] => {
    if (folder === 'Downloads') {
      return files.filter((f) => f.folder === 'Downloads' || Boolean(f.receivedVia));
    }
    return files.filter((f) => f.folder === folder);
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;
  const visibleFiles = isSearching
    ? files.filter((f) => {
        const haystack = [
          f.name,
          f.path,
          f.folder,
          t.folders[f.folder],
          f.transcript ?? '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : filesInFolder(selectedFolder);
  const selectedFile =
    files.find((f) => f.id === selectedFileId) ?? visibleFiles[0] ?? null;

  const getFolderIcon = (folder: FolderName) => {
    switch (folder) {
      case 'Documents':
        return <FileText className="h-4 w-4 text-[#0067c0]" />;
      case 'Images':
        return <ImageIcon className="h-4 w-4 text-emerald-600" />;
      case 'Voice Notes':
        return <Mic className="h-4 w-4 text-amber-600" />;
      case 'Downloads':
        return <Download className="h-4 w-4 text-[#0067c0]" />;
    }
  };

  const getFileIcon = (kind: VirtualFile['kind']) => {
    switch (kind) {
      case 'markdown':
        return <FileText className="h-4 w-4 text-[#0067c0]" />;
      case 'image':
        return <ImageIcon className="h-4 w-4 text-emerald-600" />;
      case 'audio':
        return <Mic className="h-4 w-4 text-amber-600" />;
      default:
        return <File className="h-4 w-4 text-slate-500" />;
    }
  };

  const formatSource = (file: VirtualFile) => {
    if (!file.receivedVia) return t.explorer.workspace;
    const sender = contacts.find((c) => c.id === file.receivedVia?.senderId);
    const channelLabel =
      file.receivedVia.channel === 'chat' ? t.apps.messages : t.apps.mail;
    return `${channelLabel} · ${sender?.name ?? file.receivedVia.senderId}`;
  };

  const renderPreviewContent = (file: VirtualFile) => {
    if (file.kind === 'markdown' || file.kind === 'text') {
      return (
        <div className="rounded border border-slate-200 bg-white p-6 shadow-2xs">
          <MarkdownViewer path={file.path} />
        </div>
      );
    }
    if (file.kind === 'image') {
      return (
        <div className="flex flex-col items-center justify-center gap-3">
          <img
            src={resolveScenarioAssetUrl(scenarioId, file.path)}
            alt={file.name}
            className="max-h-[380px] w-auto rounded border border-slate-300 bg-slate-900 object-contain shadow-sm"
          />
          <span className="font-mono text-[11px] text-slate-500">{file.path}</span>
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
    <div className="relative flex h-full w-full flex-col bg-white text-slate-900">
      {/* Slim Explorer Address / Toolbar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-slate-200 bg-[#f8f9fa] px-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-700">
          <Folder className="h-3.5 w-3.5 fill-[#f3c13a] text-[#c79514]" />
          <span className="text-slate-500">{t.explorer.thisDesk}</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-medium text-slate-900">
            {t.folders[selectedFolder]}
          </span>
          {selectedFile && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              <span className="truncate max-w-48 text-slate-600">
                {selectedFile.name}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2 h-3 w-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.explorer.searchPlaceholder}
              className="w-44 rounded border border-slate-200 bg-white py-0.5 pr-6 pl-6 text-[11px] text-slate-800 outline-none focus:border-[#0067c0]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label={t.explorer.clearSearch}
                className="absolute right-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            aria-label={t.explorer.listView}
            className={`rounded p-1 cursor-pointer ${
              viewMode === 'list'
                ? 'bg-slate-200 text-slate-900'
                : 'text-slate-500 hover:bg-slate-200/60 hover:text-slate-800'
            }`}
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            aria-label={t.explorer.gridView}
            className={`rounded p-1 cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-slate-200 text-slate-900'
                : 'text-slate-500 hover:bg-slate-200/60 hover:text-slate-800'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main 3-Pane Body */}
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar: Folder Tree */}
        <aside className="flex w-44 shrink-0 flex-col border-r border-slate-200 bg-[#f3f4f6]">
          <nav className="flex-1 space-y-0.5 p-2">
            {FOLDERS.map((folderName) => {
              const list = filesInFolder(folderName);
              const unread = list.filter((f) => !f.opened).length;
              const active = selectedFolder === folderName;

              return (
                <button
                  key={folderName}
                  type="button"
                  onClick={() => selectFolder(folderName)}
                  className={`flex w-full items-center justify-between rounded-[3px] px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#dcebfb] text-slate-950 font-semibold'
                      : 'text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    {getFolderIcon(folderName)}
                    <span className="truncate">{t.folders[folderName]}</span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {unread > 0 && (
                      <span className="h-2 w-2 rounded-full bg-[#0067c0]" />
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
        <section className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
          {isSearching && (
            <div className="border-b border-slate-200 bg-[#f4f8fd] px-3 py-1.5 text-[10px] font-medium text-[#005aa8]">
              {t.explorer.searchingAllFolders(visibleFiles.length)}
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-2">
            {visibleFiles.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                {isSearching ? t.explorer.noMatchingFiles : t.explorer.emptyFolder}
              </div>
            ) : viewMode === 'list' ? (
              <div className="space-y-0.5">
                {visibleFiles.map((file) => {
                  const isSelected = selectedFile?.id === file.id;
                  return (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => selectFile(file.id)}
                      className={`flex w-full items-start gap-2.5 rounded-[3px] p-2 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#e5f1fb] ring-1 ring-[#99c8f2]'
                          : 'hover:bg-slate-100'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">{getFileIcon(file.kind)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {!file.opened && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0067c0]" />
                          )}
                          <span className="truncate text-xs font-medium text-slate-900">
                            {file.name}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-[10px] text-slate-500">
                          {formatSource(file)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {visibleFiles.map((file) => {
                  const isSelected = selectedFile?.id === file.id;
                  return (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => selectFile(file.id)}
                      className={`flex flex-col items-center gap-1.5 rounded-[3px] p-2.5 text-center transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#e5f1fb] ring-1 ring-[#99c8f2]'
                          : 'hover:bg-slate-100'
                      }`}
                    >
                      <div className="relative">
                        {getFileIcon(file.kind)}
                        {!file.opened && (
                          <span className="absolute -top-1 -right-1.5 h-2 w-2 rounded-full bg-[#0067c0]" />
                        )}
                      </div>
                      <span className="w-full truncate text-[11px] font-medium text-slate-800">
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
        <section className="flex flex-1 min-w-0 flex-col bg-[#f8f9fa]">
          {selectedFile ? (
            <>
              <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {getFileIcon(selectedFile.kind)}
                    <span className="truncate text-xs font-semibold text-slate-900">
                      {selectedFile.name}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {formatSource(selectedFile)}
                    {selectedFile.sizeLabel ? ` · ${selectedFile.sizeLabel}` : ''}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  title={t.explorer.expandPreview}
                  className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] text-slate-700 transition hover:bg-slate-100 cursor-pointer"
                >
                  <Maximize2 className="h-3 w-3" />
                  {t.explorer.expand}
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-4">
                {renderPreviewContent(selectedFile)}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-xs text-slate-400">
              {t.explorer.selectFile}
            </div>
          )}
        </section>
      </div>

      {/* Expanded Preview Modal */}
      {modalOpen && selectedFile && (
        <div
          onClick={() => setModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-[3px] border border-slate-400 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-[#f8f9fa] px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                {getFileIcon(selectedFile.kind)}
                <span>{selectedFile.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-[#f8f9fa] p-6">
              {renderPreviewContent(selectedFile)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
