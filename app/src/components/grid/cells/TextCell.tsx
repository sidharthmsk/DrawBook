import { useState, useRef, useEffect } from "react";

interface TextCellProps {
  value: string;
  onChange: (value: string) => void;
}

export function TextCell({ value, onChange }: TextCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, value]);

  if (!editing) {
    return (
      <div
        className="grid-cell__display"
        onDoubleClick={() => setEditing(true)}
      >
        {value || <span className="grid-cell__placeholder">Empty</span>}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      className="grid-cell__input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        onChange(draft);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onChange(draft);
          setEditing(false);
        }
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}
