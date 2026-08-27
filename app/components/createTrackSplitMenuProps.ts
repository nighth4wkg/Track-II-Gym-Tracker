import type { Checklist } from "../trackTypes";

type SplitMenuState = { id: string; x: number; y: number };

type CreateTrackSplitMenuPropsOptions = {
  menu: SplitMenuState | null;
  lists: Checklist[];
  setSplitName: (name: string) => void;
  setRenamingId: (id: string | null) => void;
  closeMenu: () => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
};

export function createTrackSplitMenuProps({
  menu,
  lists,
  setSplitName,
  setRenamingId,
  closeMenu,
  onDuplicate,
  onRemove,
}: CreateTrackSplitMenuPropsOptions) {
  if (!menu) return undefined;
  return {
    menu,
    onEdit: (id: string) => {
      const list = lists.find((item) => item.id === id);
      if (list) {
        setSplitName(list.title);
        setRenamingId(list.id);
      }
      closeMenu();
    },
    onDuplicate,
    onRemove,
  };
}
