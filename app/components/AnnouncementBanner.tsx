import { useLayoutEffect, useRef, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";
import { applyAnimatedStyles } from "../domMotion";
import type { TrackAnnouncement } from "../trackTypes";

type AnnouncementBannerProps = {
  announcement: TrackAnnouncement;
  offset: number;
  dragStart: MutableRefObject<number | null>;
  onOffsetChange: (offset: number) => void;
  onDismiss: () => void;
};

export function AnnouncementBanner({
  announcement,
  offset,
  dragStart: dragStartRef,
  onOffsetChange,
  onDismiss,
}: AnnouncementBannerProps) {
  const bannerRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    applyAnimatedStyles(bannerRef.current, { "--announcement-offset": `${offset}px` }, 72);
  }, [offset]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    dragStartRef.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragStartRef.current !== null) onOffsetChange(event.clientX - dragStartRef.current);
  };

  const handlePointerUp = () => {
    if (Math.abs(offset) > 55) onDismiss();
    else onOffsetChange(0);
    dragStartRef.current = null;
  };

  const handlePointerCancel = () => {
    dragStartRef.current = null;
    onOffsetChange(0);
  };

  return (
    <aside
      ref={bannerRef}
      className="track-notification"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      aria-live="assertive"
    >
      <span className="notification-logo">
        <span className="dumbbell-icon" />
      </span>
      <div>
        <strong>Track II</strong>
        <p>{announcement.message}</p>
      </div>
      <button onClick={onDismiss} aria-label="Dismiss announcement">
        ×
      </button>
    </aside>
  );
}
