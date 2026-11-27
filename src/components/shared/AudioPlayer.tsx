import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, FileText, Volume2, VolumeX } from 'lucide-react';
import {
  formatSeconds,
  parseDurationToSeconds,
  SimulatedVoicePlayback,
} from '../../engine/audioFallback';
import { resolveScenarioAssetUrl } from '../../engine/scenarioLoader';
import { useOsStore } from '../../store/useOsStore';

interface AudioPlayerProps {
  path: string;
  durationHint?: string;
  transcript?: string;
  variant?: 'compact' | 'full';
  onOpenInExplorer?: () => void;
}

function buildWaveformBars(seedText: string, count: number): number[] {
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i += 1) {
    hash ^= i * 37 + 13;
    hash = Math.imul(hash, 16777619);
    const normalized = ((hash >>> 0) % 100) / 100;
    bars.push(0.22 + normalized * 0.78);
  }
  return bars;
}

export function AudioPlayer({
  path,
  durationHint = '0:15',
  transcript,
  variant = 'compact',
  onOpenInExplorer,
}: AudioPlayerProps) {
  const scenarioId = useOsStore((s) => s.scenarioId);
  const muted = useOsStore((s) => s.muted);

  const audioUrl = useMemo(
    () => resolveScenarioAssetUrl(scenarioId, path),
    [scenarioId, path]
  );
  const barCount = variant === 'full' ? 42 : 26;
  const bars = useMemo(() => buildWaveformBars(path, barCount), [path, barCount]);

  const fallbackDuration = useMemo(
    () => parseDurationToSeconds(durationHint),
    [durationHint]
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const simRef = useRef<SimulatedVoicePlayback | null>(null);

  const [useFallback, setUseFallback] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(fallbackDuration);
  const [showTranscript, setShowTranscript] = useState(variant === 'full');

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(fallbackDuration);
    setUseFallback(false);

    if (simRef.current) {
      simRef.current.destroy();
      simRef.current = null;
    }

    const audio = new Audio();
    audio.preload = 'metadata';
    audio.muted = muted;
    audio.src = audioUrl;
    audioRef.current = audio;

    const handleLoadedMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handleError = () => {
      setUseFallback(true);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMeta);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMeta);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audioRef.current = null;
      if (simRef.current) {
        simRef.current.destroy();
        simRef.current = null;
      }
    };
  }, [audioUrl, fallbackDuration]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = muted;
    }
    if (simRef.current) {
      simRef.current.setMuted(muted);
    }
  }, [muted]);

  const ensureSim = () => {
    if (!simRef.current) {
      simRef.current = new SimulatedVoicePlayback(
        duration,
        (t) => setCurrentTime(t),
        () => {
          setIsPlaying(false);
          setCurrentTime(0);
        }
      );
      simRef.current.setMuted(muted);
    }
    return simRef.current;
  };

  const togglePlay = async () => {
    if (useFallback) {
      const sim = ensureSim();
      if (isPlaying) {
        sim.pause();
        setIsPlaying(false);
      } else {
        sim.play();
        setIsPlaying(true);
        useOsStore.getState().onAudioPlayed(path);
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
      useOsStore.getState().onAudioPlayed(path);
    } catch {
      setUseFallback(true);
      const sim = ensureSim();
      sim.play();
      setIsPlaying(true);
      useOsStore.getState().onAudioPlayed(path);
    }
  };

  const handleSeek = (ratio: number) => {
    const target = Math.max(0, Math.min(1, ratio)) * duration;
    setCurrentTime(target);
    if (useFallback) {
      ensureSim().seek(target);
    } else if (audioRef.current) {
      audioRef.current.currentTime = target;
    }
  };

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <div
      className={`rounded-lg border border-slate-300/80 bg-[#f4f6f8] ${
        variant === 'full' ? 'p-4' : 'p-2.5 min-w-[260px] max-w-[340px]'
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void togglePlay()}
          aria-label={isPlaying ? 'Pause voice note' : 'Play voice note'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0067c0] text-white transition hover:bg-[#005aa8] active:scale-95 cursor-pointer"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="h-4 w-4 fill-current translate-x-0.5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div
            role="slider"
            tabIndex={0}
            aria-label="Audio playback progress"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(currentTime)}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              handleSeek((e.clientX - rect.left) / rect.width);
            }}
            className="flex h-8 items-center gap-[3px] cursor-pointer select-none"
          >
            {bars.map((height, idx) => {
              const barRatio = (idx + 0.5) / bars.length;
              const active = barRatio <= progress;
              return (
                <span
                  key={idx}
                  style={{ height: `${Math.round(height * 100)}%` }}
                  className={`flex-1 rounded-full transition-colors ${
                    active ? 'bg-[#0067c0]' : 'bg-slate-300'
                  }`}
                />
              );
            })}
          </div>

          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-600">
            <span className="font-mono">
              {formatSeconds(currentTime)} / {formatSeconds(duration)}
            </span>
            <span className="flex items-center gap-1.5">
              {useFallback && (
                <span className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] text-slate-600">
                  {muted ? (
                    <VolumeX className="h-2.5 w-2.5" />
                  ) : (
                    <Volume2 className="h-2.5 w-2.5" />
                  )}
                  Simulated
                </span>
              )}
              {transcript && variant === 'compact' && (
                <button
                  type="button"
                  onClick={() => setShowTranscript((v) => !v)}
                  className="inline-flex items-center gap-1 text-[#0067c0] hover:underline cursor-pointer"
                >
                  <FileText className="h-3 w-3" />
                  {showTranscript ? 'Hide' : 'Transcript'}
                </button>
              )}
              {onOpenInExplorer && (
                <button
                  type="button"
                  onClick={onOpenInExplorer}
                  className="text-slate-600 hover:text-slate-900 underline decoration-slate-400 cursor-pointer"
                >
                  Open File
                </button>
              )}
            </span>
          </div>
        </div>
      </div>

      {transcript && showTranscript && (
        <div className="mt-2.5 rounded border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-700">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Auto-Transcript
          </span>
          {transcript}
        </div>
      )}
    </div>
  );
}
