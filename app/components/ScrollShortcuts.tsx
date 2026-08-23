"use client";

import { haptic } from "../haptics";

type ScrollShortcutsProps = {
  showTop: boolean;
  showBottom: boolean;
};

export function ScrollShortcuts({ showTop, showBottom }: ScrollShortcutsProps) {
  if (!showTop && !showBottom) return null;

  return (
    <div className="scroll-shortcuts">
      {showTop && (
        <button
          className="scroll-to-top"
          onClick={() => {
            haptic(8);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          aria-label="Back to exercise search"
          title="Back to top"
        >
          <span />
        </button>
      )}
      {showBottom && (
        <button
          className="scroll-to-bottom"
          onClick={() => {
            haptic(8);
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
          }}
          aria-label="Go to bottom"
          title="Go to bottom"
        >
          <span />
        </button>
      )}
    </div>
  );
}
