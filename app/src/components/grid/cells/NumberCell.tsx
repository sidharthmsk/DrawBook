import { useState, useRef, useEffect } from "react";

interface NumberCellProps {
  value: number | null;
  onChange: (value: number | null) => void;
}

export function NumberCell({ value, onChange }: NumberCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value?.toString() ?? "");
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, value]);

  if (!editing) {
    return (
      <div
        className="grid-cell__display grid-cell__display--number"
        onDoubleClick={() => setEditing(true)}
      >
        {value !== null && value !== undefined ? (
          value
        ) : (
          <span className="grid-cell__placeholder">Empty</span>
        )}
      </div>
    );
  }

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      onChange(null);
    } else {
      const num = Number(trimmed);
      if (!isNaN(num)) onChange(num);
    }
    setEditing(false);
  };

  return (
    <input
      ref={inputRef}
      className="grid-cell__input grid-cell__input--number"
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}
