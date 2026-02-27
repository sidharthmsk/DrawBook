import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type DocumentType = "tldraw" | "excalidraw" | "drawio" | "markdown" | "pdf";

interface DocumentItem {
  id: string;
  name: string;
  folderId: string | null;
  type: DocumentType;
  modifiedAt: string;
}

interface Folder {
  id: string;
  name: string;
  createdAt: string;
}

type RenameTarget = { id: string; kind: "doc" | "folder" } | null;

const TYPE_CONFIG: Record<DocumentType, { label: string; color: string }> = {
  tldraw: { label: "tldraw", color: "var(--accent)" },
  excalidraw: { label: "Excalidraw", color: "var(--type-excalidraw)" },
  drawio: { label: "Draw.io", color: "var(--type-drawio)" },
  markdown: { label: "Markdown", color: "var(--type-markdown)" },
  pdf: { label: "PDF", color: "var(--type-pdf)" },
};

/* ─── Inline SVG Icons ─── */
const IconHome = () => (
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
    <path d="M2.5 6.5L8 2l5.5 4.5V13a1 1 0 01-1 1h-9a1 1 0 01-1-1V6.5z" />
    <path d="M6 14V9h4v5" />
  </svg>
);

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

const IconMenu = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
  >
    <path d="M2 4h12M2 8h12M2 12h12" />
  </svg>
);

const IconUpload = () => (
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
    <path d="M8 10V2M8 2L5 5M8 2l3 3" />
    <path d="M2 10v2a2 2 0 002 2h8a2 2 0 002-2v-2" />
  </svg>
);

const IconChevron = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 6l4 4 4-4" />
  </svg>
);

const IconTldraw = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="M2 2l7.586 7.586" />
    <circle cx="11" cy="11" r="2" />
  </svg>
);

const IconExcalidraw = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 4h16v16H4z" />
    <circle cx="9" cy="9" r="2" />
    <path d="M15 9h.01" />
    <path d="M9 15l2-2 4 4" />
  </svg>
);

const IconDrawio = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="8" y="14" width="7" height="7" rx="1" />
    <path d="M7 10v4h4" />
    <path d="M17 10v7h-2" />
  </svg>
);

const IconMarkdown = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 5h18v14H3z" />
    <path d="M6 15V9l3 3.5L12 9v6" />
    <path d="M18 13l-2-2-2 2" />
    <path d="M16 15v-4" />
  </svg>
);

const IconPdf = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
  </svg>
);

const TYPE_ICONS: Record<DocumentType, () => JSX.Element> = {
  tldraw: IconTldraw,
  excalidraw: IconExcalidraw,
  drawio: IconDrawio,
  markdown: IconMarkdown,
  pdf: IconPdf,
};

