'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * 経過時間を計測するカスタムフック
 * @returns { elapsedMs, isRunning, start, stop, reset }
 */
export function useElapsedTime() {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    startTimeRef.current = Date.now();
    setElapsedMs(0);
    setIsRunning(true);
  }, []);

  const reset = useCallback(() => {
    stop();
    setElapsedMs(0);
  }, [stop]);

  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  return { elapsedMs, isRunning, start, stop, reset };
}

/**
 * ミリ秒を "M:SS" 形式にフォーマット
 */
export function formatElapsedTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}
