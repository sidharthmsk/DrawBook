import { useState, useRef, useEffect } from "react";

interface LongTextCellProps {
  value: string;
  onChange: (value: string) => void;
}

export function LongTextCell({ value, onChange }: LongTextCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.select();
        ta.style.height = "auto";
        ta.style.height = ta.scrollHeight + "px";
      }
    }
  }, [editing, value]);

  if (!editing) {
    return (
      <div
        className="grid-cell__display grid-cell__display--longtext"
        onDoubleClick={() => setEditing(true)}
        title={value}
      >
        {value || <span className="grid-cell__placeholder">Empty</span>}
      </div>
    );
  }

  return (
    <div className="grid-cell__longtext-editor">
      <textarea
        ref={textareaRef}
        className="grid-cell__textarea"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = e.target.scrollHeight + "px";
        }}
        onBlur={() => {
          onChange(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            onChange(draft);
            setEditing(false);
          }
        }}
      />
    </div>
  );
}
