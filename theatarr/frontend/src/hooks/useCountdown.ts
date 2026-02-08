import { useState, useEffect } from 'react';

/**
 * Hook that forces a re-render at regular intervals for countdown displays.
 * Returns a tick counter that increments every `intervalMs` milliseconds.
 */
export function useCountdown(intervalMs = 30000): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return tick;
}
