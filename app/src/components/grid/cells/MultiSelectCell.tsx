import { useState, useRef, useEffect } from "react";
import { OPTION_COLORS } from "../types";

interface MultiSelectCellProps {
  value: string[];
  options: string[];
  onChange: (value: string[]) => void;
  onAddOption: (option: string) => void;
}

export function MultiSelectCell({
  value,
  options,
  onChange,
  onAddOption,
}: MultiSelectCellProps) {
  const [open, setOpen] = useState(false);
  const [newOpt, setNewOpt] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const colorFor = (opt: string) =>
    OPTION_COLORS[options.indexOf(opt) % OPTION_COLORS.length];

  const toggle = (opt: string) => {
    if (value.includes(opt)) {
      onChange(value.filter((v) => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  };

  return (
    <div className="grid-cell__select-wrap" ref={wrapRef}>
      <div
        className="grid-cell__display grid-cell__display--multiselect"
        onClick={() => setOpen(!open)}
      >
        {value.length > 0 ? (
          <div className="grid-cell__pills">
            {value.map((v) => (
              <span
                key={v}
                className="grid-cell__pill"
                style={{
                  backgroundColor: colorFor(v) + "22",
                  color: colorFor(v),
                }}
              >
                {v}
              </span>
            ))}
          </div>
        ) : (
          <span className="grid-cell__placeholder">Select...</span>
        )}
      </div>
      {open && (
        <div className="grid-cell__dropdown">
          {options.map((opt) => (
            <button
              key={opt}
              className={`grid-cell__dropdown-item${value.includes(opt) ? " grid-cell__dropdown-item--active" : ""}`}
              onClick={() => toggle(opt)}
            >
              <div
                className={`grid-cell__check-icon${value.includes(opt) ? " grid-cell__check-icon--checked" : ""}`}
              >
                {value.includes(opt) && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M2 5L4 7L8 3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <span
                className="grid-cell__pill"
                style={{
                  backgroundColor: colorFor(opt) + "22",
                  color: colorFor(opt),
                }}
              >
                {opt}
              </span>
            </button>
          ))}
          <div className="grid-cell__dropdown-add">
            <input
              className="grid-cell__dropdown-input"
              placeholder="Add option..."
              value={newOpt}
              onChange={(e) => setNewOpt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newOpt.trim()) {
                  onAddOption(newOpt.trim());
                  onChange([...value, newOpt.trim()]);
                  setNewOpt("");
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
