"use client";

import { memo, useEffect, useRef, useState } from "react";
import { formatCountdown, formatStopwatch } from "../timerUtils";
import type { TimerMode } from "./TimerScreen";

type TimerDisplayValueProps = { mode: TimerMode; running: boolean; elapsed: number; restRemaining: number };

export const TimerDisplayValue = memo(function TimerDisplayValue({
  mode,
  running,
  elapsed,
  restRemaining,
}: TimerDisplayValueProps) {
  const [smoothElapsed, setSmoothElapsed] = useState(elapsed);
  const elapsedRef = useRef(elapsed);

  useEffect(() => {
    elapsedRef.current = elapsed;
    if (!running || mode !== "stopwatch") setSmoothElapsed(elapsed);
  }, [elapsed, mode, running]);

  useEffect(() => {
    if (!running || mode !== "stopwatch") return;
    let frame = 0;
    let lastRenderedHundredth = Math.floor(elapsedRef.current / 10);
    const startedAt = performance.now() - elapsedRef.current;
    const render = (now: number) => {
      const nextElapsed = now - startedAt;
      const hundredth = Math.floor(nextElapsed / 10);
      if (hundredth !== lastRenderedHundredth) {
        lastRenderedHundredth = hundredth;
        setSmoothElapsed(nextElapsed);
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [mode, running]);

  return mode === "stopwatch" ? formatStopwatch(running ? smoothElapsed : elapsed) : formatCountdown(restRemaining);
});
