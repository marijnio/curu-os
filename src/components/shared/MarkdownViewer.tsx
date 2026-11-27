import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Loader2, AlertCircle } from 'lucide-react';
import { resolveScenarioAssetUrl } from '../../engine/scenarioLoader';
import { useOsStore } from '../../store/useOsStore';

interface MarkdownViewerProps {
  path: string;
}

export function MarkdownViewer({ path }: MarkdownViewerProps) {
  const scenarioId = useOsStore((s) => s.scenarioId);
  const url = resolveScenarioAssetUrl(scenarioId, path);

  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(url, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Could not load ${path} (${res.status})`);
        }
        return res.text();
      })
      .then((text) => {
        if (!cancelled) {
          setContent(text);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url, path]);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center gap-2 text-xs text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin text-[#0067c0]" />
        Loading document...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700">
        <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
        {error}
      </div>
    );
  }

  return (
    <div className="curu-markdown">
      <ReactMarkdown>{content ?? ''}</ReactMarkdown>
    </div>
  );
}
