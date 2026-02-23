import { useEffect, useRef } from "react";

type DocumentType =
  | "tldraw"
  | "excalidraw"
  | "drawio"
  | "markdown"
  | "spreadsheet"
  | "kanban";

interface MindMapContextMenuProps {
  position: { x: number; y: number } | null;
  nodeType: "folder" | "file" | "root" | null;
  nodeId: string | null;
  onCreateFile: (folderId: string | null, type: DocumentType) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRename: (id: string, kind: "doc" | "folder") => void;
  onDelete: (id: string, kind: "doc" | "folder") => void;
  onOpen: (id: string) => void;
  onClose: () => void;
}

const FILE_TYPES: { type: DocumentType; label: string; color: string }[] = [
  { type: "tldraw", label: "tldraw", color: "var(--accent)" },
  { type: "excalidraw", label: "Excalidraw", color: "var(--type-excalidraw)" },
  { type: "drawio", label: "Draw.io", color: "var(--type-drawio)" },
  { type: "markdown", label: "Markdown", color: "var(--type-markdown)" },
  {
    type: "spreadsheet",
    label: "Spreadsheet",
    color: "var(--type-spreadsheet)",
  },
  { type: "kanban", label: "Kanban", color: "var(--type-kanban)" },
];

export function MindMapContextMenu({
  position,
  nodeType,
  nodeId,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
  onOpen,
  onClose,
}: MindMapContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!position) return;
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as HTMLElement)
      ) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [position, onClose]);

  if (!position || !nodeType || !nodeId) return null;

  const folderId = nodeType === "root" ? null : nodeId;

  return (
    <div
      ref={menuRef}
      className="mindmap-context-menu"
      style={{ top: position.y, left: position.x }}
    >
      {nodeType === "file" && (
        <>
          <button
            onClick={() => {
              onOpen(nodeId);
              onClose();
            }}
          >
            Open
          </button>
          <button
            onClick={() => {
              onRename(nodeId, "doc");
              onClose();
            }}
          >
            Rename
          </button>
          <button
            className="danger"
            onClick={() => {
              onDelete(nodeId, "doc");
              onClose();
            }}
          >
            Delete
          </button>
        </>
      )}

      {(nodeType === "folder" || nodeType === "root") && (
        <>
          <div className="mindmap-context-menu__section-label">New file</div>
          {FILE_TYPES.map(({ type, label, color }) => (
            <button
              key={type}
              onClick={() => {
                onCreateFile(folderId, type);
                onClose();
              }}
            >
              <span
                className="mindmap-context-menu__dot"
                style={{ background: color }}
              />
              {label}
            </button>
          ))}
          <div className="mindmap-context-menu__divider" />
          <button
            onClick={() => {
              onCreateFolder(folderId);
              onClose();
            }}
          >
            New subfolder
          </button>
          {nodeType === "folder" && (
            <>
              <button
                onClick={() => {
                  onRename(nodeId, "folder");
                  onClose();
                }}
              >
                Rename
              </button>
              <button
                className="danger"
                onClick={() => {
                  onDelete(nodeId, "folder");
                  onClose();
                }}
              >
                Delete
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
