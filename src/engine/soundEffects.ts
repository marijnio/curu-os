/**
 * Subtle Web Audio API notification chimes for diegetic desktop alerts.
 * Requires no external audio files and fails silently if AudioContext is unavailable
 * or blocked before the user's first interaction.
 */

export type ChimeKind = 'chat' | 'email' | 'file';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return null;
    try {
      sharedAudioCtx = new Ctx();
    } catch {
      return null;
    }
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function scheduleTone(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  peakGain: number,
  type: OscillatorType = 'sine'
) {
  const start = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peakGain, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playNotificationChime(kind: ChimeKind): void {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== 'running') return;

  try {
    if (kind === 'chat') {
      // Soft two-note messaging pop
      scheduleTone(ctx, 587.33, 0, 0.09, 0.035, 'sine');
      scheduleTone(ctx, 783.99, 0.07, 0.12, 0.032, 'sine');
    } else if (kind === 'email') {
      // Gentle three-note inbox chime
      scheduleTone(ctx, 523.25, 0, 0.12, 0.03, 'triangle');
      scheduleTone(ctx, 659.25, 0.08, 0.14, 0.028, 'triangle');
      scheduleTone(ctx, 783.99, 0.17, 0.2, 0.024, 'sine');
    } else {
      // Crisp subtle file arrival tick
      scheduleTone(ctx, 880, 0, 0.07, 0.022, 'sine');
    }
  } catch {
    // Ignore audio scheduling errors gracefully
  }
}
