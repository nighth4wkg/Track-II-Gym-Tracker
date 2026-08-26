"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { TRACK_TIMING } from "../trackConstants";

export type MotionSelectOption<T extends string> = {
  value: T;
  label: string;
};

type MotionSelectProps<T extends string> = {
  value: T;
  options: readonly MotionSelectOption<T>[];
  ariaLabel: string;
  onChange: (value: T) => void;
  className?: string;
};

type MenuPosition = {
  top: number;
  left: number;
  minWidth: number;
  placement: "above" | "below";
};

const MENU_GAP_PX = 7;
const MENU_EDGE_PX = 12;
const MENU_MIN_WIDTH_PX = 150;
const MENU_OPTION_HEIGHT_PX = 34;
const MENU_VERTICAL_PADDING_PX = 10;

export function MotionSelect<T extends string>({
  value,
  options,
  ariaLabel,
  onChange,
  className = "",
}: MotionSelectProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [selectionKey, setSelectionKey] = useState(0);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selectedOption = options[selectedIndex] ?? options[0];

  const updateMenuPosition = useCallback(() => {
    const trigger = rootRef.current?.querySelector<HTMLButtonElement>(".motion-select-trigger");
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const estimatedHeight = Math.min(
      options.length * MENU_OPTION_HEIGHT_PX + MENU_VERTICAL_PADDING_PX,
      window.innerHeight - MENU_EDGE_PX * 2,
    );
    const availableBelow = window.innerHeight - rect.bottom - MENU_EDGE_PX;
    const availableAbove = rect.top - MENU_EDGE_PX;
    const placement = availableBelow < estimatedHeight && availableAbove > availableBelow ? "above" : "below";
    const top = placement === "above" ? rect.top - estimatedHeight - MENU_GAP_PX : rect.bottom + MENU_GAP_PX;
    const minWidth = Math.min(Math.max(rect.width, MENU_MIN_WIDTH_PX), window.innerWidth - MENU_EDGE_PX * 2);
    const left = Math.min(Math.max(MENU_EDGE_PX, rect.right - minWidth), window.innerWidth - minWidth - MENU_EDGE_PX);
    setMenuPosition({ top, left, minWidth, placement });
  }, [options.length]);

  function openMenu() {
    setMenuPosition(null);
    setOpen(true);
  }

  const close = useCallback(() => {
    if (!open || closing) return;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
      setMenuPosition(null);
    }, TRACK_TIMING.dropdownCloseAnimationMs);
  }, [closing, open]);

  function choose(nextValue: T) {
    if (nextValue !== value) {
      onChange(nextValue);
      setSelectionKey((current) => current + 1);
    }
    close();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      close();
      return;
    }
    if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      const direction = event.key === "ArrowUp" ? -1 : 1;
      const nextIndex = (selectedIndex + direction + options.length) % options.length;
      choose(options[nextIndex].value);
    }
  }

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (rootRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      close();
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [close, open]);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const reposition = () => updateMenuPosition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    },
    [],
  );

  return (
    <div
      ref={rootRef}
      className={`motion-select${open ? " is-open" : ""}${closing ? " is-closing" : ""} ${className}`.trim()}
    >
      <button
        type="button"
        className="motion-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open && !closing}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={handleKeyDown}
      >
        <span key={selectionKey} className={selectionKey ? "motion-select-value changed" : "motion-select-value"}>
          {selectedOption?.label}
        </span>
        <i aria-hidden="true" />
      </button>
      {open &&
        globalThis.document &&
        createPortal(
          <div
            ref={menuRef}
            className={`motion-select-menu ${menuPosition?.placement ?? "below"}${closing ? " closing" : ""}`}
            role="listbox"
            aria-label={ariaLabel}
            style={
              menuPosition
                ? {
                    top: menuPosition.top,
                    left: menuPosition.left,
                    minWidth: menuPosition.minWidth,
                    visibility: "visible",
                  }
                : { visibility: "hidden" }
            }
          >
            {options.map((option) => (
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                key={option.value}
                onClick={() => choose(option.value)}
              >
                <span>{option.label}</span>
                {option.value === value && <b aria-hidden="true">✓</b>}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
