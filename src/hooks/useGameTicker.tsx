import { useState, useEffect } from 'react';

let globalTick = 0;
let listeners = new Set<(tick: number) => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function startTicker() {
  if (intervalId !== null) return;
  intervalId = setInterval(() => {
    globalTick += 1;
    listeners.forEach(fn => fn(globalTick));
  }, 1000);
}

function stopTicker() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function useGameTicker(): number {
  const [tick, setTick] = useState(globalTick);

  useEffect(() => {
    listeners.add(setTick);
    if (listeners.size === 1) startTicker();

    return () => {
      listeners.delete(setTick);
      if (listeners.size === 0) stopTicker();
    };
  }, []);

  return tick;
}
