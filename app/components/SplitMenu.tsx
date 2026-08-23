import { useLayoutEffect, useRef } from "react";
import { applyAnimatedStyles } from "../domMotion";

type SplitMenuState = {
  id: string;
  x: number;
  y: number;
};

type SplitMenuProps = {
  menu: SplitMenuState;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
};

export function SplitMenu({ menu, onEdit, onDuplicate, onRemove }: SplitMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    applyAnimatedStyles(menuRef.current, { "--menu-left": `${menu.x}px`, "--menu-top": `${menu.y}px` });
  }, [menu.x, menu.y]);

  return (
    <div ref={menuRef} className="split-menu" onClick={(event) => event.stopPropagation()}>
      <button onClick={() => onEdit(menu.id)}>
        <span>✎</span>Edit name
      </button>
      <button onClick={() => onDuplicate(menu.id)}>
        <span>⧉</span>Duplicate
      </button>
      <button className="danger" onClick={() => onRemove(menu.id)}>
        <span>×</span>Remove
      </button>
    </div>
  );
}
