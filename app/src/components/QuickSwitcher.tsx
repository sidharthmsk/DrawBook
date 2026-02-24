import { useState, useEffect, useRef, useCallback } from "react";

interface QuickSwitcherDoc {
  id: string;
  name: string;
  type: string;
  folderId: string | null;
}

interface QuickSwitcherProps {
  folders: Array<{ id: string; name: string; parentId: string | null }>;
}

export function QuickSwitcher({ folders }: QuickSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [docs, setDocs] = useState<QuickSwitcherDoc[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedIndex(0);
    fetch("/api/documents")
      .then((r) => r.json())
      .then((data) => setDocs(data.documents || []))
      .catch(() => {});
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const getFolderPath = useCallback(
    (folderId: string | null): string => {
      if (!folderId) return "";
      const parts: string[] = [];
      let cur: string | null = folderId;
      while (cur) {
        const f = folders.find((fo) => fo.id === cur);
        if (!f) break;
        parts.unshift(f.name);
        cur = f.parentId;
      }
      return parts.join(" / ");
    },
    [folders],
  );

  const filtered = query.trim()
    ? docs.filter((d) =>
        d.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : docs;

  const navigate = (docId: string) => {
    setOpen(false);
    window.location.href = `/?doc=${docId}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      navigate(filtered[selectedIndex].id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!open) return null;

  const TYPE_COLORS: Record<string, string> = {
    tldraw: "var(--accent)",
    excalidraw: "var(--type-excalidraw, #6c5ce7)",
    drawio: "var(--type-drawio, #f39c12)",
    markdown: "var(--type-markdown, #00b894)",
    spreadsheet: "var(--type-spreadsheet, #0984e3)",
    kanban: "var(--type-kanban, #e17055)",
    pdf: "var(--type-pdf, #d63031)",
  };

  return (
    <div className="quick-switcher-overlay" onClick={() => setOpen(false)}>
      <div className="quick-switcher" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="quick-switcher__input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search documents..."
        />
        <div className="quick-switcher__results">
          {filtered.length === 0 && (
            <div className="quick-switcher__empty">No documents found</div>
          )}
          {filtered.slice(0, 20).map((doc, i) => (
            <button
              key={doc.id}
              className={`quick-switcher__item${i === selectedIndex ? " quick-switcher__item--selected" : ""}`}
              onClick={() => navigate(doc.id)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span
                className="quick-switcher__type-dot"
                style={{
                  background: TYPE_COLORS[doc.type] || "var(--text-secondary)",
                }}
              />
              <span className="quick-switcher__name">{doc.name}</span>
              {doc.folderId && (
                <span className="quick-switcher__path">
                  {getFolderPath(doc.folderId)}
                </span>
              )}
              <span className="quick-switcher__type-badge">{doc.type}</span>
            </button>
          ))}
        </div>
        <div className="quick-switcher__footer">
          <kbd>↑↓</kbd> navigate <kbd>↵</kbd> open <kbd>esc</kbd> close
        </div>
      </div>
    </div>
  );
}
