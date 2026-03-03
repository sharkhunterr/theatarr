/**
 * Audio engine hook for browser-based audio playback with fade support.
 *
 * Uses HTML5 <audio> elements with Web Audio API GainNode for volume/fade control.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface AudioEngineState {
  isPlaying: boolean;
  currentUrl: string | null;
  volume: number;
}

interface UseAudioEngineReturn extends AudioEngineState {
  play: (url: string, volume?: number, fadeInMs?: number) => Promise<void>;
  stop: (fadeOutMs?: number) => Promise<void>;
  setVolume: (volume: number, fadeMs?: number) => void;
  pause: () => void;
  resume: () => void;
  /** Call from a user gesture handler to unlock the AudioContext for autoplay. */
  unlock: () => void;
}

export function useAudioEngine(): UseAudioEngineReturn {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const fadeTimeoutRef = useRef<number | null>(null);

  const [state, setState] = useState<AudioEngineState>({
    isPlaying: false,
    currentUrl: null,
    volume: 1,
  });

  const getOrCreateContext = useCallback(() => {
    const existing = audioContextRef.current;
    if (existing && existing.state !== 'closed') {
      if (existing.state === 'suspended') {
        existing.resume().catch(() => {});
      }
      return existing;
    }
    // Create fresh context (previous was null or closed)
    const ctx = new AudioContext();
    audioContextRef.current = ctx;
    gainNodeRef.current = null; // Force new gain node for new context
    return ctx;
  }, []);

  const cleanup = useCallback(() => {
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
    // Disconnect source node from audio graph
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch { /* already disconnected */ }
      sourceNodeRef.current = null;
    }
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.removeAttribute('src');
      audioElementRef.current.load();
      audioElementRef.current = null;
    }
  }, []);

  // Cleanup on unmount — stop audio and close context
  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.disconnect(); } catch { /* */ }
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.removeAttribute('src');
        audioElementRef.current.load();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const unlock = useCallback(() => {
    const ctx = getOrCreateContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }, [getOrCreateContext]);

  const play = useCallback(
    async (url: string, volume = 0.8, fadeInMs = 0) => {
      cleanup();

      const ctx = getOrCreateContext();

      // Create new audio element
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.src = url;
      audioElementRef.current = audio;

      // Create gain node if needed (new context or first play)
      if (!gainNodeRef.current) {
        gainNodeRef.current = ctx.createGain();
        gainNodeRef.current.connect(ctx.destination);
      }

      // Connect audio element to gain node
      const source = ctx.createMediaElementSource(audio);
      source.connect(gainNodeRef.current);
      sourceNodeRef.current = source;

      // Set initial volume
      const targetVolume = Math.max(0, Math.min(1, volume));
      if (fadeInMs > 0) {
        gainNodeRef.current.gain.setValueAtTime(0, ctx.currentTime);
        gainNodeRef.current.gain.linearRampToValueAtTime(
          targetVolume,
          ctx.currentTime + fadeInMs / 1000
        );
      } else {
        gainNodeRef.current.gain.setValueAtTime(targetVolume, ctx.currentTime);
      }

      // Play
      try {
        await audio.play();
        setState({ isPlaying: true, currentUrl: url, volume: targetVolume });
      } catch (err) {
        console.error('Audio playback failed:', err);
        setState((prev) => ({ ...prev, isPlaying: false }));
      }

      // Listen for end
      audio.addEventListener('ended', () => {
        setState((prev) => ({ ...prev, isPlaying: false, currentUrl: null }));
      });
    },
    [cleanup, getOrCreateContext]
  );

  const stop = useCallback(
    async (fadeOutMs = 0) => {
      const ctx = audioContextRef.current;
      const gain = gainNodeRef.current;
      const audio = audioElementRef.current;

      if (!audio || !ctx || ctx.state === 'closed' || !gain) {
        cleanup();
        setState({ isPlaying: false, currentUrl: null, volume: 0 });
        return;
      }

      if (fadeOutMs > 0) {
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeOutMs / 1000);

        return new Promise<void>((resolve) => {
          fadeTimeoutRef.current = window.setTimeout(() => {
            cleanup();
            setState({ isPlaying: false, currentUrl: null, volume: 0 });
            resolve();
          }, fadeOutMs);
        });
      } else {
        cleanup();
        setState({ isPlaying: false, currentUrl: null, volume: 0 });
      }
    },
    [cleanup]
  );

  const setVolume = useCallback((volume: number, fadeMs = 0) => {
    const ctx = audioContextRef.current;
    const gain = gainNodeRef.current;
    if (!ctx || ctx.state === 'closed' || !gain) return;

    const clamped = Math.max(0, Math.min(1, volume));
    if (fadeMs > 0) {
      gain.gain.linearRampToValueAtTime(clamped, ctx.currentTime + fadeMs / 1000);
    } else {
      gain.gain.setValueAtTime(clamped, ctx.currentTime);
    }
    setState((prev) => ({ ...prev, volume: clamped }));
  }, []);

  const pause = useCallback(() => {
    audioElementRef.current?.pause();
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  const resume = useCallback(() => {
    audioElementRef.current?.play();
    setState((prev) => ({ ...prev, isPlaying: true }));
  }, []);

  return {
    ...state,
    play,
    stop,
    setVolume,
    pause,
    resume,
    unlock,
  };
}
