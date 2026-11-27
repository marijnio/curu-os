/**
 * Lightweight Web Audio API voice-memo cadence synthesizer used when a scenario
 * references a placeholder audio file (e.g. missing .mp3/.ogg on disk).
 */
export function parseDurationToSeconds(duration: string): number {
  const match = /^\s*(\d+):(\d{2})\s*$/.exec(duration);
  if (!match) return 15;
  const mins = Number(match[1]);
  const secs = Number(match[2]);
  const total = mins * 60 + secs;
  return total > 0 ? total : 15;
}

export function formatSeconds(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export class SimulatedVoicePlayback {
  private duration: number;
  private currentTime = 0;
  private playing = false;
  private muted = false;
  private rafId: number | null = null;
  private lastTick = 0;
  private nextPulseAt = 0;
  private pulseIndex = 0;
  private audioCtx: AudioContext | null = null;

  private onProgress: (time: number) => void;
  private onEnded: () => void;

  constructor(
    durationSeconds: number,
    onProgress: (time: number) => void,
    onEnded: () => void
  ) {
    this.duration = Math.max(1, durationSeconds);
    this.onProgress = onProgress;
    this.onEnded = onEnded;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  setDuration(seconds: number): void {
    this.duration = Math.max(1, seconds);
  }

  seek(seconds: number): void {
    this.currentTime = Math.max(0, Math.min(this.duration, seconds));
    this.onProgress(this.currentTime);
  }

  play(): void {
    if (this.playing) return;
    if (this.currentTime >= this.duration) {
      this.currentTime = 0;
    }
    this.playing = true;
    this.lastTick = performance.now();
    this.nextPulseAt = this.lastTick;
    this.ensureAudioContext();
    this.loop();
  }

  pause(): void {
    this.playing = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy(): void {
    this.pause();
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }

  private ensureAudioContext(): void {
    if (typeof window === 'undefined') return;
    if (!this.audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Ctx) {
        this.audioCtx = new Ctx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  private playCadencePulse(): void {
    if (this.muted || !this.audioCtx || this.audioCtx.state !== 'running') return;

    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const filter = this.audioCtx.createBiquadFilter();
    const gain = this.audioCtx.createGain();

    // Subtle warm speech-like cadence variation
    const baseFreqs = [175, 196, 164, 210, 182, 155, 202];
    const freq = baseFreqs[this.pulseIndex % baseFreqs.length];
    this.pulseIndex += 1;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.92, now + 0.11);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(620, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.032, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  private loop = (): void => {
    if (!this.playing) return;
    const now = performance.now();
    const dt = (now - this.lastTick) / 1000;
    this.lastTick = now;

    this.currentTime += dt;
    if (now >= this.nextPulseAt) {
      this.playCadencePulse();
      // Natural irregular speech-cadence spacing (180ms–320ms)
      this.nextPulseAt = now + 190 + ((this.pulseIndex * 53) % 140);
    }

    if (this.currentTime >= this.duration) {
      this.currentTime = 0;
      this.pause();
      this.onProgress(0);
      this.onEnded();
      return;
    }

    this.onProgress(this.currentTime);
    this.rafId = requestAnimationFrame(this.loop);
  };
}
