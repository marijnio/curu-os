import type { PlayerPromptConfig } from '../types/scenario';

export interface ResolvedPlayerPrompt {
  variableName: string;
  label: string;
  placeholder: string;
  helperText?: string;
  defaultValue: string;
  required: boolean;
}

const VALID_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const TEMPLATE_TOKEN_RE = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

export function normalizePlayerPrompt(
  raw?: PlayerPromptConfig | null
): ResolvedPlayerPrompt | null {
  if (!raw || raw.enabled === false) {
    return null;
  }

  const trimmedVar = typeof raw.variableName === 'string' ? raw.variableName.trim() : '';
  const variableName = VALID_IDENTIFIER_RE.test(trimmedVar) ? trimmedVar : 'player_name';

  return {
    variableName,
    label: (typeof raw.label === 'string' && raw.label.trim()) || 'Your Name',
    placeholder:
      (typeof raw.placeholder === 'string' && raw.placeholder.trim()) ||
      'Enter your name...',
    helperText:
      typeof raw.helperText === 'string' && raw.helperText.trim()
        ? raw.helperText.trim()
        : undefined,
    defaultValue: typeof raw.defaultValue === 'string' ? raw.defaultValue : '',
    required: raw.required !== false,
  };
}

export function sanitizePlayerInput(raw: string): string {
  return raw
    .replace(/[\r\n\t\x00-\x1f\x7f]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 60);
}

export function interpolateTemplate(
  text: string,
  vars: Record<string, string>
): string {
  if (!text || !text.includes('{{')) {
    return text;
  }

  return text.replace(TEMPLATE_TOKEN_RE, (fullMatch, key: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return vars[key];
    }
    return fullMatch;
  });
}
