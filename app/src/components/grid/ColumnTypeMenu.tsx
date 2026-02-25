import { useRef, useEffect } from "react";
import { COLUMN_TYPE_LABELS, type ColumnType } from "./types";

const TYPE_ICONS: Record<ColumnType, string> = {
  text: "Aa",
  longtext: "\u00b6",
  number: "#",
  select: "\u25bc",
  multiselect: "\u2630",
  checkbox: "\u2611",
  date: "\ud83d\udcc5",
  url: "\ud83d\udd17",
  rating: "\u2605",
};

interface ColumnTypeMenuProps {
  onSelect: (type: ColumnType) => void;
  onClose: () => void;
}

export function ColumnTypeMenu({ onSelect, onClose }: ColumnTypeMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div className="grid-type-menu" ref={menuRef}>
      {(Object.keys(COLUMN_TYPE_LABELS) as ColumnType[]).map((type) => (
        <button
          key={type}
          className="grid-type-menu__item"
          onClick={() => {
            onSelect(type);
            onClose();
          }}
        >
          <span className="grid-type-menu__icon">{TYPE_ICONS[type]}</span>
          <span>{COLUMN_TYPE_LABELS[type]}</span>
        </button>
      ))}
    </div>
  );
}

export { TYPE_ICONS };
