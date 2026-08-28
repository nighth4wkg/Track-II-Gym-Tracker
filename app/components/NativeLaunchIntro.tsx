"use client";

import { useEffect, useRef, useState } from "react";
import { TRACK_ASSET_QUERY } from "../trackConfig";

const MINIMUM_INTRO_MS = 480;
const EXIT_ANIMATION_MS = 360;

type NativeLaunchIntroProps = {
  ready: boolean;
  onComplete: () => void;
};

export function NativeLaunchIntro({ ready, onComplete }: NativeLaunchIntroProps) {
  const mountedAtRef = useRef<number | null>(null);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    mountedAtRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const mountedAt = mountedAtRef.current ?? Date.now();
    const waitMs = Math.max(0, MINIMUM_INTRO_MS - (Date.now() - mountedAt));
    const timer = window.setTimeout(() => setExiting(true), waitMs);
    return () => window.clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    if (!exiting) return;
    const timer = window.setTimeout(onComplete, EXIT_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [exiting, onComplete]);

  return (
    <div
      className={`native-launch-intro${exiting ? " is-exiting" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Loading Track II"
    >
      {/* This shared Vite/native entry needs the raw public asset. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="native-launch-intro-mark" src={`/track-icon.svg${TRACK_ASSET_QUERY}`} alt="" />
    </div>
  );
}
