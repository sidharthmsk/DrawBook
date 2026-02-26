import { useState, useEffect, useRef, type ReactNode } from "react";
import { EditableTitle } from "./EditableTitle";
import { AiChatPanel } from "./ai/AiChatPanel";
import type { EditorAdapter } from "./ai/EditorAdapter";
import { useIsMobile } from "../hooks/useIsMobile";
import { openCommandPalette } from "./CommandPalette";
import { ShareModal } from "./ShareModal";
import { useConfirm } from "./ConfirmDialog";

interface DocMeta {
  type?: string;
  createdAt?: string;
  tags?: string[];
  folderId?: string | null;
  name?: string;
}

interface EditorShellProps {
  documentId: string;
  adapter: EditorAdapter | null;
  saveStatus: "saved" | "saving" | "error" | "syncing";
  children: ReactNode;
  contentClassName?: string;
  onExport?: () => void;
  exportLabel?: string;
  exportExtra?: ReactNode;
}

function MobileOverflowMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="mobile-overflow" ref={menuRef}>
      <button
        className="mobile-overflow__trigger"
        onClick={() => setOpen((v) => !v)}
        title="More actions"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="13" cy="8" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="mobile-overflow__menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

export function EditorShell({
  documentId,
  adapter,
  saveStatus,
  children,
  contentClassName,
  onExport,
  exportLabel,
  exportExtra,
}: EditorShellProps) {
  const isMobile = useIsMobile();
  const confirm = useConfirm();
  const [aiOpen, setAiOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [isMultiUser, setIsMultiUser] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskInput, setTaskInput] = useState("");
  const [docTasks, setDocTasks] = useState<
    Array<{
      id: string;
      text: string;
      done: boolean;
      documentId: string;
      createdAt: string;
    }>
  >([]);
  const taskPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => setIsMultiUser(!!data.multiUser))
      .catch(() => {});
  }, []);
  const [versions, setVersions] = useState<
    Array<{ index: number; timestamp: string }>
  >([]);
  const [docMeta, setDocMeta] = useState<DocMeta | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<
    Array<{ id: string | null; name: string }>
  >([]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "a"
      ) {
        e.preventDefault();
        setAiOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Listen for command palette actions
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.action) return;

      switch (detail.action) {
        case "toggleAi":
          setAiOpen((v) => !v);
          break;
        case "info":
          setInfoOpen((v) => !v);
          break;
        case "history":
          setVersionOpen((v) => {
            if (!v) {
              fetch(`/api/versions/${documentId}`)
                .then((r) => r.json())
                .then((data) => setVersions(data.versions || []))
                .catch(() => {});
            }
            return !v;
          });
          break;
        case "template": {
          setTemplateSaving(true);
          const name = window.prompt("Template name:");
          if (!name?.trim()) {
            setTemplateSaving(false);
            return;
          }
          fetch(`/api/templates/from-doc/${documentId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim() }),
          })
            .catch((err) => console.error("Save as template failed:", err))
            .finally(() => setTemplateSaving(false));
          break;
        }
        case "delete": {
          const ok = await confirm({
            message: "Delete this document? It will be moved to trash.",
            confirmLabel: "Delete",
            danger: true,
          });
          if (ok) {
            fetch(`/api/delete/${documentId}`, { method: "DELETE" })
              .then(() => {
                window.location.href = "/";
              })
              .catch((err) => console.error("Delete failed:", err));
          }
          break;
        }
        case "move": {
          const folderId = window.prompt(
            "Enter folder ID to move to (or leave empty for root):",
          );
          if (folderId === null) return;
          fetch(`/api/documents/${documentId}/move`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folderId: folderId.trim() || null }),
          }).catch((err) => console.error("Move failed:", err));
          break;
        }
      }
    };
    document.addEventListener("command-palette-action", handler);
    return () =>
      document.removeEventListener("command-palette-action", handler);
  }, [documentId, confirm]);

  useEffect(() => {
    async function loadBreadcrumbs() {
      try {
        const metaRes = await fetch(`/api/meta/${documentId}`);
        const meta = await metaRes.json();
        setDocMeta(meta);
        const crumbs: Array<{ id: string | null; name: string }> = [
          { id: null, name: "Home" },
        ];
        if (meta.folderId) {
          const foldersRes = await fetch("/api/folders");
          const foldersData = await foldersRes.json();
          const folders = foldersData.folders || [];
          const chain: Array<{ id: string; name: string }> = [];
          let cur = meta.folderId;
          while (cur) {
            const f = folders.find((fo: any) => fo.id === cur);
            if (!f) break;
            chain.unshift({ id: f.id, name: f.name });
            cur = f.parentId;
          }
          crumbs.push(...chain);
        }
        setBreadcrumbs(crumbs);
      } catch {}
    }
    loadBreadcrumbs();
  }, [documentId]);

  const loadDocTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setDocTasks(
        (data.tasks || []).filter(
          (t: { documentId: string }) => t.documentId === documentId,
        ),
      );
    } catch (err) {
      console.error("Failed to load tasks:", err);
    }
  };

  const addDocTask = async () => {
    if (!taskInput.trim()) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: taskInput.trim(), documentId }),
      });
      if (!res.ok) throw new Error("Create failed");
      const data = await res.json();
      setDocTasks((prev) => [data.task, ...prev]);
      setTaskInput("");
    } catch (err) {
      console.error("Failed to add task:", err);
    }
  };

  const toggleDocTask = async (taskId: string, done: boolean) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done }),
      });
      setDocTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, done } : t)),
      );
    } catch (err) {
      console.error("Failed to toggle task:", err);
    }
  };

  const deleteDocTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      setDocTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  useEffect(() => {
    if (!taskOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        taskPopoverRef.current &&
        !taskPopoverRef.current.contains(e.target as Node)
      ) {
        setTaskOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [taskOpen]);

  const statusLabel =
    saveStatus === "saved"
      ? "Saved"
      : saveStatus === "saving"
        ? "Saving..."
        : saveStatus === "syncing"
          ? "Syncing..."
          : "Error";
  const dotClass =
    saveStatus === "error"
      ? "error"
      : saveStatus === "saved"
        ? "saved"
        : "saving";

  const infoButton = (
    <button
      className={`editor-export-btn${infoOpen ? " editor-export-btn--active" : ""}`}
      onClick={() => setInfoOpen((v) => !v)}
      title="Document Info"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="8" cy="8" r="6" />
        <path d="M8 7v4M8 5.5v0" />
      </svg>
      <span>Info</span>
    </button>
  );

  const historyButton = (
    <button
      className={`editor-topbar-btn${versionOpen ? " editor-topbar-btn--active" : ""}`}
      onClick={() => {
        setVersionOpen((v) => !v);
        if (!versionOpen) {
          fetch(`/api/versions/${documentId}`)
            .then((r) => r.json())
            .then((data) => setVersions(data.versions || []))
            .catch(() => {});
        }
      }}
      title="Version history"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="8" cy="8" r="6" />
        <path d="M8 5v3l2 2" />
      </svg>
      <span>History</span>
    </button>
  );

  const exportButton = onExport ? (
    <button
      className="editor-export-btn"
      onClick={onExport}
      title={exportLabel || "Export"}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 2v9M4 8l4 4 4-4M2 14h12" />
      </svg>
      <span>{exportLabel || "Export"}</span>
    </button>
  ) : null;

  const templateButton = (
    <button
      className="editor-export-btn"
      disabled={templateSaving}
      onClick={async () => {
        setTemplateSaving(true);
        try {
          const name = window.prompt("Template name:");
          if (!name?.trim()) return;
          const res = await fetch(`/api/templates/from-doc/${documentId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim() }),
          });
          if (!res.ok) throw new Error("Save failed");
        } catch (err) {
          console.error("Save as template failed:", err);
        } finally {
          setTemplateSaving(false);
        }
      }}
      title="Save as Template"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="2" width="12" height="12" rx="1" />
        <path d="M5 2v5l2.5-1.5L10 7V2" />
      </svg>
      <span>{templateSaving ? "Saving..." : "Template"}</span>
    </button>
  );

  const taskButton = (
    <div className="editor-task-popover-wrapper" ref={taskPopoverRef}>
      <button
        className={`editor-export-btn${taskOpen ? " editor-export-btn--active" : ""}`}
        onClick={() => {
          setTaskOpen((v) => {
            if (!v) loadDocTasks();
            return !v;
          });
        }}
        title="Document Tasks"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="2" width="12" height="12" rx="2" />
          <path d="M5 8l2 2 4-4" />
        </svg>
        <span>Tasks</span>
      </button>
      {taskOpen && (
        <div className="editor-task-popover">
          <form
            className="editor-task-popover__form"
            onSubmit={(e) => {
              e.preventDefault();
              addDocTask();
            }}
          >
            <input
              className="editor-task-popover__input"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              placeholder="Add a task..."
              autoFocus
            />
            <button className="editor-task-popover__add" type="submit">
              Add
            </button>
          </form>
          <div className="editor-task-popover__list">
            {docTasks.length === 0 && (
              <p className="editor-task-popover__empty">
                No tasks for this document yet.
              </p>
            )}
            {docTasks.map((task) => (
              <div
                key={task.id}
                className={`editor-task-popover__item${task.done ? " editor-task-popover__item--done" : ""}`}
              >
                <button
                  className={`editor-task-popover__check${task.done ? " editor-task-popover__check--checked" : ""}`}
                  onClick={() => toggleDocTask(task.id, !task.done)}
                >
                  {task.done && (
                    <svg
                      width="10"
                      height="10"
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
                <span className="editor-task-popover__text">{task.text}</span>
                <button
                  className="editor-task-popover__delete"
                  onClick={() => deleteDocTask(task.id)}
                  title="Delete task"
                >
                  <svg
                    width="10"
                    height="10"
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
        </div>
      )}
    </div>
  );

  const shareButton = isMultiUser ? (
    <button
      className="editor-export-btn"
      onClick={() => setShareOpen(true)}
      title="Share document"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="3" r="2" />
        <circle cx="12" cy="13" r="2" />
        <circle cx="4" cy="8" r="2" />
        <path d="M6 9l4 3M6 7l4-3" />
      </svg>
      <span>Share</span>
    </button>
  ) : null;

  const paletteButton = (
    <button
      className="editor-topbar-btn"
      onClick={() => openCommandPalette("actions")}
      title="Command Palette"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 4l4 4-4 4" />
        <rect x="1" y="1" width="14" height="14" rx="3" />
      </svg>
      <span className="editor-topbar__btn-label">Actions</span>
    </button>
  );

  const aiToggle = adapter ? (
    <button
      className={`ai-toggle-btn${aiOpen ? " ai-toggle-btn--active" : ""}`}
      onClick={() => setAiOpen((v) => !v)}
      title="Toggle AI Assistant"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
        <path d="M18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
      </svg>
      <span className="editor-topbar__btn-label">AI</span>
    </button>
  ) : null;

  return (
    <div className="editor-wrapper">
      <div className="editor-topbar">
        <button
          className="editor-back-btn"
          onClick={() => (window.location.href = "/")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 12L6 8l4-4" />
          </svg>
          <span className="editor-topbar__btn-label">Back</span>
        </button>
        {!isMobile && breadcrumbs.length > 0 && (
          <nav className="editor-breadcrumbs">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.id ?? "home"}>
                {i > 0 && <span className="editor-breadcrumbs__sep">/</span>}
                <a
                  className="editor-breadcrumbs__link"
                  href={crumb.id ? `/?folder=${crumb.id}` : "/"}
                >
                  {crumb.name}
                </a>
              </span>
            ))}
            <span className="editor-breadcrumbs__sep">/</span>
          </nav>
        )}
        <EditableTitle documentId={documentId} />
        <div className="editor-topbar__right">
          <div className="editor-topbar__status">
            <span
              className={`editor-status-dot editor-status-dot--${dotClass}`}
            />
            <span className="editor-topbar__status-label">{statusLabel}</span>
          </div>
          {isMobile ? (
            <>
              {paletteButton}
              <MobileOverflowMenu>
                {infoButton}
                {historyButton}
                {exportButton}
                {exportExtra}
                {templateButton}
                {taskButton}
                {shareButton}
              </MobileOverflowMenu>
              {aiToggle}
            </>
          ) : (
            <>
              {infoButton}
              {historyButton}
              {exportButton}
              {exportExtra}
              {templateButton}
              {taskButton}
              {shareButton}
              {paletteButton}
              {aiToggle}
            </>
          )}
        </div>
      </div>
      {infoOpen && docMeta && (
        <div className="editor-info-bar">
          <span>
            <strong>Type:</strong> {docMeta.type || "unknown"}
          </span>
          {docMeta.createdAt && (
            <span>
              <strong>Created:</strong>{" "}
              {new Date(docMeta.createdAt).toLocaleDateString()}
            </span>
          )}
          {docMeta.folderId && (
            <span>
              <strong>Folder:</strong> {docMeta.folderId}
            </span>
          )}
          {docMeta.tags && docMeta.tags.length > 0 && (
            <span>
              <strong>Tags:</strong> {docMeta.tags.join(", ")}
            </span>
          )}
        </div>
      )}
      {versionOpen && (
        <div className="editor-version-bar">
          <strong>Version History</strong>
          {versions.length === 0 ? (
            <span className="editor-version-bar__empty">
              No versions saved yet. Versions are created on each save.
            </span>
          ) : (
            <div className="editor-version-bar__list">
              {versions.map((v) => (
                <div key={v.index} className="editor-version-bar__item">
                  <span>{new Date(v.timestamp).toLocaleString()}</span>
                  <button
                    className="editor-version-bar__restore"
                    onClick={async () => {
                      try {
                        const res = await fetch(
                          `/api/versions/${documentId}/restore`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ index: v.index }),
                          },
                        );
                        if (res.ok) {
                          window.location.reload();
                        }
                      } catch (err) {
                        console.error("Restore failed:", err);
                      }
                    }}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="editor-content">
        <div className={contentClassName || "editor-canvas"}>{children}</div>
        {!isMobile && aiOpen && adapter && (
          <AiChatPanel
            adapter={adapter}
            onClose={() => setAiOpen(false)}
            documentId={documentId}
          />
        )}
      </div>
      {isMobile && aiOpen && adapter && (
        <div className="ai-mobile-overlay">
          <AiChatPanel
            adapter={adapter}
            onClose={() => setAiOpen(false)}
            documentId={documentId}
            fullScreen
          />
        </div>
      )}
      {shareOpen && (
        <ShareModal
          documentId={documentId}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
