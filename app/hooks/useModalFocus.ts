import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type UseModalFocusOptions = {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
};

export function useModalFocus({ open, containerRef }: UseModalFocusOptions) {
  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
    const focusFirst = () => (focusable()[0] ?? container).focus();
    const frame = window.requestAnimationFrame(focusFirst);
    const trapTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !container.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    container.addEventListener("keydown", trapTab);
    return () => {
      window.cancelAnimationFrame(frame);
      container.removeEventListener("keydown", trapTab);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [containerRef, open]);
}
