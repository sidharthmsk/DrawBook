import { useState } from "react";
import type { DocumentItem, DocumentType } from "./types";
import { TYPE_CONFIG, TYPE_ICONS } from "./DashboardIcons";

interface FleetingNote {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
  documentId?: string;
}

interface Task {
  id: string;
  text: string;
  done: boolean;
  documentId: string;
  createdAt: string;
}

export function TasksView({
  tasks,
  fleetingNotes,
  fleetingInput,
  setFleetingInput,
  taskFilter,
  setTaskFilter,
  allDocs,
  openDoc,
  addFleetingNote,
  toggleFleetingDone,
  deleteFleetingNote,
  openFleetingAs,
  toggleTaskDone,
  deleteTask,
}: {
  tasks: Task[];
  fleetingNotes: FleetingNote[];
  fleetingInput: string;
  setFleetingInput: (v: string) => void;
  taskFilter: "all" | "open" | "done";
  setTaskFilter: (v: "all" | "open" | "done") => void;
  allDocs: DocumentItem[];
  openDoc: (doc: DocumentItem) => void;
  addFleetingNote: () => void;
  toggleFleetingDone: (noteId: string, done: boolean) => void;
  deleteFleetingNote: (noteId: string) => void;
  openFleetingAs: (noteId: string, type: DocumentType) => void;
  toggleTaskDone: (taskId: string, done: boolean) => void;
  deleteTask: (taskId: string) => void;
}) {
  const [tasksViewTypeMenu, setTasksViewTypeMenu] = useState<string | null>(
    null,
  );

  const filteredTasks = tasks.filter((t) =>
    taskFilter === "all" ? true : taskFilter === "open" ? !t.done : t.done,
  );

  const filteredNotes = fleetingNotes.filter((n) =>
    taskFilter === "all" ? true : taskFilter === "open" ? !n.done : n.done,
  );

  const unlinkedNotes = filteredNotes.filter((n) => !n.documentId);
  const linkedNotes = filteredNotes.filter((n) => n.documentId);

  const grouped = new Map<string, Task[]>();
  for (const t of filteredTasks) {
    const key = t.documentId;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(t);
  }
  for (const n of linkedNotes) {
    const key = n.documentId!;
    if (!grouped.has(key)) grouped.set(key, []);
  }

  return (
    <section className="tasks-view">
      <div className="tasks-view__header">
        <h3>Tasks</h3>
        <div className="tasks-view__filters">
          {(["all", "open", "done"] as const).map((f) => (
            <button
              key={f}
              className={`tasks-view__filter-btn${taskFilter === f ? " tasks-view__filter-btn--active" : ""}`}
              onClick={() => setTaskFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <form
        className="tasks-view__quick-add"
        onSubmit={(e) => {
          e.preventDefault();
          addFleetingNote();
        }}
      >
        <input
          className="tasks-view__quick-add-input"
          value={fleetingInput}
          onChange={(e) => setFleetingInput(e.target.value)}
          placeholder="Quick add a note..."
        />
        <button
          className="tasks-view__quick-add-btn"
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

      {filteredTasks.length === 0 && filteredNotes.length === 0 ? (
        <div className="empty-state">
          <p>
            {taskFilter === "all"
              ? "No tasks yet. Use the input above to jot down a quick note, or add tasks from inside any document."
              : taskFilter === "open"
                ? "No open tasks."
                : "No completed tasks."}
          </p>
        </div>
      ) : (
        <div className="tasks-view__groups">
          {unlinkedNotes.length > 0 && (
            <div className="tasks-view__group">
              <div className="tasks-view__group-header">
                <span className="tasks-view__group-label">Quick Notes</span>
              </div>
              {unlinkedNotes.map((note) => (
                <div
                  key={note.id}
                  className={`tasks-view__item${note.done ? " tasks-view__item--done" : ""}`}
                >
                  <button
                    className={`tasks-view__check${note.done ? " tasks-view__check--checked" : ""}`}
                    onClick={() => toggleFleetingDone(note.id, !note.done)}
                  >
                    {note.done && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </button>
                  <span className="tasks-view__text">{note.text}</span>
                  <div className="tasks-view__item-actions">
                    <button
                      className="tasks-view__open-as"
                      title="Open as note"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTasksViewTypeMenu(
                          tasksViewTypeMenu === note.id ? null : note.id,
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
                    <button
                      className="tasks-view__delete"
                      onClick={() => deleteFleetingNote(note.id)}
                      title="Delete"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      >
                        <path d="M3 3l6 6M9 3l-6 6" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {Array.from(grouped.entries()).map(([docId, docTasks]) => {
            const doc = allDocs.find((d) => d.id === docId);
            const docName = doc?.name || doc?.id || docId;
            const docType = doc?.type as DocumentType | undefined;
            const isDeleted = !doc;
            const docLinkedNotes = linkedNotes.filter(
              (n) => n.documentId === docId,
            );
            return (
              <div key={docId} className="tasks-view__group">
                <div className="tasks-view__group-header">
                  <button
                    className={`tasks-view__doc-link${isDeleted ? " tasks-view__doc-link--deleted" : ""}`}
                    onClick={() => {
                      if (!isDeleted && doc) openDoc(doc);
                    }}
                    disabled={isDeleted}
                    title={
                      isDeleted
                        ? "Document no longer exists"
                        : `Open ${docName}`
                    }
                  >
                    {docType && TYPE_CONFIG[docType] && (
                      <span
                        style={{
                          color: TYPE_CONFIG[docType].color,
                          marginRight: 6,
                        }}
                      >
                        {TYPE_CONFIG[docType].label}
                      </span>
                    )}
                    {docName}
                    {isDeleted && (
                      <span className="tasks-view__deleted-badge">deleted</span>
                    )}
                  </button>
                </div>
                {docLinkedNotes.map((note) => (
                  <div
                    key={note.id}
                    className={`tasks-view__item${note.done ? " tasks-view__item--done" : ""}`}
                  >
                    <button
                      className={`tasks-view__check${note.done ? " tasks-view__check--checked" : ""}`}
                      onClick={() => toggleFleetingDone(note.id, !note.done)}
                    >
                      {note.done && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </button>
                    <span className="tasks-view__text tasks-view__text--note">
                      {note.text}
                    </span>
                    <button
                      className="tasks-view__delete"
                      onClick={() => deleteFleetingNote(note.id)}
                      title="Delete"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      >
                        <path d="M3 3l6 6M9 3l-6 6" />
                      </svg>
                    </button>
                  </div>
                ))}
                {docTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`tasks-view__item${task.done ? " tasks-view__item--done" : ""}`}
                  >
                    <button
                      className={`tasks-view__check${task.done ? " tasks-view__check--checked" : ""}`}
                      onClick={() => toggleTaskDone(task.id, !task.done)}
                    >
                      {task.done && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </button>
                    <span className="tasks-view__text">{task.text}</span>
                    <button
                      className="tasks-view__delete"
                      onClick={() => deleteTask(task.id)}
                      title="Delete task"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      >
                        <path d="M3 3l6 6M9 3l-6 6" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {tasksViewTypeMenu && (
        <div
          className="fleeting-panel__type-menu-overlay"
          onClick={() => setTasksViewTypeMenu(null)}
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
                  onClick={() => {
                    openFleetingAs(tasksViewTypeMenu, t);
                    setTasksViewTypeMenu(null);
                  }}
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
    </section>
  );
}
