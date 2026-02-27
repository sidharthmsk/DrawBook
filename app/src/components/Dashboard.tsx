import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useConfirm } from "./ConfirmDialog";

type DocumentType =
  | "tldraw"
  | "excalidraw"
  | "drawio"
  | "markdown"
  | "pdf"
  | "spreadsheet"
  | "kanban";

function typeFromId(id: string): DocumentType {
  if (id.startsWith("excalidraw-")) return "excalidraw";
  if (id.startsWith("drawio-")) return "drawio";
  if (id.startsWith("markdown-")) return "markdown";
  if (id.startsWith("pdf-")) return "pdf";
  if (id.startsWith("spreadsheet-")) return "spreadsheet";
  if (id.startsWith("kanban-")) return "kanban";
  return "tldraw";
}

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
  parentId: string | null;
  createdAt: string;
}

type RenameTarget = { id: string; kind: "doc" | "folder" } | null;

interface FolderNode {
  folder: Folder;
  children: FolderNode[];
  depth: number;
}

function buildFolderTree(folders: Folder[]): FolderNode[] {
  const byParent = new Map<string | null, Folder[]>();
  for (const f of folders) {
    const key = f.parentId ?? "__root__";
    const list = byParent.get(key) || [];
    list.push(f);
    byParent.set(key, list);
  }
  const build = (parentId: string | null, depth: number): FolderNode[] => {
    const key = parentId ?? "__root__";
    return (byParent.get(key) || []).map((f) => ({
      folder: f,
      children: build(f.id, depth + 1),
      depth,
    }));
  };
  return build(null, 0);
}

function flattenTree(nodes: FolderNode[]): FolderNode[] {
  const out: FolderNode[] = [];
  for (const n of nodes) {
    out.push(n);
    out.push(...flattenTree(n.children));
  }
  return out;
}

const IconTreeChevron = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={`tree-chevron ${expanded ? "tree-chevron--open" : ""}`}
    width="12"
    height="12"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 4l4 4-4 4" />
  </svg>
);

const TYPE_CONFIG: Record<DocumentType, { label: string; color: string }> = {
  tldraw: { label: "tldraw", color: "var(--accent)" },
  excalidraw: { label: "Excalidraw", color: "var(--type-excalidraw)" },
  drawio: { label: "Draw.io", color: "var(--type-drawio)" },
  markdown: { label: "Markdown", color: "var(--type-markdown)" },
  pdf: { label: "PDF", color: "var(--type-pdf)" },
  spreadsheet: { label: "Spreadsheet", color: "var(--type-spreadsheet)" },
  kanban: { label: "Kanban", color: "var(--type-kanban)" },
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

const IconSpreadsheet = () => (
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
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
  </svg>
);

const IconKanban = () => (
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
    <rect x="3" y="3" width="5" height="14" rx="1" />
    <rect x="10" y="3" width="5" height="10" rx="1" />
    <rect x="17" y="3" width="5" height="18" rx="1" />
  </svg>
);

const TYPE_ICONS: Record<DocumentType, () => JSX.Element> = {
  tldraw: IconTldraw,
  excalidraw: IconExcalidraw,
  drawio: IconDrawio,
  markdown: IconMarkdown,
  pdf: IconPdf,
  spreadsheet: IconSpreadsheet,
  kanban: IconKanban,
};

function ClickOrDouble({
  className,
  children,
  onSingleClick,
  onDoubleClick,
}: {
  className?: string;
  children: React.ReactNode;
  onSingleClick: () => void;
  onDoubleClick: () => void;
}) {
  const clickTimer = useRef<NodeJS.Timeout | null>(null);
  return (
    <button
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        if (clickTimer.current) {
          clearTimeout(clickTimer.current);
          clickTimer.current = null;
          onDoubleClick();
        } else {
          clickTimer.current = setTimeout(() => {
            clickTimer.current = null;
            onSingleClick();
          }, 250);
        }
      }}
    >
      {children}
    </button>
  );
}

