import type { DocumentItem, FolderNode } from "./types";
import { IconHome } from "./DashboardIcons";
import { FolderTreeMenu } from "./FolderTreeMenu";

export function DocContextMenu({
  doc,
  index,
  openDoc,
  startRename,
  duplicateDoc,
  deleteDoc,
  toggleSelect,
  setMoveMenuDocId,
  moveMenuDocId,
  moveDocToFolder,
  folderTree,
  setOpenMenuId,
  onEditTags,
  onSaveAsTemplate,
}: {
  doc: DocumentItem;
  index: number;
  openDoc: (doc: DocumentItem) => void;
  startRename: (id: string, kind: "doc" | "folder", name: string) => void;
  duplicateDoc: (id: string) => void;
  deleteDoc: (id: string) => void;
  toggleSelect: (id: string, index: number, shift: boolean) => void;
  setMoveMenuDocId: (fn: (v: string | null) => string | null) => void;
  moveMenuDocId: string | null;
  moveDocToFolder: (docId: string, folderId: string | null) => void;
  folderTree: FolderNode[];
  setOpenMenuId: (v: string | null) => void;
  onEditTags: (docId: string) => void;
  onSaveAsTemplate: (docId: string) => void;
}) {
  const showMoveMenu = moveMenuDocId === doc.id;
  return (
    <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => openDoc(doc)}>Open</button>
      <button onClick={() => startRename(doc.id, "doc", doc.name)}>
        Rename
      </button>
      <button
        onClick={() => {
          duplicateDoc(doc.id);
          setOpenMenuId(null);
        }}
      >
        Duplicate
      </button>
      <button
        onClick={() => {
          onEditTags(doc.id);
          setOpenMenuId(null);
        }}
      >
        Tags...
      </button>
      <div
        className="dropdown-menu__hover-parent"
        onMouseLeave={() => {
          if (!("ontouchstart" in window)) setMoveMenuDocId(() => null);
        }}
      >
        <button
          className="dropdown-menu__has-sub"
          onClick={() =>
            setMoveMenuDocId((current) => (current === doc.id ? null : doc.id))
          }
          onMouseEnter={() => {
            if (!("ontouchstart" in window)) setMoveMenuDocId(() => doc.id);
          }}
        >
          Move to...
          <svg
            width="8"
            height="8"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginLeft: "auto" }}
          >
            <path d="M6 4l4 4-4 4" />
          </svg>
        </button>
        {showMoveMenu && (
          <div className="dropdown-popout" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => moveDocToFolder(doc.id, null)}>
              <IconHome />
              Home
            </button>
            <FolderTreeMenu
              folders={folderTree}
              onSelect={(fid) => moveDocToFolder(doc.id, fid)}
              depth={0}
            />
          </div>
        )}
      </div>
      <button
        onClick={() => {
          toggleSelect(doc.id, index, false);
          setOpenMenuId(null);
        }}
      >
        Select
      </button>
      <button
        onClick={() => {
          onSaveAsTemplate(doc.id);
          setOpenMenuId(null);
        }}
      >
        Save as Template
      </button>
      <button className="danger" onClick={() => deleteDoc(doc.id)}>
        Delete
      </button>
    </div>
  );
}
