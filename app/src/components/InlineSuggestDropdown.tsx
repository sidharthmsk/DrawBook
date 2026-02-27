import { useState, useEffect, useRef } from "react";
import { fetchAllDocs } from "./documentLinkUtils";
import type { DocOption } from "./documentLinkUtils";

export function InlineSuggestDropdown({
  query,
  position,
  onSelect,
  onClose,
}: {
  query: string;
  position: { top: number; left: number };
  onSelect: (doc: DocOption) => void;
  onClose: () => void;
}) {
  const [docs, setDocs] = useState<DocOption[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAllDocs().then(setDocs);
  }, []);

  const filtered = docs.filter((d) =>
    d.name.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered.length > 0) {
        e.preventDefault();
        onSelect(filtered[selectedIdx]);
      } else if (e.key === "Escape" || e.key === "Backspace") {
        // Close on Escape; let Backspace propagate but check if [[ was deleted
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [filtered, selectedIdx, onSelect, onClose]);

  return (
    <div
      className="inline-suggest"
      style={{ position: "fixed", top: position.top, left: position.left }}
    >
      <div className="inline-suggest__header">Link to document</div>
      <div className="inline-suggest__list" ref={listRef}>
        {filtered.slice(0, 8).map((doc, i) => (
          <div
            key={doc.id}
            className={`inline-suggest__item${i === selectedIdx ? " inline-suggest__item--active" : ""}`}
            onClick={() => onSelect(doc)}
            onMouseEnter={() => setSelectedIdx(i)}
          >
            <span className="inline-suggest__name">{doc.name}</span>
            <span className="inline-suggest__type">{doc.type}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="inline-suggest__empty">No matches</div>
        )}
      </div>
    </div>
  );
}
