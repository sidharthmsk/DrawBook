import { useState, useEffect, useRef, useCallback } from "react";

interface DocEntry {
  id: string;
  name: string;
  type: string;
}

export interface AttachedContext {
  id: string;
  name: string;
  type: string;
  context: string;
}

interface DocumentContextPickerProps {
  currentDocumentId?: string;
  attachedDocs: AttachedContext[];
  onAttach: (doc: AttachedContext) => void;
  onDetach: (docId: string) => void;
}

export function DocumentContextPicker({
  currentDocumentId,
  attachedDocs,
  onAttach,
  onDetach,
}: DocumentContextPickerProps) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/documents")
      .then((r) => r.json())
      .then((data) => {
        const all: DocEntry[] = (data.documents || []).filter(
          (d: DocEntry) => d.id !== currentDocumentId,
        );
        setDocs(all);
      })
      .catch(() => {});
    searchRef.current?.focus();
  }, [open, currentDocumentId]);

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

  const handleAttach = useCallback(
    async (doc: DocEntry) => {
      if (attachedDocs.some((d) => d.id === doc.id)) return;
      setLoadingId(doc.id);
      try {
        const res = await fetch(`/api/document-context/${doc.id}`);
        const data = await res.json();
        onAttach({
          id: doc.id,
          name: data.name || doc.name,
          type: data.type || doc.type,
          context: data.context || "",
        });
      } catch {
        console.warn("Failed to load context for", doc.id);
      } finally {
        setLoadingId(null);
      }
    },
    [attachedDocs, onAttach],
  );

  const filtered = docs.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) &&
      !attachedDocs.some((a) => a.id === d.id),
  );

  return (
    <div className="ctx-picker" ref={wrapRef}>
      {attachedDocs.length > 0 && (
        <div className="ctx-picker__attached">
          {attachedDocs.map((doc) => (
            <div key={doc.id} className="ctx-picker__chip">
              <span className="ctx-picker__chip-icon">
                {typeIcon(doc.type)}
              </span>
              <span className="ctx-picker__chip-name" title={doc.name}>
                {doc.name}
              </span>
              <button
                className="ctx-picker__chip-remove"
                onClick={() => onDetach(doc.id)}
                title="Remove context"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M2 2l6 6M8 2l-6 6" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        className={`ctx-picker__btn${open ? " ctx-picker__btn--active" : ""}`}
        onClick={() => setOpen(!open)}
        title="Attach context from another document"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        >
          <path d="M6 2v8M2 6h8" />
        </svg>
        <span>Add context</span>
      </button>
      {open && (
        <div className="ctx-picker__dropdown">
          <input
            ref={searchRef}
            className="ctx-picker__search"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="ctx-picker__list">
            {filtered.length === 0 && (
              <div className="ctx-picker__empty">
                {docs.length === 0 ? "Loading..." : "No documents found"}
              </div>
            )}
            {filtered.slice(0, 20).map((doc) => (
              <button
                key={doc.id}
                className="ctx-picker__item"
                onClick={() => handleAttach(doc)}
                disabled={loadingId === doc.id}
              >
                <span className="ctx-picker__item-icon">
                  {typeIcon(doc.type)}
                </span>
                <span className="ctx-picker__item-name">{doc.name}</span>
                <span className="ctx-picker__item-type">{doc.type}</span>
                {loadingId === doc.id && (
                  <span className="ctx-picker__item-loading">...</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function typeIcon(type: string): string {
  switch (type) {
    case "markdown":
      return "\u00b6";
    case "kanban":
      return "\u2630";
    case "spreadsheet":
      return "\u25a6";
    case "grid":
      return "\u25a6";
    case "code":
      return "</>";
    case "excalidraw":
      return "\u270e";
    case "tldraw":
      return "\u25cb";
    case "drawio":
      return "\u25c7";
    default:
      return "\u25a1";
  }
}
