import { FormEvent, useEffect, useMemo, useState } from "react";
import { useConfirm } from "./ConfirmDialog";
import { SidebarDocItem } from "./sidebar/SidebarDocItem";
import {
  IconDots,
  IconFolder,
  IconPlus,
  IconSearch,
} from "./sidebar/SidebarIcons";
import type {
  DocumentItem,
  Folder,
  RenameTarget,
} from "./sidebar/sidebarTypes";

interface SidebarProps {
  currentDocId: string;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ currentDocId, open }: SidebarProps) {
  const confirm = useConfirm();
  const [allDocs, setAllDocs] = useState<DocumentItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [renameTarget, setRenameTarget] = useState<RenameTarget>(null);
  const [renameValue, setRenameValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [draggingDocId, setDraggingDocId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [moveMenuDocId, setMoveMenuDocId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [foldersRes, docsRes] = await Promise.all([
        fetch("/api/folders"),
        fetch("/api/documents"),
      ]);
      if (!foldersRes.ok || !docsRes.ok) throw new Error("Could not load data");
      const foldersData = await foldersRes.json();
      const docsData = await docsRes.json();
      setFolders(foldersData.folders || []);
      setAllDocs(docsData.documents || []);
    } catch (e) {
      console.error("Failed to load data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!openMenuId) return;
    const closeMenus = () => {
      setOpenMenuId(null);
      setMoveMenuDocId(null);
    };
    document.addEventListener("click", closeMenus);
    return () => document.removeEventListener("click", closeMenus);
  }, [openMenuId]);

  const createNewDrawing = () => {
    const docId = `drawing-${Date.now()}`;
    window.location.href = `/?doc=${docId}`;
  };

  const openDoc = (id: string) => {
    window.location.href = `/?doc=${id}`;
  };

  const filteredDocs = useMemo(() => {
    if (!searchTerm.trim()) return allDocs;
    const normalized = searchTerm.trim().toLowerCase();
    return allDocs.filter(
      (doc) =>
        doc.name.toLowerCase().includes(normalized) ||
        doc.id.toLowerCase().includes(normalized),
    );
  }, [allDocs, searchTerm]);

  const unfiledDocs = useMemo(
    () => filteredDocs.filter((doc) => !doc.folderId),
    [filteredDocs],
  );

  const docsByFolder = useMemo(() => {
    const map = new Map<string, DocumentItem[]>();
    for (const doc of filteredDocs) {
      if (doc.folderId) {
        const list = map.get(doc.folderId) || [];
        list.push(doc);
        map.set(doc.folderId, list);
      }
    }
    return map;
  }, [filteredDocs]);

  const createFolder = async (e: FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName.trim() }),
      });
      if (!res.ok) throw new Error("Create folder failed");
      setNewFolderName("");
      setCreatingFolder(false);
      await loadData();
    } catch (err) {
      console.error("Failed to create folder:", err);
    }
  };

  const deleteFolder = async (folderId: string) => {
    if (
      !(await confirm({
        message:
          "Delete this folder? Drawings inside it will be moved to the root.",
        danger: true,
      }))
    )
      return;
    try {
      const res = await fetch(`/api/folders/${folderId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete folder failed");
      await loadData();
    } catch (err) {
      console.error("Failed to delete folder:", err);
    }
  };

  const deleteDoc = async (docId: string) => {
    if (!(await confirm({ message: "Delete this drawing?", danger: true })))
      return;
    try {
      const res = await fetch(`/api/delete/${docId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete drawing failed");
      setAllDocs((prev) => prev.filter((doc) => doc.id !== docId));
    } catch (err) {
      console.error("Failed to delete drawing:", err);
    }
  };

  const moveDocToFolder = async (docId: string, folderId: string | null) => {
    try {
      const res = await fetch(`/api/documents/${docId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      });
      if (!res.ok) throw new Error("Move drawing failed");
      setAllDocs((prev) =>
        prev.map((doc) => (doc.id === docId ? { ...doc, folderId } : doc)),
      );
    } catch (err) {
      console.error("Failed to move document:", err);
    } finally {
      setDraggingDocId(null);
      setMoveMenuDocId(null);
      setOpenMenuId(null);
    }
  };

  const startRename = (
    id: string,
    kind: "doc" | "folder",
    currentName: string,
  ) => {
    setRenameTarget({ id, kind });
    setRenameValue(currentName);
  };

  const finishRename = async () => {
    if (!renameTarget) return;
    const value = renameValue.trim();
    if (!value) {
      setRenameTarget(null);
      return;
    }
    try {
      if (renameTarget.kind === "folder") {
        const res = await fetch(`/api/folders/${renameTarget.id}/rename`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: value }),
        });
        if (!res.ok) throw new Error("Rename folder failed");
      } else {
        const res = await fetch(`/api/rename/${renameTarget.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newName: value }),
        });
        if (!res.ok) throw new Error("Rename drawing failed");
      }
      await loadData();
    } catch (err) {
      console.error("Failed to rename:", err);
    } finally {
      setRenameTarget(null);
      setOpenMenuId(null);
      setMoveMenuDocId(null);
    }
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  };

  const docItemProps = {
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
  };

  return (
    <aside className={`sidebar ${open ? "sidebar--open" : ""}`}>
      <div className="sidebar__top">
        <div className="dashboard-brand">
          <span className="dashboard-brand__dot" />
          <h1>tldraw</h1>
        </div>
      </div>

      <div className="sidebar__search">
        <div className="search-wrapper">
          <IconSearch />
          <input
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search drawings..."
          />
        </div>
      </div>

      <button className="sidebar-new-btn" onClick={createNewDrawing}>
        <IconPlus />
        New Drawing
      </button>

      <div className="sidebar__content">
        {loading ? (
          <p className="sidebar-loading">Loading...</p>
        ) : (
          <>
            {unfiledDocs.length > 0 && (
              <div className="sidebar-section">
                <p className="sidebar-section-label">Drawings</p>
                <div
                  className="sidebar-doc-list"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const droppedDoc =
                      e.dataTransfer.getData("text/plain") || draggingDocId;
                    if (droppedDoc) moveDocToFolder(droppedDoc, null);
                  }}
                >
                  {unfiledDocs.map((doc) => (
                    <SidebarDocItem key={doc.id} doc={doc} {...docItemProps} />
                  ))}
                </div>
              </div>
            )}

            {folders.length > 0 && (
              <div className="sidebar-section">
                <p className="sidebar-section-label">Folders</p>
                <div className="folder-list">
                  {folders.map((folder) => {
                    const isRenaming =
                      renameTarget?.id === folder.id &&
                      renameTarget.kind === "folder";
                    const isExpanded = expandedFolders.has(folder.id);
                    const folderDocs = docsByFolder.get(folder.id) || [];

                    return (
                      <div
                        key={folder.id}
                        className="folder-item"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const droppedDoc =
                            e.dataTransfer.getData("text/plain") ||
                            draggingDocId;
                          if (droppedDoc)
                            moveDocToFolder(droppedDoc, folder.id);
                        }}
                      >
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
                          <div className="folder-row">
                            <button
                              className="folder-link"
                              onClick={() => toggleFolder(folder.id)}
                            >
                              <IconFolder />
                              <span className="folder-link-text">
                                {folder.name}
                              </span>
                              <span className="folder-count">
                                {folderDocs.length}
                              </span>
                            </button>
                            <button
                              className="icon-menu-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                const menuId = `folder-${folder.id}`;
                                setOpenMenuId((current) =>
                                  current === menuId ? null : menuId,
                                );
                                setMoveMenuDocId(null);
                              }}
                              aria-label={`Actions for ${folder.name}`}
                            >
                              <IconDots />
                            </button>
                          </div>
                        )}

                        {openMenuId === `folder-${folder.id}` && (
                          <div
                            className="dropdown-menu"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() =>
                                startRename(folder.id, "folder", folder.name)
                              }
                            >
                              Rename
                            </button>
                            <button
                              className="danger"
                              onClick={() => deleteFolder(folder.id)}
                            >
                              Delete
                            </button>
                          </div>
                        )}

                        {isExpanded && folderDocs.length > 0 && (
                          <div className="sidebar-folder-docs">
                            {folderDocs.map((doc) => (
                              <SidebarDocItem
                                key={doc.id}
                                doc={doc}
                                {...docItemProps}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {unfiledDocs.length === 0 &&
              folders.length === 0 &&
              !searchTerm && (
                <p className="sidebar-empty">
                  No drawings yet. Click "New Drawing" to start.
                </p>
              )}

            {searchTerm && filteredDocs.length === 0 && (
              <p className="sidebar-empty">No results for "{searchTerm}"</p>
            )}
          </>
        )}
      </div>

      {creatingFolder ? (
        <form className="new-folder-form" onSubmit={createFolder}>
          <input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            autoFocus
          />
          <button type="submit">Create</button>
          <button
            type="button"
            onClick={() => {
              setCreatingFolder(false);
              setNewFolderName("");
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button className="ghost-btn" onClick={() => setCreatingFolder(true)}>
          + New Folder
        </button>
      )}
    </aside>
  );
}
