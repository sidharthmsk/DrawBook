import { useEffect, useRef, useState } from "react";

type DocumentType =
  | "tldraw"
  | "excalidraw"
  | "drawio"
  | "markdown"
  | "spreadsheet"
  | "kanban"
  | "code";

interface FolderNode {
  folder: { id: string; name: string; parentId: string | null };
  children: FolderNode[];
  depth: number;
}

interface MindMapContextMenuProps {
  position: { x: number; y: number } | null;
  nodeType: "folder" | "file" | "root" | null;
  nodeId: string | null;
  folderTree: FolderNode[];
  onCreateFile: (folderId: string | null, type: DocumentType) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRename: (id: string, kind: "doc" | "folder") => void;
  onDelete: (id: string, kind: "doc" | "folder") => void;
  onMove: (
    id: string,
    kind: "doc" | "folder",
    targetFolderId: string | null,
  ) => void;
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
  { type: "code", label: "Code", color: "var(--type-code)" },
];

function collectDescendantIds(
  nodes: FolderNode[],
  targetId: string,
): Set<string> {
  const ids = new Set<string>();
  const collect = (children: FolderNode[]) => {
    for (const n of children) {
      ids.add(n.folder.id);
      collect(n.children);
    }
  };
  const find = (tree: FolderNode[]): FolderNode | undefined => {
    for (const n of tree) {
      if (n.folder.id === targetId) return n;
      const found = find(n.children);
      if (found) return found;
    }
  };
  const node = find(nodes);
  if (node) collect(node.children);
  return ids;
}

function MoveToSubmenu({
  folders,
  excludeIds,
  onSelect,
  depth,
}: {
  folders: FolderNode[];
  excludeIds: Set<string>;
  onSelect: (folderId: string) => void;
  depth: number;
}) {
  return (
    <>
      {folders
        .filter((node) => !excludeIds.has(node.folder.id))
        .map((node) => (
          <div key={node.folder.id}>
            <button
              style={{ paddingLeft: 10 + depth * 14 }}
              onClick={() => onSelect(node.folder.id)}
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
                <path d="M2 4v9a1 1 0 001 1h10a1 1 0 001-1V6a1 1 0 00-1-1H8L6.5 3H3a1 1 0 00-1 1z" />
              </svg>
              <span style={{ marginLeft: 4 }}>{node.folder.name}</span>
            </button>
            {node.children.length > 0 && (
              <MoveToSubmenu
                folders={node.children}
                excludeIds={excludeIds}
                onSelect={onSelect}
                depth={depth + 1}
              />
            )}
          </div>
        ))}
    </>
  );
}

export function MindMapContextMenu({
  position,
  nodeType,
  nodeId,
  folderTree,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
  onMove,
  onOpen,
  onClose,
}: MindMapContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [moveOpen, setMoveOpen] = useState(false);

  useEffect(() => {
    if (!position) return;
    setMoveOpen(false);
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

  const excludeIds =
    nodeType === "folder"
      ? (() => {
          const ids = collectDescendantIds(folderTree, nodeId);
          ids.add(nodeId);
          return ids;
        })()
      : new Set<string>();

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
          <button onClick={() => setMoveOpen((v) => !v)}>Move to...</button>
          {moveOpen && (
            <div className="mindmap-context-menu__submenu">
              <button
                onClick={() => {
                  onMove(nodeId, "doc", null);
                  onClose();
                }}
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
                  <path d="M3 6.5L8 2l5 4.5M4 14V8h8v6" />
                </svg>
                <span style={{ marginLeft: 4 }}>Home (root)</span>
              </button>
              <MoveToSubmenu
                folders={folderTree}
                excludeIds={excludeIds}
                onSelect={(fid) => {
                  onMove(nodeId, "doc", fid);
                  onClose();
                }}
                depth={0}
              />
            </div>
          )}
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
              <button onClick={() => setMoveOpen((v) => !v)}>Move to...</button>
              {moveOpen && (
                <div className="mindmap-context-menu__submenu">
                  <button
                    onClick={() => {
                      onMove(nodeId, "folder", null);
                      onClose();
                    }}
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
                      <path d="M3 6.5L8 2l5 4.5M4 14V8h8v6" />
                    </svg>
                    <span style={{ marginLeft: 4 }}>Home (root)</span>
                  </button>
                  <MoveToSubmenu
                    folders={folderTree}
                    excludeIds={excludeIds}
                    onSelect={(fid) => {
                      onMove(nodeId, "folder", fid);
                      onClose();
                    }}
                    depth={0}
                  />
                </div>
              )}
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
