import type { Dispatch, SetStateAction } from "react";
import type { DocumentItem, Folder, RenameTarget } from "./sidebarTypes";
import { IconDoc, IconDots } from "./SidebarIcons";

interface SidebarDocItemProps {
  doc: DocumentItem;
  currentDocId: string;
  formatDate: (dateString: string) => string;
  renameTarget: RenameTarget;
  renameValue: string;
  setRenameValue: (value: string) => void;
  finishRename: () => void;
  setRenameTarget: (target: RenameTarget) => void;
  openMenuId: string | null;
  setOpenMenuId: Dispatch<SetStateAction<string | null>>;
  moveMenuDocId: string | null;
  setMoveMenuDocId: Dispatch<SetStateAction<string | null>>;
  openDoc: (id: string) => void;
  startRename: (
    id: string,
    kind: "doc" | "folder",
    currentName: string,
  ) => void;
  deleteDoc: (docId: string) => void;
  moveDocToFolder: (docId: string, folderId: string | null) => void;
  folders: Folder[];
  setDraggingDocId: (id: string | null) => void;
}

export function SidebarDocItem({
  doc,
  currentDocId,
  formatDate,
  renameTarget,
  renameValue,
  setRenameValue,
  finishRename,
  setRenameTarget,
  openMenuId,
  setOpenMenuId,
  moveMenuDocId,
  setMoveMenuDocId,
  openDoc,
  startRename,
  deleteDoc,
  moveDocToFolder,
  folders,
  setDraggingDocId,
}: SidebarDocItemProps) {
  const isActive = doc.id === currentDocId;
  const isRenaming = renameTarget?.id === doc.id && renameTarget.kind === "doc";

  return (
    <div
      key={doc.id}
      className={`sidebar-doc-item ${isActive ? "sidebar-doc-item--active" : ""}`}
      draggable
      onDragStart={(e) => {
        setDraggingDocId(doc.id);
        e.dataTransfer.setData("text/plain", doc.id);
      }}
      onDragEnd={() => setDraggingDocId(null)}
    >
      <div className="sidebar-doc-row">
        {isRenaming ? (
          <input
            className="rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={finishRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") finishRename();
              if (e.key === "Escape") setRenameTarget(null);
            }}
            autoFocus
          />
        ) : (
          <button className="sidebar-doc-link" onClick={() => openDoc(doc.id)}>
            <IconDoc />
            <span className="sidebar-doc-name">{doc.name}</span>
            <span className="sidebar-doc-date">
              {formatDate(doc.modifiedAt)}
            </span>
          </button>
        )}
        <button
          className="icon-menu-btn"
          onClick={(e) => {
            e.stopPropagation();
            const menuId = `doc-${doc.id}`;
            setOpenMenuId((current) => (current === menuId ? null : menuId));
            setMoveMenuDocId(null);
          }}
          aria-label={`Actions for ${doc.name}`}
        >
          <IconDots />
        </button>
      </div>

      {openMenuId === `doc-${doc.id}` && (
        <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => openDoc(doc.id)}>Open</button>
          <button onClick={() => startRename(doc.id, "doc", doc.name)}>
            Rename
          </button>
          <button
            onClick={() =>
              setMoveMenuDocId((current) =>
                current === doc.id ? null : doc.id,
              )
            }
          >
            Move to...
          </button>
          <button className="danger" onClick={() => deleteDoc(doc.id)}>
            Delete
          </button>

          {moveMenuDocId === doc.id && (
            <div className="dropdown-submenu">
              <button onClick={() => moveDocToFolder(doc.id, null)}>
                Root
              </button>
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => moveDocToFolder(doc.id, folder.id)}
                >
                  {folder.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
