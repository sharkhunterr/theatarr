/**
 * Audio engine hook for browser-based audio playback with fade support.
 *
 * Uses HTML5 <audio> elements with Web Audio API GainNode for volume/fade control.
 */

import { useCallback, useRef, useState } from 'react';

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
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const cleanup = useCallback(() => {
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.src = '';
      audioElementRef.current.load();
    }
    sourceNodeRef.current = null;
  }, []);

  const play = useCallback(
    async (url: string, volume = 0.8, fadeInMs = 0) => {
      cleanup();

      const ctx = getOrCreateContext();

      // Create new audio element
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.src = url;
      audioElementRef.current = audio;

      // Create or reuse gain node
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

      if (!audio || !ctx || !gain) {
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
    if (!ctx || !gain) return;

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
  };
}
