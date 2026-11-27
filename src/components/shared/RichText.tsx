import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { selectTranslations } from '../../engine/i18n';
import { useOsStore } from '../../store/useOsStore';

const INLINE_TOKEN_RE =
  /`([^`\n]+)`|\*\*\*([^\s*](?:(?!\*\*\*)[^\n])*?[^\s*]|[^\s*])\*\*\*|\*\*([^\s](?:(?!\*\*)[^\n])*?[^\s]|[^\s*])\*\*|\*([^\s*](?:[^*\n]*[^\s*])?)\*/g;

const MAX_INLINE_DEPTH = 3;

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back to execCommand below when Clipboard API is restricted.
    }
  }

  if (typeof document === 'undefined') {
    return false;
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

interface CopyableCodeChipProps {
  value: string;
}

function CopyableCodeChip({ value }: CopyableCodeChipProps) {
  const t = useOsStore(selectTranslations);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const ok = await copyTextToClipboard(value);
    if (!ok) return;

    setCopied(true);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setCopied(false);
      timerRef.current = null;
    }, 1500);
  };

  const label = copied ? t.shared.copied : `${t.shared.copyToClipboard}: ${value}`;

  return (
    <span className="relative inline-block max-w-full align-baseline">
      <button
        type="button"
        onClick={(e) => void handleCopy(e)}
        title={label}
        aria-label={label}
        className={`inline-flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[0.9em] leading-tight transition cursor-pointer align-baseline ${
          copied
            ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
            : 'border-slate-300/90 bg-slate-900/[0.05] text-slate-900 hover:border-[#0067c0]/60 hover:bg-[#eef6fc] hover:text-[#004e96]'
        }`}
      >
        <code className="break-words font-mono">{value}</code>
        {copied ? (
          <Check className="h-3 w-3 shrink-0 text-emerald-600" aria-hidden="true" />
        ) : (
          <Copy className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
        )}
      </button>
      {copied && (
        <span
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm"
        >
          {t.shared.copied}
        </span>
      )}
    </span>
  );
}

function parseInlineMarkdown(text: string, depth = 0): ReactNode[] {
  if (!text || depth >= MAX_INLINE_DEPTH) {
    return [text];
  }

  const regex = new RegExp(INLINE_TOKEN_RE.source, 'g');
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const key = `${depth}-${keyCounter++}`;
    if (match[1] !== undefined) {
      nodes.push(<CopyableCodeChip key={key} value={match[1]} />);
    } else if (match[2] !== undefined) {
      nodes.push(
        <strong key={key} className="font-semibold">
          <em>{parseInlineMarkdown(match[2], depth + 1)}</em>
        </strong>
      );
    } else if (match[3] !== undefined) {
      nodes.push(
        <strong key={key} className="font-semibold">
          {parseInlineMarkdown(match[3], depth + 1)}
        </strong>
      );
    } else if (match[4] !== undefined) {
      nodes.push(<em key={key}>{parseInlineMarkdown(match[4], depth + 1)}</em>);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex === 0) {
    return [text];
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/**
 * Strips inline Markdown markers (`**bold**`, `*italic*`, `` `code` ``)
 * into plain text for single-line sidebar/inbox previews.
 */
export function stripInlineMarkdown(text: string, depth = 0): string {
  if (!text || depth >= MAX_INLINE_DEPTH) {
    return text;
  }

  const regex = new RegExp(INLINE_TOKEN_RE.source, 'g');
  return text.replace(
    regex,
    (
      _full,
      code: string | undefined,
      boldItalic: string | undefined,
      bold: string | undefined,
      italic: string | undefined
    ) => {
      if (code !== undefined) return code;
      if (boldItalic !== undefined) return stripInlineMarkdown(boldItalic, depth + 1);
      if (bold !== undefined) return stripInlineMarkdown(bold, depth + 1);
      if (italic !== undefined) return stripInlineMarkdown(italic, depth + 1);
      return '';
    }
  );
}

interface RichTextProps {
  text: string;
  className?: string;
}

/**
 * Safely renders lightweight inline Markdown (`**bold**`, `*italic*`, and
 * click-to-copy `` `code` `` chips) without raw HTML injection.
 */
export function RichText({ text, className }: RichTextProps) {
  return (
    <span className={className ? `whitespace-pre-wrap ${className}` : 'whitespace-pre-wrap'}>
      {parseInlineMarkdown(text)}
    </span>
  );
}