export function Dashboard() {
  const [allDocs, setAllDocs] = useState<DocumentItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [renameTarget, setRenameTarget] = useState<RenameTarget>(null);
  const [renameValue, setRenameValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [draggingDocId, setDraggingDocId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [moveMenuDocId, setMoveMenuDocId] = useState<string | null>(null);
  const [newDropdownOpen, setNewDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.body.classList.add("dashboard-mode");
    document.documentElement.classList.add("dashboard-mode");
    return () => {
      document.body.classList.remove("dashboard-mode");
      document.documentElement.classList.remove("dashboard-mode");
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [foldersRes, docsRes] = await Promise.all([
        fetch("/api/folders"),
        fetch("/api/documents"),
      ]);

      if (!foldersRes.ok || !docsRes.ok) {
        throw new Error("Could not load dashboard data");
      }

      const foldersData = await foldersRes.json();
      const docsData = await docsRes.json();
      setFolders(foldersData.folders || []);
      setAllDocs(
        (docsData.documents || []).map((d: any) => ({
          ...d,
          type: d.type || "tldraw",
        })),
      );
    } catch (e) {
      console.error("Failed to load data:", e);
      setError("Could not load documents right now. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!openMenuId && !newDropdownOpen) return;
    const closeMenus = () => {
      setOpenMenuId(null);
      setMoveMenuDocId(null);
      setNewDropdownOpen(false);
    };
    document.addEventListener("click", closeMenus);
    return () => document.removeEventListener("click", closeMenus);
  }, [openMenuId, newDropdownOpen]);

  const createNewDocument = (type: DocumentType) => {
    const prefix = type === "tldraw" ? "drawing" : type;
    const docId = `${prefix}-${Date.now()}`;
    const folderParam = currentFolder
      ? `&folder=${encodeURIComponent(currentFolder)}`
      : "";
    window.location.href = `/?doc=${docId}&type=${type}${folderParam}`;
  };

  const openDoc = (doc: DocumentItem) => {
    window.location.href = `/?doc=${doc.id}&type=${doc.type}`;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    if (currentFolder) {
      formData.append("folderId", currentFolder);
    }

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      await loadData();
    } catch (err) {
      console.error("Failed to upload file:", err);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const currentFolderName = currentFolder
    ? folders.find((f) => f.id === currentFolder)?.name || "Folder"
    : "Home";

  const folderDocCounts = useMemo(() => {
    const counts = new Map<string, number>();
    let rootCount = 0;
    for (const doc of allDocs) {
      if (doc.folderId) {
        counts.set(doc.folderId, (counts.get(doc.folderId) || 0) + 1);
      } else {
        rootCount += 1;
      }
    }
    return { counts, rootCount };
  }, [allDocs]);

  const visibleDocs = useMemo(() => {
    const byFolder = allDocs.filter((doc) => doc.folderId === currentFolder);
    if (!searchTerm.trim()) return byFolder;
    const normalized = searchTerm.trim().toLowerCase();
    return byFolder.filter(
      (doc) =>
        doc.name.toLowerCase().includes(normalized) ||
        doc.id.toLowerCase().includes(normalized),
    );
  }, [allDocs, currentFolder, searchTerm]);

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
    if (!confirm("Delete this folder? Documents inside it will move to Home."))
      return;
    try {
      const res = await fetch(`/api/folders/${folderId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete folder failed");
      if (currentFolder === folderId) setCurrentFolder(null);
      await loadData();
    } catch (err) {
      console.error("Failed to delete folder:", err);
    }
  };

  const deleteDoc = async (docId: string) => {
    if (!confirm("Delete this document?")) return;
    try {
      const res = await fetch(`/api/delete/${docId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete document failed");
      setAllDocs((prev) => prev.filter((doc) => doc.id !== docId));
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const moveDocToFolder = async (docId: string, folderId: string | null) => {
    try {
      const res = await fetch(`/api/documents/${docId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      });
      if (!res.ok) throw new Error("Move document failed");
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
        if (!res.ok) throw new Error("Rename document failed");
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="dashboard-shell">
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`dashboard-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="dashboard-sidebar__top">
          <div className="dashboard-brand">
            <span className="dashboard-brand__dot" />
            <h1>Drawbook</h1>
          </div>
          <button
            className="sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close folders panel"
          >
            Close
          </button>
        </div>

        <p className="sidebar-section-label">Navigation</p>

        <button
          className={`folder-link ${currentFolder === null ? "active drop-target" : ""}`}
          onClick={() => {
            setCurrentFolder(null);
            setSidebarOpen(false);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const droppedDoc =
              e.dataTransfer.getData("text/plain") || draggingDocId;
            if (droppedDoc) moveDocToFolder(droppedDoc, null);
          }}
        >
          <IconHome />
          <span className="folder-link-text">Home</span>
          <span className="folder-count">{folderDocCounts.rootCount}</span>
        </button>

        {folders.length > 0 && <p className="sidebar-section-label">Folders</p>}

        <div className="folder-list">
          {folders.map((folder) => {
            const isRenaming =
              renameTarget?.id === folder.id && renameTarget.kind === "folder";
            return (
              <div
                key={folder.id}
                className={`folder-item ${currentFolder === folder.id ? "active drop-target" : ""}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const droppedDoc =
                    e.dataTransfer.getData("text/plain") || draggingDocId;
                  if (droppedDoc) moveDocToFolder(droppedDoc, folder.id);
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
                      onClick={() => {
                        setCurrentFolder(folder.id);
                        setSidebarOpen(false);
                      }}
                    >
                      <IconFolder />
                      <span className="folder-link-text">{folder.name}</span>
                      <span className="folder-count">
                        {folderDocCounts.counts.get(folder.id) || 0}
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
              </div>
            );
          })}
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

      <main className="dashboard-main">
        <header className="main-header">
          <div className="main-header-left">
            <button
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen((v) => !v)}
            >
              <IconMenu />
            </button>
            <h2>{currentFolderName}</h2>
          </div>
          <div className="header-actions">
            <div className="search-wrapper">
              <IconSearch />
              <input
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search documents..."
              />
            </div>

            <button
              className="icon-action-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Upload PDF"
            >
              <IconUpload />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />

            <div className="new-dropdown-wrapper">
              <button
                className="primary-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setNewDropdownOpen((v) => !v);
                }}
              >
                <IconPlus />
                New
                <IconChevron />
              </button>
              {newDropdownOpen && (
                <div
                  className="new-dropdown-menu"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button onClick={() => createNewDocument("tldraw")}>
                    <IconTldraw />
                    <span>tldraw</span>
                  </button>
                  <button onClick={() => createNewDocument("excalidraw")}>
                    <IconExcalidraw />
                    <span>Excalidraw</span>
                  </button>
                  <button onClick={() => createNewDocument("drawio")}>
                    <IconDrawio />
                    <span>Draw.io</span>
                  </button>
                  <button onClick={() => createNewDocument("markdown")}>
                    <IconMarkdown />
                    <span>Markdown</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <p className="hint-text">
          Tip: drag any card and drop it onto a folder on the left to move it
          quickly.
        </p>

        {loading ? (
          <div className="empty-state">
            <p>Loading...</p>
          </div>
        ) : error ? (
          <div className="empty-state">
            <p>{error}</p>
          </div>
        ) : visibleDocs.length === 0 ? (
          <div className="empty-state">
            <h3>No documents yet</h3>
            <p>
              Create a new document to get started, or drag documents from
              another folder into this one.
            </p>
          </div>
        ) : (
          <section className="doc-list">
            <div className="doc-list__header">
              <span className="doc-list__col doc-list__col--icon" />
              <span className="doc-list__col doc-list__col--name">Name</span>
              <span className="doc-list__col doc-list__col--type">Type</span>
              <span className="doc-list__col doc-list__col--date">
                Modified
              </span>
              <span className="doc-list__col doc-list__col--actions" />
            </div>
            {visibleDocs.map((doc) => {
              const isRenaming =
                renameTarget?.id === doc.id && renameTarget.kind === "doc";
              const typeConf = TYPE_CONFIG[doc.type] || TYPE_CONFIG.tldraw;
              const TypeIcon = TYPE_ICONS[doc.type] || TYPE_ICONS.tldraw;
              return (
                <div
                  key={doc.id}
                  className="doc-row"
                  draggable
                  onDragStart={(e) => {
                    setDraggingDocId(doc.id);
                    e.dataTransfer.setData("text/plain", doc.id);
                  }}
                  onDragEnd={() => setDraggingDocId(null)}
                >
                  <span
                    className="doc-row__icon"
                    style={{ color: typeConf.color }}
                    onClick={() => openDoc(doc)}
                  >
                    <TypeIcon />
                  </span>

                  <span className="doc-row__name">
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
                        className="doc-row__name-btn"
                        onClick={() => openDoc(doc)}
                      >
                        {doc.name}
                      </button>
                    )}
                  </span>

                  <span className="doc-row__type">
                    <span
                      className="type-pill"
                      style={
                        {
                          "--pill-color": typeConf.color,
                        } as React.CSSProperties
                      }
                    >
                      {typeConf.label}
                    </span>
                  </span>

                  <span className="doc-row__date">
                    {formatDate(doc.modifiedAt)}
                  </span>

                  <span className="doc-row__actions">
                    <button
                      className="icon-menu-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        const menuId = `doc-${doc.id}`;
                        setOpenMenuId((current) =>
                          current === menuId ? null : menuId,
                        );
                        setMoveMenuDocId(null);
                      }}
                      aria-label={`Actions for ${doc.name}`}
                    >
                      <IconDots />
                    </button>

                    {openMenuId === `doc-${doc.id}` && (
                      <div
                        className="dropdown-menu"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button onClick={() => openDoc(doc)}>Open</button>
                        <button
                          onClick={() => startRename(doc.id, "doc", doc.name)}
                        >
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
                        <button
                          className="danger"
                          onClick={() => deleteDoc(doc.id)}
                        >
                          Delete
                        </button>

                        {moveMenuDocId === doc.id && (
                          <div className="dropdown-submenu">
                            <button
                              onClick={() => moveDocToFolder(doc.id, null)}
                            >
                              Home
                            </button>
                            {folders.map((folder) => (
                              <button
                                key={folder.id}
                                onClick={() =>
                                  moveDocToFolder(doc.id, folder.id)
                                }
                              >
                                {folder.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </span>
                </div>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
