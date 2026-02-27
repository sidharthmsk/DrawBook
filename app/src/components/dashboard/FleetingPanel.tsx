import type { DocumentItem, DocumentType } from "./types";
import { TYPE_CONFIG, TYPE_ICONS } from "./DashboardIcons";

interface FleetingNote {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
  documentId?: string;
}

export function FleetingPanel({
  fleetingNotes,
  fleetingInput,
  setFleetingInput,
  fleetingTypeMenu,
  setFleetingTypeMenu,
  allDocs,
  onClose,
  addFleetingNote,
  toggleFleetingDone,
  deleteFleetingNote,
  openFleetingAs,
}: {
  fleetingNotes: FleetingNote[];
  fleetingInput: string;
  setFleetingInput: (v: string) => void;
  fleetingTypeMenu: string | null;
  setFleetingTypeMenu: (v: string | null) => void;
  allDocs: DocumentItem[];
  onClose: () => void;
  addFleetingNote: () => void;
  toggleFleetingDone: (noteId: string, done: boolean) => void;
  deleteFleetingNote: (noteId: string) => void;
  openFleetingAs: (noteId: string, type: DocumentType) => void;
}) {
  return (
    <>
      <div className="fleeting-panel">
        <div className="fleeting-panel__header">
          <h3>Quick Notes</h3>
          <button className="fleeting-panel__close" onClick={onClose}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <form
          className="fleeting-panel__input-row"
          onSubmit={(e) => {
            e.preventDefault();
            addFleetingNote();
          }}
        >
          <input
            className="fleeting-panel__input"
            value={fleetingInput}
            onChange={(e) => setFleetingInput(e.target.value)}
            placeholder="Jot something down..."
            autoFocus
          />
          <button
            className="fleeting-panel__add-btn"
            type="submit"
            disabled={!fleetingInput.trim()}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M8 3v10M3 8h10" />
            </svg>
          </button>
        </form>

        <div className="fleeting-panel__list">
          {fleetingNotes.length === 0 && (
            <p className="fleeting-panel__empty">
              No quick notes yet. Type above to capture a thought.
            </p>
          )}
          {fleetingNotes.map((note) => (
            <div
              key={note.id}
              className={`fleeting-panel__item${note.done ? " fleeting-panel__item--done" : ""}`}
            >
              <button
                className={`fleeting-panel__check${note.done ? " fleeting-panel__check--checked" : ""}`}
                onClick={() => toggleFleetingDone(note.id, !note.done)}
              >
                {note.done && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 8l3.5 3.5L13 5" />
                  </svg>
                )}
              </button>

              <span className="fleeting-panel__text">{note.text}</span>

              <div className="fleeting-panel__actions">
                {note.documentId ? (
                  <button
                    className="fleeting-panel__action-btn"
                    title="Open linked document"
                    onClick={() => {
                      const linkedDoc = allDocs.find(
                        (d) => d.id === note.documentId,
                      );
                      const docType = linkedDoc?.type || "markdown";
                      window.location.href = `/?doc=${note.documentId}&type=${docType}`;
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 11L11 5M11 5H6M11 5v5" />
                    </svg>
                  </button>
                ) : (
                  <button
                    className="fleeting-panel__action-btn"
                    title="Open as document"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFleetingTypeMenu(
                        fleetingTypeMenu === note.id ? null : note.id,
                      );
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 11L11 5M11 5H6M11 5v5" />
                    </svg>
                  </button>
                )}
                <button
                  className="fleeting-panel__action-btn fleeting-panel__action-btn--delete"
                  title="Delete"
                  onClick={() => deleteFleetingNote(note.id)}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {fleetingTypeMenu && (
        <div
          className="fleeting-panel__type-menu-overlay"
          onClick={() => setFleetingTypeMenu(null)}
        >
          <div
            className="fleeting-panel__type-menu"
            onClick={(e) => e.stopPropagation()}
          >
            {(
              [
                "markdown",
                "excalidraw",
                "kanban",
                "spreadsheet",
                "code",
              ] as DocumentType[]
            ).map((t) => {
              const conf = TYPE_CONFIG[t];
              const Icon = TYPE_ICONS[t];
              return (
                <button
                  key={t}
                  onClick={() => openFleetingAs(fleetingTypeMenu, t)}
                >
                  <span style={{ color: conf.color, display: "flex" }}>
                    <Icon />
                  </span>
                  <span>{conf.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
