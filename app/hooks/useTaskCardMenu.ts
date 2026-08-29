import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type MenuPosition = { top: number; left: number };

type UseTaskCardMenuOptions = {
  completionEnabled: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
};

export function useTaskCardMenu({ completionEnabled, menuOpen, onToggleMenu }: UseTaskCardMenuOptions) {
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const positionMenu = useCallback(() => {
    const trigger = menuButtonRef.current;
    if (!trigger || !globalThis.window) return;
    const rect = trigger.getBoundingClientRect();
    const width = 158;
    const height = completionEnabled ? 160 : 124;
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    const below = rect.bottom + 5;
    const top = below + height <= window.innerHeight - 8 ? below : Math.max(8, rect.top - height - 5);
    setMenuPosition({ top, left });
  }, [completionEnabled]);

  useLayoutEffect(() => {
    if (!menuOpen) return undefined;
    const frame = window.requestAnimationFrame(positionMenu);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [menuOpen, positionMenu]);

  useEffect(() => {
    if (!menuOpen) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target) || menuButtonRef.current?.contains(target)) return;
      onToggleMenu();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onToggleMenu();
    };
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen, onToggleMenu]);

  const toggleMenu = () => {
    if (menuOpen) setMenuPosition(null);
    else positionMenu();
    onToggleMenu();
  };

  const closeMenu = () => setMenuPosition(null);

  return { menuButtonRef, menuRef, menuPosition, closeMenu, toggleMenu };
}
