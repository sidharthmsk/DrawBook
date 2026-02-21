import { FormEvent, useEffect, useMemo, useState } from "react";

interface DocumentItem {
  id: string;
  name: string;
  folderId: string | null;
  modifiedAt: string;
}

interface Folder {
  id: string;
  name: string;
  createdAt: string;
}

type RenameTarget = { id: string; kind: "doc" | "folder" } | null;

const IconFolder = () => (
  <svg
    className="folder-icon"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 4.5A1.5 1.5 0 013.5 3h2.382a1 1 0 01.894.553L7.5 5h5A1.5 1.5 0 0114 6.5v5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5v-7z" />
  </svg>
);

const IconSearch = () => (
  <svg
    className="search-icon"
    width="15"
    height="15"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" />
  </svg>
);

const IconPlus = () => (
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
);

const IconDots = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <circle cx="8" cy="3.5" r="1.25" />
    <circle cx="8" cy="8" r="1.25" />
    <circle cx="8" cy="12.5" r="1.25" />
  </svg>
);

const IconDoc = () => (
  <svg
    className="doc-icon"
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 2h5.5L13 5.5V13a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
    <path d="M9 2v4h4" />
  </svg>
);

interface SidebarProps {
  currentDocId: string;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ currentDocId, open }: SidebarProps) {
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
      !confirm(
        "Delete this folder? Drawings inside it will be moved to the root.",
      )
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
    if (!confirm("Delete this drawing?")) return;
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

  const renderDocItem = (doc: DocumentItem) => {
    const isActive = doc.id === currentDocId;
    const isRenaming =
      renameTarget?.id === doc.id && renameTarget.kind === "doc";

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
            <button
              className="sidebar-doc-link"
              onClick={() => openDoc(doc.id)}
            >
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
                  {unfiledDocs.map(renderDocItem)}
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
                            {folderDocs.map(renderDocItem)}
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
