import { useState, useRef, useEffect } from "react";
import { OPTION_COLORS } from "../types";

interface SelectCellProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onAddOption: (option: string) => void;
}

export function SelectCell({
  value,
  options,
  onChange,
  onAddOption,
}: SelectCellProps) {
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

  return (
    <div className="grid-cell__select-wrap" ref={wrapRef}>
      <div className="grid-cell__display" onClick={() => setOpen(!open)}>
        {value ? (
          <span
            className="grid-cell__pill"
            style={{
              backgroundColor: colorFor(value) + "22",
              color: colorFor(value),
            }}
          >
            {value}
          </span>
        ) : (
          <span className="grid-cell__placeholder">Select...</span>
        )}
      </div>
      {open && (
        <div className="grid-cell__dropdown">
          {value && (
            <button
              className="grid-cell__dropdown-item grid-cell__dropdown-item--clear"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </button>
          )}
          {options.map((opt) => (
            <button
              key={opt}
              className={`grid-cell__dropdown-item${opt === value ? " grid-cell__dropdown-item--active" : ""}`}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
            >
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
                  onChange(newOpt.trim());
                  setNewOpt("");
                  setOpen(false);
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
