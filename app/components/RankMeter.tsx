"use client";

import { useLayoutEffect, useRef } from "react";
import { applyAnimatedStyles } from "../domMotion";
import { rankMilestonePercent, type RankLevel } from "../rankData";

const RANK_LEVELS: RankLevel[] = ["newbie", "intermediate", "gym-bro", "advanced", "elite"];
const RANK_MILESTONES = RANK_LEVELS.slice(1).map((level) => ({
  level,
  position: rankMilestonePercent(level),
}));

export function RankMeter({
  progress,
  eliteProgress,
  tone,
}: {
  progress: number;
  eliteProgress: number;
  tone: string;
}) {
  const fillRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    applyAnimatedStyles(fillRef.current, { "--rank-progress": `${eliteProgress}%` }, 180);
  }, [eliteProgress]);
  return (
    <span
      className={`rank-meter ${tone}`}
      role="img"
      aria-label={`${eliteProgress}% toward Elite; ${progress}% through the current rank`}
    >
      <i ref={fillRef} />
      <span className="rank-meter-ticks" aria-hidden="true">
        {RANK_MILESTONES.map(({ level, position }) => (
          <b key={level} style={{ left: `${position}%` }} />
        ))}
      </span>
    </span>
  );
}