function FolderTreeMenu({
  folders,
  onSelect,
  depth,
}: {
  folders: FolderNode[];
  onSelect: (folderId: string | null) => void;
  depth: number;
}) {
  return (
    <>
      {folders.map((node) => (
        <div key={node.folder.id}>
          <button
            style={{ paddingLeft: 10 + depth * 14 }}
            onClick={() => onSelect(node.folder.id)}
          >
            <IconFolder />
            <span style={{ marginLeft: 6 }}>{node.folder.name}</span>
          </button>
          {node.children.length > 0 && (
            <FolderTreeMenu
              folders={node.children}
              onSelect={onSelect}
              depth={depth + 1}
            />
          )}
        </div>
      ))}
    </>
  );
}

function DocContextMenu({
  doc,
  index,
  openDoc,
  startRename,
  deleteDoc,
  toggleSelect,
  setMoveMenuDocId,
  moveMenuDocId,
  moveDocToFolder,
  folderTree,
  setOpenMenuId,
}: {
  doc: DocumentItem;
  index: number;
  openDoc: (doc: DocumentItem) => void;
  startRename: (id: string, kind: "doc" | "folder", name: string) => void;
  deleteDoc: (id: string) => void;
  toggleSelect: (id: string, index: number, shift: boolean) => void;
  setMoveMenuDocId: (fn: (v: string | null) => string | null) => void;
  moveMenuDocId: string | null;
  moveDocToFolder: (docId: string, folderId: string | null) => void;
  folderTree: FolderNode[];
  setOpenMenuId: (v: string | null) => void;
}) {
  const showMoveMenu = moveMenuDocId === doc.id;
  return (
    <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => openDoc(doc)}>Open</button>
      <button onClick={() => startRename(doc.id, "doc", doc.name)}>
        Rename
      </button>
      <div
        className="dropdown-menu__hover-parent"
        onMouseLeave={() => setMoveMenuDocId(() => null)}
      >
        <button
          className="dropdown-menu__has-sub"
          onClick={() =>
            setMoveMenuDocId((current) => (current === doc.id ? null : doc.id))
          }
          onMouseEnter={() => setMoveMenuDocId(() => doc.id)}
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
      <button className="danger" onClick={() => deleteDoc(doc.id)}>
        Delete
      </button>
    </div>
  );
}

interface AppConfig {
  enableTldraw: boolean;
}

