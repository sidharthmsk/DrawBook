import type { DocumentItem } from "./types";

export function TagEditModal({
  tagEditDocId,
  allDocs,
  tagInput,
  setTagInput,
  saveDocTags,
  onClose,
}: {
  tagEditDocId: string;
  allDocs: DocumentItem[];
  tagInput: string;
  setTagInput: (v: string) => void;
  saveDocTags: (docId: string, tags: string[]) => void;
  onClose: () => void;
}) {
  const doc = allDocs.find((d) => d.id === tagEditDocId);
  const currentTags = doc?.tags || [];
  return (
    <div className="quick-switcher-overlay" onClick={onClose}>
      <div
        className="kanban-detail"
        style={{ width: 400 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="kanban-detail__close" onClick={onClose}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Edit Tags</h3>
        <div className="kanban-detail__labels">
          {currentTags.map((t) => (
            <span
              key={t}
              className="tag-filter-btn tag-filter-btn--active"
              style={{ cursor: "pointer" }}
              onClick={() => {
                const next = currentTags.filter((x) => x !== t);
                saveDocTags(tagEditDocId, next);
              }}
            >
              {t} &times;
            </span>
          ))}
          <input
            className="kanban-detail__label-input"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && tagInput.trim()) {
                e.preventDefault();
                const val = tagInput.trim();
                if (!currentTags.includes(val)) {
                  saveDocTags(tagEditDocId, [...currentTags, val]);
                }
                setTagInput("");
              }
              if (e.key === "Escape") onClose();
            }}
            placeholder="Type tag and press Enter..."
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
