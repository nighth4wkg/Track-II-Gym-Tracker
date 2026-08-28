import { useRef } from "react";

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

  return (
    <div
      ref={menuRef}
      className="split-menu"
      style={{ top: menu.y, left: menu.x }}
      onClick={(event) => event.stopPropagation()}
    >
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
