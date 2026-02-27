import { useState, useRef, useEffect } from "react";

interface DateCellProps {
  value: string;
  onChange: (value: string) => void;
}

export function DateCell({ value, onChange }: DateCellProps) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!editing) {
    return (
      <div
        className="grid-cell__display"
        onDoubleClick={() => setEditing(true)}
      >
        {value ? (
          new Date(value + "T00:00:00").toLocaleDateString()
        ) : (
          <span className="grid-cell__placeholder">Empty</span>
        )}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      className="grid-cell__input grid-cell__input--date"
      type="date"
      value={value || ""}
      onChange={(e) => {
        onChange(e.target.value);
        setEditing(false);
      }}
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}