export function Dashboard({ config }: { config: AppConfig }) {
  const confirm = useConfirm();
  const [allDocs, setAllDocs] = useState<DocumentItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState<string | null>(null); // parentId or "__root__"
  const [renameTarget, setRenameTarget] = useState<RenameTarget>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameCancelled = useRef(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [draggingDocId, setDraggingDocId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [moveMenuDocId, setMoveMenuDocId] = useState<string | null>(null);
  const [newDropdownOpen, setNewDropdownOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const lastSelectedIndex = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 500;
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("drawbook_sidebar_w");
    return saved
      ? Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, Number(saved)))
      : 260;
  });
  const resizing = useRef(false);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("drawbook_expanded_folders");
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const toggleExpand = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      localStorage.setItem(
        "drawbook_expanded_folders",
        JSON.stringify([...next]),
      );
      return next;
    });
  }, []);

  const folderTree = useMemo(() => buildFolderTree(folders), [folders]);
  const flatFolders = useMemo(() => flattenTree(folderTree), [folderTree]);

  useEffect(() => {
    document.body.classList.add("dashboard-mode");
    document.documentElement.classList.add("dashboard-mode");
    return () => {
      document.body.classList.remove("dashboard-mode");
      document.documentElement.classList.remove("dashboard-mode");
    };
  }, []);

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizing.current = true;
      const startX = e.clientX;
      const startW = sidebarWidth;

      const onMove = (ev: MouseEvent) => {
        if (!resizing.current) return;
        const newW = Math.max(
          SIDEBAR_MIN,
          Math.min(SIDEBAR_MAX, startW + ev.clientX - startX),
        );
        setSidebarWidth(newW);
      };
      const onUp = () => {
        resizing.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setSidebarWidth((w) => {
          localStorage.setItem("drawbook_sidebar_w", String(w));
          return w;
        });
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [sidebarWidth],
  );

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
          type: d.type || typeFromId(d.id),
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
    if (!openMenuId && !newDropdownOpen && !bulkMoveOpen) return;
    const closeMenus = () => {
      setOpenMenuId(null);
      setMenuPos(null);
      setMoveMenuDocId(null);
      setNewDropdownOpen(false);
      setBulkMoveOpen(false);
    };
    document.addEventListener("click", closeMenus);
    return () => document.removeEventListener("click", closeMenus);
  }, [openMenuId, newDropdownOpen, bulkMoveOpen]);

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

  const currentFolderName = useMemo(() => {
    if (!currentFolder) return "Home";
    const parts: string[] = [];
    let cur: string | null = currentFolder;
    while (cur) {
      const f = folders.find((fo) => fo.id === cur);
      if (!f) break;
      parts.unshift(f.name);
      cur = f.parentId;
    }
    return parts.join(" / ") || "Folder";
  }, [currentFolder, folders]);

  const folderDocCounts = useMemo(() => {
    const directCounts = new Map<string, number>();
    let rootCount = 0;
    for (const doc of allDocs) {
      if (doc.folderId) {
        directCounts.set(
          doc.folderId,
          (directCounts.get(doc.folderId) || 0) + 1,
        );
      } else {
        rootCount += 1;
      }
    }
    // Recursive counts (folder + all descendants)
    const totalCounts = new Map<string, number>();
    const computeTotal = (folderId: string): number => {
      if (totalCounts.has(folderId)) return totalCounts.get(folderId)!;
      let total = directCounts.get(folderId) || 0;
      for (const f of folders) {
        if (f.parentId === folderId) total += computeTotal(f.id);
      }
      totalCounts.set(folderId, total);
      return total;
    };
    for (const f of folders) computeTotal(f.id);
    return { counts: totalCounts, rootCount };
  }, [allDocs, folders]);

  const visibleDocs = useMemo(() => {
    if (!searchTerm.trim()) {
      return allDocs.filter((doc) => doc.folderId === currentFolder);
    }
    const normalized = searchTerm.trim().toLowerCase();
    return allDocs.filter(
      (doc) =>
        doc.name.toLowerCase().includes(normalized) ||
        doc.id.toLowerCase().includes(normalized),
    );
  }, [allDocs, currentFolder, searchTerm]);

  const createFolder = async (e: FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const parentId = creatingFolder === "__root__" ? null : creatingFolder;
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName.trim(), parentId }),
      });
      if (!res.ok) throw new Error("Create folder failed");
      if (parentId) {
        setExpandedFolders((prev) => {
          const next = new Set(prev);
          next.add(parentId);
          localStorage.setItem(
            "drawbook_expanded_folders",
            JSON.stringify([...next]),
          );
          return next;
        });
      }
      setNewFolderName("");
      setCreatingFolder(null);
      await loadData();
    } catch (err) {
      console.error("Failed to create folder:", err);
    }
  };

  const deleteFolder = async (folderId: string) => {
    if (
      !(await confirm({
        message: "Delete this folder? Documents inside it will move to Home.",
        danger: true,
      }))
    )
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
    if (!(await confirm({ message: "Delete this document?", danger: true })))
      return;
    try {
      const res = await fetch(`/api/delete/${docId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete document failed");
      setAllDocs((prev) => prev.filter((doc) => doc.id !== docId));
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);

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

  const moveFolderToParent = async (
    folderId: string,
    newParentId: string | null,
  ) => {
    if (folderId === newParentId) return;
    try {
      const res = await fetch(`/api/folders/${folderId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: newParentId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("Move folder failed:", data.error);
        return;
      }
      await loadData();
    } catch (err) {
      console.error("Failed to move folder:", err);
    } finally {
      setDraggingFolderId(null);
    }
  };

  const toggleSelect = useCallback(
    (docId: string, index: number, shiftKey: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (shiftKey && lastSelectedIndex.current !== null) {
          const start = Math.min(lastSelectedIndex.current, index);
          const end = Math.max(lastSelectedIndex.current, index);
          for (let i = start; i <= end; i++) {
            if (visibleDocs[i]) next.add(visibleDocs[i].id);
          }
        } else {
          if (next.has(docId)) {
            next.delete(docId);
          } else {
            next.add(docId);
          }
        }
        return next;
      });
      lastSelectedIndex.current = index;
    },
    [visibleDocs],
  );

  const clearSelection = () => {
    setSelectedIds(new Set());
    lastSelectedIndex.current = null;
    setBulkMoveOpen(false);
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (
      !(await confirm({
        message: `Delete ${selectedIds.size} document${selectedIds.size > 1 ? "s" : ""}?`,
        danger: true,
      }))
    )
      return;
    try {
      const res = await fetch("/api/bulk/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error("Bulk delete failed");
      setAllDocs((prev) => prev.filter((d) => !selectedIds.has(d.id)));
      clearSelection();
    } catch (err) {
      console.error("Failed to bulk delete:", err);
    }
  };

  const bulkMove = async (folderId: string | null) => {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch("/api/bulk/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentIds: Array.from(selectedIds),
          folderId,
        }),
      });
      if (!res.ok) throw new Error("Bulk move failed");
      setAllDocs((prev) =>
        prev.map((d) => (selectedIds.has(d.id) ? { ...d, folderId } : d)),
      );
      clearSelection();
    } catch (err) {
      console.error("Failed to bulk move:", err);
    }
  };

  const startRename = (
    id: string,
    kind: "doc" | "folder",
    currentName: string,
  ) => {
    renameCancelled.current = false;
    setRenameTarget({ id, kind });
    setRenameValue(currentName);
  };

  const finishRename = async () => {
    if (renameCancelled.current) {
      renameCancelled.current = false;
      return;
    }
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

      <aside
        className={`dashboard-sidebar ${sidebarOpen ? "open" : ""}`}
        style={{ width: sidebarWidth, minWidth: sidebarWidth }}
      >
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
            if (draggingFolderId) {
              moveFolderToParent(draggingFolderId, null);
            } else {
              const droppedDoc =
                e.dataTransfer.getData("text/plain") || draggingDocId;
              if (droppedDoc) moveDocToFolder(droppedDoc, null);
            }
          }}
        >
          <IconHome />
          <span className="folder-link-text">Home</span>
          <span className="folder-count">{folderDocCounts.rootCount}</span>
        </button>

        <div className="sidebar-section-row">
          <p className="sidebar-section-label">Folders</p>
          <button
            className="sidebar-add-btn"
            onClick={() => setCreatingFolder("__root__")}
            aria-label="New folder"
          >
            <IconPlus />
          </button>
        </div>

        <div className="folder-list">
          {creatingFolder === "__root__" && (
            <form className="new-folder-inline" onSubmit={createFolder}>
              <IconFolder />
              <input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                autoFocus
                onBlur={() => {
                  if (!newFolderName.trim()) {
                    setCreatingFolder(null);
                    setNewFolderName("");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setCreatingFolder(null);
                    setNewFolderName("");
                  }
                }}
              />
            </form>
          )}
          {flatFolders.map((node) => {
            const folder = node.folder;
            const hasChildren = node.children.length > 0;
            const isExpanded = expandedFolders.has(folder.id);
            const isVisible =
              node.depth === 0 ||
              (() => {
                let cur: string | null = folder.parentId;
                while (cur) {
                  if (!expandedFolders.has(cur)) return false;
                  const parent = folders.find((f) => f.id === cur);
                  cur = parent?.parentId ?? null;
                }
                return true;
              })();
            if (!isVisible) return null;

            const isRenaming =
              renameTarget?.id === folder.id && renameTarget.kind === "folder";
            return (
              <div key={folder.id}>
                <div
                  className={`folder-item ${currentFolder === folder.id ? "active drop-target" : ""}`}
                  style={{ paddingLeft: node.depth * 16 }}
                  draggable
                  onDragStart={(e) => {
                    e.stopPropagation();
                    setDraggingFolderId(folder.id);
                    e.dataTransfer.setData("application/x-folder", folder.id);
                    const ghost = document.createElement("div");
                    ghost.textContent = folder.name;
                    ghost.className = "drag-ghost";
                    document.body.appendChild(ghost);
                    e.dataTransfer.setDragImage(ghost, 0, 0);
                    requestAnimationFrame(() => ghost.remove());
                  }}
                  onDragEnd={() => setDraggingFolderId(null)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (draggingFolderId && draggingFolderId !== folder.id) {
                      moveFolderToParent(draggingFolderId, folder.id);
                    } else {
                      const droppedDoc =
                        e.dataTransfer.getData("text/plain") || draggingDocId;
                      if (droppedDoc) moveDocToFolder(droppedDoc, folder.id);
                    }
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
                        if (e.key === "Escape") {
                          renameCancelled.current = true;
                          setRenameTarget(null);
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <div className="folder-row">
                      <button
                        className="tree-toggle"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (hasChildren) toggleExpand(folder.id);
                        }}
                        style={{
                          visibility: hasChildren ? "visible" : "hidden",
                        }}
                      >
                        <IconTreeChevron expanded={isExpanded} />
                      </button>
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
                        onClick={() => {
                          setCreatingFolder(folder.id);
                          setOpenMenuId(null);
                        }}
                      >
                        New subfolder
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
                {creatingFolder === folder.id && (
                  <form
                    className="new-folder-inline"
                    style={{ paddingLeft: (node.depth + 1) * 16 + 10 }}
                    onSubmit={createFolder}
                  >
                    <IconFolder />
                    <input
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Subfolder name"
                      autoFocus
                      onBlur={() => {
                        if (!newFolderName.trim()) {
                          setCreatingFolder(null);
                          setNewFolderName("");
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setCreatingFolder(null);
                          setNewFolderName("");
                        }
                      }}
                    />
                  </form>
                )}
              </div>
            );
          })}
        </div>

        <div className="sidebar-resize-handle" onMouseDown={onResizeStart} />
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
                  {(
                    [
                      "tldraw",
                      "excalidraw",
                      "drawio",
                      "markdown",
                      "spreadsheet",
                      "kanban",
                    ] as DocumentType[]
                  )
                    .filter((type) => type !== "tldraw" || config.enableTldraw)
                    .map((type) => {
                      const conf = TYPE_CONFIG[type];
                      const Icon = TYPE_ICONS[type];
                      return (
                        <button
                          key={type}
                          onClick={() => createNewDocument(type)}
                        >
                          <span style={{ color: conf.color, display: "flex" }}>
                            <Icon />
                          </span>
                          <span>{conf.label}</span>
                        </button>
                      );
                    })}
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
          <>
            {selectedIds.size > 0 && (
              <div className="bulk-bar">
                <span className="bulk-bar__count">
                  {selectedIds.size} selected
                </span>
                <div className="bulk-bar__actions">
                  <button className="bulk-bar__btn" onClick={clearSelection}>
                    Clear
                  </button>
                  <div className="bulk-move-menu">
                    <button
                      className="bulk-bar__btn"
                      onClick={() => setBulkMoveOpen((v) => !v)}
                    >
                      Move to...
                    </button>
                    {bulkMoveOpen && (
                      <div className="bulk-move-dropdown">
                        <button onClick={() => bulkMove(null)}>
                          <IconHome />
                          <span style={{ marginLeft: 6 }}>Home</span>
                        </button>
                        <FolderTreeMenu
                          folders={folderTree}
                          onSelect={(fid) => bulkMove(fid)}
                          depth={0}
                        />
                      </div>
                    )}
                  </div>
                  <button
                    className="bulk-bar__btn bulk-bar__btn--danger"
                    onClick={bulkDelete}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
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
              {visibleDocs.map((doc, index) => {
                const isRenaming =
                  renameTarget?.id === doc.id && renameTarget.kind === "doc";
                const typeConf = TYPE_CONFIG[doc.type] || TYPE_CONFIG.tldraw;
                const TypeIcon = TYPE_ICONS[doc.type] || TYPE_ICONS.tldraw;
                const isSelected = selectedIds.has(doc.id);
                return (
                  <div
                    key={doc.id}
                    className={`doc-row${isSelected ? " doc-row--selected" : ""}`}
                    draggable
                    onDragStart={(e) => {
                      if (longPressTimer.current) {
                        clearTimeout(longPressTimer.current);
                        longPressTimer.current = null;
                      }
                      setDraggingDocId(doc.id);
                      e.dataTransfer.setData("text/plain", doc.id);
                      const ghost = document.createElement("div");
                      ghost.textContent = doc.name;
                      ghost.className = "drag-ghost";
                      document.body.appendChild(ghost);
                      e.dataTransfer.setDragImage(ghost, 0, 0);
                      requestAnimationFrame(() => ghost.remove());
                    }}
                    onDragEnd={() => setDraggingDocId(null)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      const menuId = `doc-${doc.id}`;
                      setOpenMenuId(menuId);
                      setMenuPos({ x: e.clientX, y: e.clientY });
                      setMoveMenuDocId(null);
                    }}
                    onClick={(e) => {
                      if (e.shiftKey || selectedIds.size > 0) {
                        e.preventDefault();
                        toggleSelect(doc.id, index, e.shiftKey);
                      }
                    }}
                    onPointerDown={() => {
                      longPressTimer.current = setTimeout(() => {
                        toggleSelect(doc.id, index, false);
                      }, 500);
                    }}
                    onPointerUp={() => {
                      if (longPressTimer.current) {
                        clearTimeout(longPressTimer.current);
                        longPressTimer.current = null;
                      }
                    }}
                    onPointerLeave={() => {
                      if (longPressTimer.current) {
                        clearTimeout(longPressTimer.current);
                        longPressTimer.current = null;
                      }
                    }}
                  >
                    <span
                      className="doc-row__icon"
                      style={{ color: typeConf.color }}
                      onClick={(e) => {
                        if (selectedIds.size > 0) return;
                        e.stopPropagation();
                        openDoc(doc);
                      }}
                    >
                      {selectedIds.size > 0 ? (
                        <button
                          className={`doc-row__checkbox${isSelected ? " doc-row__checkbox--checked" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(doc.id, index, e.shiftKey);
                          }}
                        >
                          {isSelected && (
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
                      ) : (
                        <TypeIcon />
                      )}
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
                            if (e.key === "Escape") {
                              renameCancelled.current = true;
                              setRenameTarget(null);
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <ClickOrDouble
                          className="doc-row__name-btn"
                          onSingleClick={() => {
                            if (selectedIds.size > 0) return;
                            openDoc(doc);
                          }}
                          onDoubleClick={() => {
                            startRename(doc.id, "doc", doc.name);
                          }}
                        >
                          {doc.name}
                        </ClickOrDouble>
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
                          setMenuPos(null);
                          setOpenMenuId((current) =>
                            current === menuId ? null : menuId,
                          );
                          setMoveMenuDocId(null);
                        }}
                        aria-label={`Actions for ${doc.name}`}
                      >
                        <IconDots />
                      </button>

                      {openMenuId === `doc-${doc.id}` && !menuPos && (
                        <DocContextMenu
                          doc={doc}
                          index={index}
                          openDoc={openDoc}
                          startRename={startRename}
                          deleteDoc={deleteDoc}
                          toggleSelect={toggleSelect}
                          setMoveMenuDocId={setMoveMenuDocId}
                          moveMenuDocId={moveMenuDocId}
                          moveDocToFolder={moveDocToFolder}
                          folderTree={folderTree}
                          setOpenMenuId={setOpenMenuId}
                        />
                      )}
                    </span>
                  </div>
                );
              })}
            </section>
          </>
        )}

        {openMenuId?.startsWith("doc-") &&
          menuPos &&
          (() => {
            const docId = openMenuId.replace("doc-", "");
            const doc = visibleDocs.find((d) => d.id === docId);
            const index = visibleDocs.findIndex((d) => d.id === docId);
            if (!doc) return null;
            return (
              <div
                className="context-menu-portal"
                style={{ top: menuPos.y, left: menuPos.x }}
                onClick={(e) => e.stopPropagation()}
              >
                <DocContextMenu
                  doc={doc}
                  index={index}
                  openDoc={openDoc}
                  startRename={startRename}
                  deleteDoc={deleteDoc}
                  toggleSelect={toggleSelect}
                  setMoveMenuDocId={setMoveMenuDocId}
                  moveMenuDocId={moveMenuDocId}
                  moveDocToFolder={moveDocToFolder}
                  folderTree={folderTree}
                  setOpenMenuId={setOpenMenuId}
                />
              </div>
            );
          })()}
      </main>
    </div>
  );
}
