import { useState, useRef, useEffect } from "react";

interface UrlCellProps {
  value: string;
  onChange: (value: string) => void;
}

export function UrlCell({ value, onChange }: UrlCellProps) {
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
    const safeHref = value && /^https?:\/\//i.test(value) ? value : undefined;
    return (
      <div
        className="grid-cell__display grid-cell__display--url"
        onDoubleClick={() => setEditing(true)}
      >
        {value ? (
          safeHref ? (
            <a
              className="grid-cell__url-link"
              href={safeHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {value}
            </a>
          ) : (
            <span className="grid-cell__url-link grid-cell__url-link--invalid">
              {value}
            </span>
          )
        ) : (
          <span className="grid-cell__placeholder">Empty</span>
        )}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      className="grid-cell__input"
      type="url"
      placeholder="https://..."
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
