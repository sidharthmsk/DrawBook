import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useConfirm } from "./ConfirmDialog";
import { MindMapView } from "./MindMapView";
import { LinkGraph } from "./LinkGraph";
import { CalendarView } from "./CalendarView";
import { SettingsPage } from "./SettingsPage";
import { openCommandPalette } from "./CommandPalette";
import type {
  DocumentItem,
  DocumentType,
  Folder,
  RenameTarget,
  AppConfig,
} from "./dashboard/types";
import { typeFromId } from "./dashboard/folderUtils";
import {
  buildFolderTree,
  flattenTree,
  collectDescendantIds,
} from "./dashboard/folderUtils";
import {
  IconTreeChevron,
  IconHome,
  IconFolder,
  IconPlus,
  IconTemplate,
  IconDots,
  IconMenu,
  IconUpload,
  IconChevron,
  IconTldraw,
  TYPE_CONFIG,
  TYPE_ICONS,
} from "./dashboard/DashboardIcons";
import { ClickOrDouble } from "./dashboard/ClickOrDouble";
import {
  FolderTreeMenu,
  FilteredFolderTreeMenu,
} from "./dashboard/FolderTreeMenu";
import { DocContextMenu } from "./dashboard/DocContextMenu";
import { TasksView } from "./dashboard/TasksView";
import { TrashView } from "./dashboard/TrashView";
import { ShortcutsModal } from "./dashboard/ShortcutsModal";
import { AiTemplateModal } from "./dashboard/AiTemplateModal";
import { TagEditModal } from "./dashboard/TagEditModal";
import { FleetingPanel } from "./dashboard/FleetingPanel";

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
  type SortKey =
    | "modified-desc"
    | "modified-asc"
    | "name-asc"
    | "name-desc"
    | "type";
  const [sortKey, setSortKey] = useState<SortKey>(
    () => (localStorage.getItem("drawbook_sort") as SortKey) || "modified-desc",
  );
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tagEditDocId, setTagEditDocId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [aiTemplateOpen, setAiTemplateOpen] = useState(false);
  const [aiTemplatePrompt, setAiTemplatePrompt] = useState("");
  const [aiTemplateType, setAiTemplateType] = useState<"markdown" | "kanban">(
    "markdown",
  );
  const [aiTemplateLoading, setAiTemplateLoading] = useState(false);
  const [draggingDocId, setDraggingDocId] = useState<string | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [showLinkGraph, setShowLinkGraph] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [fleetingOpen, setFleetingOpen] = useState(false);
  const [fleetingNotes, setFleetingNotes] = useState<
    Array<{
      id: string;
      text: string;
      done: boolean;
      createdAt: string;
      documentId?: string;
    }>
  >([]);
  const [fleetingInput, setFleetingInput] = useState("");
  const [fleetingTypeMenu, setFleetingTypeMenu] = useState<string | null>(null);
  const [showTasks, setShowTasks] = useState(false);
  const [tasks, setTasks] = useState<
    Array<{
      id: string;
      text: string;
      done: boolean;
      documentId: string;
      createdAt: string;
    }>
  >([]);
  const [taskFilter, setTaskFilter] = useState<"all" | "open" | "done">("all");
  const [templates, setTemplates] = useState<
    Array<{
      id: string;
      name: string;
      type: string;
      createdAt: string;
    }>
  >([]);
  const [trashDocs, setTrashDocs] = useState<
    Array<{ id: string; name: string; type: string; deletedAt: string }>
  >([]);
  const [focusedDocIndex, setFocusedDocIndex] = useState(-1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [moveMenuDocId, setMoveMenuDocId] = useState<string | null>(null);
  const [moveFolderMenuId, setMoveFolderMenuId] = useState<string | null>(null);
  const [newDropdownOpen, setNewDropdownOpen] = useState(false);
  const [newDropdownPos, setNewDropdownPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [isTopbarCompact, setIsTopbarCompact] = useState(
    () => window.matchMedia("(max-width: 900px)").matches,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const lastSelectedIndex = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newDropdownButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const touchStartX = useRef<number | null>(null);

  const updateNewDropdownPos = useCallback(() => {
    const button = newDropdownButtonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const menuWidth = 220;
    const horizontalPadding = 12;
    const left = Math.min(
      Math.max(horizontalPadding, rect.right - menuWidth),
      window.innerWidth - menuWidth - horizontalPadding,
    );
    setNewDropdownPos({
      top: rect.bottom + 6,
      left,
    });
  }, []);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 900px)");
    const onChange = (event: MediaQueryListEvent) =>
      setIsTopbarCompact(event.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const handleSidebarTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleSidebarTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (deltaX < -50) {
      setSidebarOpen(false);
    }
    touchStartX.current = null;
  }, []);

  const [viewMode, setViewMode] = useState<
    "list" | "grid" | "mindmap" | "calendar"
  >(() => {
    try {
      return (
        (localStorage.getItem("drawbook_view_mode") as
          | "list"
          | "grid"
          | "mindmap"
          | "calendar") || "list"
      );
    } catch {
      return "list";
    }
  });

  useEffect(() => {
    localStorage.setItem("drawbook_view_mode", viewMode);
  }, [viewMode]);

  // Listen for command palette dashboard actions (settings, trash)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.action) return;
      if (detail.action === "settings") {
        setShowSettings(true);
        setShowTrash(false);
        setShowTasks(false);
        setShowLinkGraph(false);
      } else if (detail.action === "trash") {
        setShowTrash(true);
        setShowSettings(false);
        setShowTasks(false);
        setShowLinkGraph(false);
      }
    };
    document.addEventListener("command-palette-action", handler);
    return () =>
      document.removeEventListener("command-palette-action", handler);
  }, []);

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

    let lastRefresh = Date.now();
    const refreshIfStale = () => {
      if (Date.now() - lastRefresh > 2000) {
        lastRefresh = Date.now();
        loadData();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshIfStale();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refreshIfStale);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refreshIfStale);
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        setNewDropdownOpen(true);
        if (!isTopbarCompact) {
          requestAnimationFrame(updateNewDropdownPos);
        }
      }
      const tag = (e.target as HTMLElement).tagName;
      if (
        e.key === "?" &&
        tag !== "INPUT" &&
        tag !== "TEXTAREA" &&
        tag !== "SELECT"
      ) {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isTopbarCompact, updateNewDropdownPos]);

  useEffect(() => {
    if (newDropdownOpen) loadTemplates();
  }, [newDropdownOpen]);

  useEffect(() => {
    if (!newDropdownOpen || isTopbarCompact) return;
    updateNewDropdownPos();
    window.addEventListener("resize", updateNewDropdownPos);
    window.addEventListener("scroll", updateNewDropdownPos, true);
    return () => {
      window.removeEventListener("resize", updateNewDropdownPos);
      window.removeEventListener("scroll", updateNewDropdownPos, true);
    };
  }, [newDropdownOpen, isTopbarCompact, updateNewDropdownPos]);

  useEffect(() => {
    if (!newDropdownOpen) return;
    const closeOnOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (newDropdownButtonRef.current?.contains(target)) return;
      if (target.closest(".new-dropdown-menu")) return;
      setNewDropdownOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNewDropdownOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("touchstart", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("touchstart", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [newDropdownOpen]);

  useEffect(() => {
    if (!openMenuId && !bulkMoveOpen) return;
    const closeMenus = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          ".dropdown-menu, .dropdown-popout, .bulk-move-dropdown, .context-menu-portal, .icon-menu-btn, .sidebar-folder__menu-btn, .bulk-bar__btn",
        )
      )
        return;
      setOpenMenuId(null);
      setMenuPos(null);
      setMoveMenuDocId(null);
      setMoveFolderMenuId(null);
      setBulkMoveOpen(false);
    };
    const raf = requestAnimationFrame(() => {
      document.addEventListener("mousedown", closeMenus);
      document.addEventListener("touchstart", closeMenus);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", closeMenus);
      document.removeEventListener("touchstart", closeMenus);
    };
  }, [openMenuId, bulkMoveOpen]);

  const createNewDocument = (type: DocumentType) => {
    const prefix = type === "tldraw" ? "drawing" : type;
    const docId = `${prefix}-${Date.now()}`;
    const folderParam = currentFolder
      ? `&folder=${encodeURIComponent(currentFolder)}`
      : "";
    window.location.href = `/?doc=${docId}&type=${type}${folderParam}`;
  };

  const openDoc = (doc: DocumentItem) => {
    try {
      const raw = localStorage.getItem("drawbook_recent");
      const recent: string[] = raw ? JSON.parse(raw) : [];
      const updated = [doc.id, ...recent.filter((id) => id !== doc.id)].slice(
        0,
        10,
      );
      localStorage.setItem("drawbook_recent", JSON.stringify(updated));
    } catch {
      /* ignore */
    }
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
    const docs = allDocs.filter((doc) => doc.folderId === currentFolder);
    const sorted = [...docs];
    switch (sortKey) {
      case "modified-asc":
        sorted.sort(
          (a, b) =>
            new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime(),
        );
        break;
      case "name-asc":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name-desc":
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "type":
        sorted.sort(
          (a, b) =>
            a.type.localeCompare(b.type) || a.name.localeCompare(b.name),
        );
        break;
      default:
        sorted.sort(
          (a, b) =>
            new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime(),
        );
    }
    sorted.sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0));
    if (activeTag) {
      return sorted.filter((d) => d.tags?.includes(activeTag));
    }
    return sorted;
  }, [allDocs, currentFolder, sortKey, activeTag]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setFocusedDocIndex((prev) =>
          Math.min(prev + 1, visibleDocs.length - 1),
        );
      }
      if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setFocusedDocIndex((prev) => Math.max(prev - 1, 0));
      }
      if (
        e.key === "Enter" &&
        focusedDocIndex >= 0 &&
        focusedDocIndex < visibleDocs.length
      ) {
        e.preventDefault();
        openDoc(visibleDocs[focusedDocIndex]);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [focusedDocIndex, visibleDocs, openDoc]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    allDocs.forEach((d) => d.tags?.forEach((t) => tagSet.add(t)));
    return [...tagSet].sort();
  }, [allDocs]);

  const recentDocs = useMemo(() => {
    if (currentFolder) return [];
    try {
      const raw = localStorage.getItem("drawbook_recent");
      const ids: string[] = raw ? JSON.parse(raw) : [];
      return ids
        .map((id) => allDocs.find((d) => d.id === id))
        .filter((d): d is DocumentItem => !!d)
        .slice(0, 5);
    } catch {
      return [];
    }
  }, [allDocs, currentFolder]);

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
    if (
      !(await confirm({
        message: "Move this document to trash?",
        danger: true,
      }))
    )
      return;
    try {
      const res = await fetch(`/api/delete/${docId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete document failed");
      setAllDocs((prev) => prev.filter((doc) => doc.id !== docId));
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const loadTrash = async () => {
    try {
      const res = await fetch("/api/trash");
      const data = await res.json();
      setTrashDocs(data.documents || []);
    } catch (err) {
      console.error("Failed to load trash:", err);
    }
  };

  const loadTemplates = async () => {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (err) {
      console.error("Failed to load templates:", err);
    }
  };

  const useTemplate = async (templateId: string) => {
    try {
      const res = await fetch(`/api/templates/${templateId}/use`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: currentFolder }),
      });
      if (!res.ok) throw new Error("Use template failed");
      const data = await res.json();
      window.location.href = `/?doc=${data.documentId}&type=${data.type}`;
    } catch (err) {
      console.error("Failed to use template:", err);
    }
  };

  const saveDocAsTemplate = async (docId: string) => {
    const doc = allDocs.find((d) => d.id === docId);
    const name = window.prompt("Template name:", doc ? doc.name : docId);
    if (!name?.trim()) return;
    try {
      const res = await fetch(`/api/templates/from-doc/${docId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error("Save as template failed");
    } catch (err) {
      console.error("Failed to save as template:", err);
    }
  };

  const loadFleetingNotes = async () => {
    try {
      const res = await fetch("/api/fleeting");
      const data = await res.json();
      setFleetingNotes(data.notes || []);
    } catch (err) {
      console.error("Failed to load fleeting notes:", err);
    }
  };

  const addFleetingNote = async () => {
    if (!fleetingInput.trim()) return;
    try {
      const res = await fetch("/api/fleeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: fleetingInput.trim() }),
      });
      if (!res.ok) throw new Error("Create failed");
      const data = await res.json();
      setFleetingNotes((prev) => [data.note, ...prev]);
      setFleetingInput("");
    } catch (err) {
      console.error("Failed to add fleeting note:", err);
    }
  };

  const toggleFleetingDone = async (noteId: string, done: boolean) => {
    try {
      await fetch(`/api/fleeting/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done }),
      });
      setFleetingNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, done } : n)),
      );
    } catch (err) {
      console.error("Failed to toggle fleeting note:", err);
    }
  };

  const deleteFleetingNote = async (noteId: string) => {
    if (!(await confirm({ message: "Delete this note?", danger: true })))
      return;
    try {
      await fetch(`/api/fleeting/${noteId}`, { method: "DELETE" });
      setFleetingNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      console.error("Failed to delete fleeting note:", err);
    }
  };

  const openFleetingAs = async (noteId: string, type: DocumentType) => {
    setFleetingTypeMenu(null);
    try {
      const res = await fetch(`/api/fleeting/${noteId}/open-as`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error("Open-as failed");
      const data = await res.json();
      setFleetingNotes((prev) =>
        prev.map((n) =>
          n.id === noteId
            ? { ...n, done: true, documentId: data.documentId }
            : n,
        ),
      );
      window.location.href = `/?doc=${data.documentId}&type=${data.type}`;
    } catch (err) {
      console.error("Failed to open fleeting as doc:", err);
    }
  };

  const loadTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    }
  };

  const toggleTaskDone = async (taskId: string, done: boolean) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done }),
      });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, done } : t)),
      );
    } catch (err) {
      console.error("Failed to toggle task:", err);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!(await confirm({ message: "Delete this task?", danger: true })))
      return;
    try {
      await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  const restoreFromTrash = async (docId: string) => {
    try {
      const res = await fetch(`/api/trash/${docId}/restore`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Restore failed");
      setTrashDocs((prev) => prev.filter((d) => d.id !== docId));
      await loadData();
    } catch (err) {
      console.error("Failed to restore:", err);
    }
  };

  const permanentDelete = async (docId: string) => {
    if (
      !(await confirm({
        message: "Permanently delete? This cannot be undone.",
        danger: true,
      }))
    )
      return;
    try {
      const res = await fetch(`/api/delete/${docId}?permanent=true`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Permanent delete failed");
      setTrashDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      console.error("Failed to permanently delete:", err);
    }
  };

  const emptyTrash = async () => {
    if (
      !(await confirm({
        message: `Permanently delete all ${trashDocs.length} items in trash?`,
        danger: true,
      }))
    )
      return;
    try {
      const res = await fetch("/api/trash/empty", { method: "POST" });
      if (!res.ok) throw new Error("Empty trash failed");
      setTrashDocs([]);
    } catch (err) {
      console.error("Failed to empty trash:", err);
    }
  };

  const toggleStar = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}/star`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Star toggle failed");
      const { starred } = (await res.json()) as { starred: boolean };
      setAllDocs((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, starred } : d)),
      );
    } catch (err) {
      console.error("Failed to toggle star:", err);
    }
  };

  const saveDocTags = async (docId: string, tags: string[]) => {
    try {
      const res = await fetch(`/api/documents/${docId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      if (!res.ok) throw new Error("Tag save failed");
      setAllDocs((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, tags } : d)),
      );
    } catch (err) {
      console.error("Failed to save tags:", err);
    }
  };

  const createFromAiTemplate = async () => {
    if (!aiTemplatePrompt.trim()) return;
    setAiTemplateLoading(true);
    try {
      const systemMsg =
        aiTemplateType === "kanban"
          ? "Generate a Kanban board as JSON: { columns: [{ id, title, cardIds }], cards: [{ id, title, description }] }. Return ONLY valid JSON, no markdown."
          : "Generate markdown content. Return ONLY the markdown text, no code fences.";
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: aiTemplatePrompt.trim() }],
          editorType: aiTemplateType,
          canvasContext: systemMsg,
        }),
      });
      const data = await res.json();
      const content = data.content || data.message || "";
      const docId = `${aiTemplateType}-${Date.now()}`;
      let snapshot: unknown;
      if (aiTemplateType === "kanban") {
        try {
          snapshot = JSON.parse(content);
        } catch {
          snapshot = {
            columns: [{ id: "col-1", title: "To Do", cardIds: [] }],
            cards: [],
          };
        }
      } else {
        snapshot = { content };
      }
      await fetch(`/api/save/${docId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot, type: aiTemplateType }),
      });
      const name = aiTemplatePrompt.trim().slice(0, 40);
      await fetch(`/api/rename/${docId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setAiTemplateOpen(false);
      setAiTemplatePrompt("");
      window.location.hash = `#/doc/${docId}`;
    } catch (err) {
      console.error("AI template error:", err);
    } finally {
      setAiTemplateLoading(false);
    }
  };

  const duplicateDoc = async (docId: string) => {
    if (
      !(await confirm({
        message: "Duplicate this document?",
        confirmLabel: "Duplicate",
        danger: false,
      }))
    )
      return;
    try {
      const res = await fetch(`/api/duplicate/${docId}`, { method: "POST" });
      if (!res.ok) throw new Error("Duplicate failed");
      await loadData();
    } catch (err) {
      console.error("Failed to duplicate document:", err);
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
        ref={sidebarRef}
        className={`dashboard-sidebar ${sidebarOpen ? "open" : ""}`}
        style={{ width: sidebarWidth, minWidth: sidebarWidth }}
        onTouchStart={handleSidebarTouchStart}
        onTouchEnd={handleSidebarTouchEnd}
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
            setShowTrash(false);
            setShowTasks(false);
            setShowLinkGraph(false);
            setShowSettings(false);
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
                          setShowTrash(false);
                          setShowTasks(false);
                          setShowLinkGraph(false);
                          setShowSettings(false);
                          setSidebarOpen(false);
                          if (hasChildren && !expandedFolders.has(folder.id)) {
                            toggleExpand(folder.id);
                          }
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
                      <div
                        className="dropdown-menu__hover-parent"
                        onMouseLeave={() => {
                          if (!("ontouchstart" in window))
                            setMoveFolderMenuId(null);
                        }}
                      >
                        <button
                          className="dropdown-menu__has-sub"
                          onClick={() =>
                            setMoveFolderMenuId((cur) =>
                              cur === folder.id ? null : folder.id,
                            )
                          }
                          onMouseEnter={() => {
                            if (!("ontouchstart" in window))
                              setMoveFolderMenuId(folder.id);
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
                        {moveFolderMenuId === folder.id && (
                          <div
                            className="dropdown-popout"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                moveFolderToParent(folder.id, null);
                                setOpenMenuId(null);
                                setMoveFolderMenuId(null);
                              }}
                            >
                              <IconHome />
                              Home (root)
                            </button>
                            <FilteredFolderTreeMenu
                              folders={folderTree}
                              excludeIds={(() => {
                                const ids = collectDescendantIds(
                                  folderTree,
                                  folder.id,
                                );
                                ids.add(folder.id);
                                return ids;
                              })()}
                              onSelect={(fid) => {
                                if (fid) moveFolderToParent(folder.id, fid);
                                setOpenMenuId(null);
                                setMoveFolderMenuId(null);
                              }}
                              depth={0}
                            />
                          </div>
                        )}
                      </div>
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

        <div style={{ flex: 1 }} />
        <button
          className={`folder-link trash-link${showTasks ? " active" : ""}`}
          onClick={() => {
            setShowTasks(true);
            setShowTrash(false);
            setShowLinkGraph(false);
            setShowSettings(false);
            setCurrentFolder(null);
            loadTasks();
            loadFleetingNotes();
          }}
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
            <rect x="2" y="2" width="12" height="12" rx="2" />
            <path d="M5 8l2 2 4-4" />
          </svg>
          <span>Tasks</span>
        </button>
        <button
          className={`folder-link trash-link${showTrash ? " active" : ""}`}
          onClick={() => {
            setShowTrash(true);
            setShowTasks(false);
            setShowLinkGraph(false);
            setShowSettings(false);
            setCurrentFolder(null);
            loadTrash();
          }}
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
            <path d="M2 4h12M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9" />
          </svg>
          <span>Trash</span>
        </button>
        {config.enableLinking && (
          <button
            className={`folder-link trash-link${showLinkGraph ? " active" : ""}`}
            onClick={() => {
              setShowLinkGraph(true);
              setShowTrash(false);
              setShowTasks(false);
              setShowSettings(false);
            }}
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
              <circle cx="4" cy="4" r="2" />
              <circle cx="12" cy="4" r="2" />
              <circle cx="8" cy="12" r="2" />
              <path d="M6 4h4M5.5 5.5L7 10.5M10.5 5.5L9 10.5" />
            </svg>
            <span>Link Graph</span>
          </button>
        )}
        <button
          className={`folder-link trash-link${showSettings ? " active" : ""}`}
          onClick={() => {
            setShowSettings(true);
            setShowTrash(false);
            setShowTasks(false);
            setShowLinkGraph(false);
            setSidebarOpen(false);
          }}
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
            <circle cx="8" cy="8" r="2.5" />
            <path d="M13.3 10a1.1 1.1 0 00.22 1.21l.04.04a1.33 1.33 0 11-1.89 1.89l-.04-.04A1.1 1.1 0 0010 13.3v.04A1.33 1.33 0 017.33 14v-.07a1.1 1.1 0 00-.72-1.01 1.1 1.1 0 00-1.21.22l-.04.04a1.33 1.33 0 11-1.89-1.89l.04-.04A1.1 1.1 0 003.73 10a1.1 1.1 0 00-1.01-.72H2.67a1.33 1.33 0 010-2.67h.07a1.1 1.1 0 001.01-.72 1.1 1.1 0 00-.22-1.21l-.04-.04a1.33 1.33 0 111.89-1.89l.04.04A1.1 1.1 0 006.63 3v-.04a1.33 1.33 0 012.67 0v.07a1.1 1.1 0 00.72 1.01 1.1 1.1 0 001.21-.22l.04-.04a1.33 1.33 0 111.89 1.89l-.04.04A1.1 1.1 0 0012.9 6.93a1.1 1.1 0 001.01.72h.04a1.33 1.33 0 010 2.67h-.07a1.1 1.1 0 00-1.01.72z" />
          </svg>
          <span>Settings</span>
        </button>
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
            <button
              className="command-palette-trigger command-palette-trigger--search"
              onClick={() => openCommandPalette()}
              title="Search (⌘K)"
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
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5L14 14" />
              </svg>
              <span className="command-palette-trigger__label">Search...</span>
              <kbd className="command-palette-trigger__kbd">⌘K</kbd>
            </button>

            <select
              className="sort-select"
              value={sortKey}
              onChange={(e) => {
                const val = e.target.value as SortKey;
                setSortKey(val);
                localStorage.setItem("drawbook_sort", val);
              }}
            >
              <option value="modified-desc">Modified (newest)</option>
              <option value="modified-asc">Modified (oldest)</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="type">Type</option>
            </select>

            <div className="view-toggle">
              <button
                className={`view-toggle__btn ${viewMode === "list" ? "view-toggle__btn--active" : ""}`}
                onClick={() => setViewMode("list")}
                title="List view"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M2 4h12M2 8h12M2 12h12" />
                </svg>
              </button>
              <button
                className={`view-toggle__btn ${viewMode === "grid" ? "view-toggle__btn--active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Grid view"
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
                  <rect x="1" y="1" width="5.5" height="5.5" rx="1" />
                  <rect x="9.5" y="1" width="5.5" height="5.5" rx="1" />
                  <rect x="1" y="9.5" width="5.5" height="5.5" rx="1" />
                  <rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" />
                </svg>
              </button>
              <button
                className={`view-toggle__btn ${viewMode === "mindmap" ? "view-toggle__btn--active" : ""}`}
                onClick={() => setViewMode("mindmap")}
                title="Mind map view"
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
                  <circle cx="8" cy="3" r="2" />
                  <circle cx="3" cy="11" r="2" />
                  <circle cx="13" cy="11" r="2" />
                  <path d="M8 5v2M6.5 8.5L4.5 9.5M9.5 8.5L11.5 9.5" />
                </svg>
              </button>
              <button
                className={`view-toggle__btn ${viewMode === "calendar" ? "view-toggle__btn--active" : ""}`}
                onClick={() => setViewMode("calendar")}
                title="Calendar view"
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
                  <rect x="2" y="3" width="12" height="11" rx="1" />
                  <path d="M2 6.5h12" />
                  <path d="M5 1.5v3M11 1.5v3" />
                </svg>
              </button>
            </div>

            <button
              className="icon-action-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Upload file (PDF, Markdown, CSV)"
            >
              <IconUpload />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.md,.csv"
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />

            <div className="new-dropdown-wrapper">
              <button
                ref={newDropdownButtonRef}
                className="primary-btn"
                onClick={() =>
                  setNewDropdownOpen((v) => {
                    const next = !v;
                    if (next && !isTopbarCompact) {
                      requestAnimationFrame(updateNewDropdownPos);
                    }
                    return next;
                  })
                }
              >
                <IconPlus />
                New
                <IconChevron />
              </button>
              {newDropdownOpen &&
                (() => {
                  const dropdownContent = (
                    <>
                      {!isTopbarCompact && (
                        <div
                          className="new-dropdown-backdrop"
                          onMouseDown={() => setNewDropdownOpen(false)}
                          onTouchStart={() => setNewDropdownOpen(false)}
                        />
                      )}
                      <div
                        className="new-dropdown-menu"
                        style={
                          isTopbarCompact
                            ? {
                                position: "fixed",
                                top: "auto",
                                bottom:
                                  "calc(68px + env(safe-area-inset-bottom, 0px))",
                                left: 16,
                                right: "auto",
                                width: "min(280px, calc(100vw - 32px))",
                                minWidth: 220,
                                maxHeight: "50vh",
                                overflowY: "auto",
                                zIndex: 10001,
                              }
                            : newDropdownPos
                              ? {
                                  position: "fixed",
                                  top: newDropdownPos.top,
                                  left: newDropdownPos.left,
                                  right: "auto",
                                  minWidth: 220,
                                  zIndex: 10001,
                                }
                              : undefined
                        }
                      >
                        {(
                          [
                            "markdown",
                            "kanban",
                            "excalidraw",
                            "code",
                            "grid",
                            "spreadsheet",
                            "tldraw",
                          ] as DocumentType[]
                        )
                          .filter(
                            (type) => type !== "tldraw" || config.enableTldraw,
                          )
                          .map((type) => {
                            const conf = TYPE_CONFIG[type];
                            const Icon = TYPE_ICONS[type];
                            return (
                              <button
                                key={type}
                                onClick={() => createNewDocument(type)}
                              >
                                <span
                                  style={{ color: conf.color, display: "flex" }}
                                >
                                  <Icon />
                                </span>
                                <span>{conf.label}</span>
                              </button>
                            );
                          })}
                        {templates.length > 0 && (
                          <>
                            <div className="new-dropdown-divider" />
                            <div className="new-dropdown-section-label">
                              From Template
                            </div>
                            {templates.map((t) => (
                              <button
                                key={t.id}
                                onClick={() => {
                                  useTemplate(t.id);
                                  setNewDropdownOpen(false);
                                }}
                              >
                                <span style={{ display: "flex", opacity: 0.6 }}>
                                  <IconTemplate />
                                </span>
                                <span>{t.name}</span>
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    </>
                  );
                  return createPortal(dropdownContent, document.body);
                })()}
            </div>
          </div>
        </header>

        {allTags.length > 0 && (
          <div className="tag-filter-bar">
            <button
              className={`tag-filter-btn${!activeTag ? " tag-filter-btn--active" : ""}`}
              onClick={() => setActiveTag(null)}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                className={`tag-filter-btn${activeTag === tag ? " tag-filter-btn--active" : ""}`}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        <p className="hint-text">
          Tip: drag any card and drop it onto a folder on the left to move it
          quickly.
        </p>

        {showSettings ? (
          <SettingsPage
            onClose={() => setShowSettings(false)}
            isElectron={config.isElectron}
          />
        ) : showLinkGraph && config.enableLinking ? (
          <LinkGraph onClose={() => setShowLinkGraph(false)} />
        ) : showTasks ? (
          <TasksView
            tasks={tasks}
            fleetingNotes={fleetingNotes}
            fleetingInput={fleetingInput}
            setFleetingInput={setFleetingInput}
            taskFilter={taskFilter}
            setTaskFilter={setTaskFilter}
            allDocs={allDocs}
            openDoc={openDoc}
            addFleetingNote={addFleetingNote}
            toggleFleetingDone={toggleFleetingDone}
            deleteFleetingNote={deleteFleetingNote}
            openFleetingAs={openFleetingAs}
            toggleTaskDone={toggleTaskDone}
            deleteTask={deleteTask}
          />
        ) : showTrash ? (
          <TrashView
            trashDocs={trashDocs}
            emptyTrash={emptyTrash}
            restoreFromTrash={restoreFromTrash}
            permanentDelete={permanentDelete}
          />
        ) : loading ? (
          <div className="empty-state">
            <p>Loading...</p>
          </div>
        ) : error ? (
          <div className="empty-state">
            <p>{error}</p>
          </div>
        ) : viewMode === "calendar" ? (
          <CalendarView docs={allDocs} onOpenDocument={openDoc} />
        ) : viewMode === "mindmap" ? (
          <MindMapView
            docs={allDocs}
            folders={folders}
            expandedFolders={expandedFolders}
            onToggleFolder={toggleExpand}
            onOpenDocument={(docId) => {
              const doc = allDocs.find((d) => d.id === docId);
              if (doc) openDoc(doc);
            }}
            onCreateDocument={(folderId, type) => {
              if (folderId) setCurrentFolder(folderId);
              createNewDocument(type);
            }}
            onCreateFolder={async (parentId) => {
              const name = window.prompt("Folder name:");
              if (!name?.trim()) return;
              try {
                const res = await fetch("/api/folders", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: name.trim(),
                    parentId: parentId ?? null,
                  }),
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
                await loadData();
              } catch (err) {
                console.error("Failed to create folder:", err);
              }
            }}
            onRenameDocument={(docId) => {
              const doc = allDocs.find((d) => d.id === docId);
              if (doc) startRename(doc.id, "doc", doc.name);
            }}
            onRenameFolder={(folderId) => {
              const folder = folders.find((f) => f.id === folderId);
              if (folder) startRename(folder.id, "folder", folder.name);
            }}
            onDeleteDocument={deleteDoc}
            onDeleteFolder={deleteFolder}
            onMoveDocument={(docId, targetFolderId) => {
              const prev = allDocs.map((d) => ({ ...d }));
              setAllDocs((docs) =>
                docs.map((d) =>
                  d.id === docId ? { ...d, folderId: targetFolderId } : d,
                ),
              );
              fetch(`/api/documents/${docId}/move`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ folderId: targetFolderId }),
              })
                .then((res) => {
                  if (!res.ok) throw new Error("Move failed");
                })
                .catch((err) => {
                  console.error("Failed to move document:", err);
                  setAllDocs(prev);
                });
            }}
            onMoveFolder={(folderId, targetParentId) => {
              const prev = folders.map((f) => ({ ...f }));
              setFolders((flds) =>
                flds.map((f) =>
                  f.id === folderId ? { ...f, parentId: targetParentId } : f,
                ),
              );
              fetch(`/api/folders/${folderId}/move`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ parentId: targetParentId }),
              })
                .then((res) => {
                  if (!res.ok) throw new Error("Move failed");
                })
                .catch((err) => {
                  console.error("Failed to move folder:", err);
                  setFolders(prev);
                });
            }}
          />
        ) : viewMode === "grid" ? (
          visibleDocs.length === 0 ? (
            <div className="empty-state">
              <h3>No documents yet</h3>
              <p>Create a new document to get started.</p>
            </div>
          ) : (
            <div className="doc-grid">
              {visibleDocs.map((doc) => {
                const typeConf = TYPE_CONFIG[doc.type] || TYPE_CONFIG.tldraw;
                const TypeIcon = TYPE_ICONS[doc.type] || TYPE_ICONS.tldraw;
                return (
                  <div
                    key={doc.id}
                    className="doc-grid__card"
                    style={{ borderTopColor: typeConf.color }}
                  >
                    <ClickOrDouble
                      className="doc-grid__clickable"
                      onSingleClick={() => openDoc(doc)}
                      onDoubleClick={() => startRename(doc.id, "doc", doc.name)}
                    >
                      <div
                        className="doc-grid__icon"
                        style={{ color: typeConf.color }}
                      >
                        <TypeIcon />
                      </div>
                      {renameTarget?.id === doc.id ? (
                        <input
                          className="doc-grid__rename-input"
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
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="doc-grid__name">{doc.name}</span>
                      )}
                    </ClickOrDouble>
                    <span
                      className="doc-grid__type"
                      style={{ color: typeConf.color }}
                    >
                      {typeConf.label}
                    </span>
                    <span className="doc-grid__date">
                      {new Date(doc.modifiedAt).toLocaleDateString()}
                    </span>
                    <button
                      className="doc-grid__star"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStar(doc.id);
                      }}
                    >
                      {doc.starred ? "★" : "☆"}
                    </button>
                  </div>
                );
              })}
            </div>
          )
        ) : visibleDocs.length === 0 && recentDocs.length === 0 ? (
          <div className="empty-state">
            <h3>No documents yet</h3>
            <p>
              Create a new document to get started, or drag documents from
              another folder into this one.
            </p>
          </div>
        ) : (
          <>
            {(() => {
              const starredDocs = visibleDocs.filter((d) => d.starred);
              if (starredDocs.length === 0) return null;
              return (
                <section className="favorites-section">
                  <h3 className="favorites-section__title">★ Favorites</h3>
                  <div className="favorites-section__row">
                    {starredDocs.map((doc) => {
                      const typeConf =
                        TYPE_CONFIG[doc.type] || TYPE_CONFIG.tldraw;
                      const TypeIcon = TYPE_ICONS[doc.type] || IconTldraw;
                      return (
                        <button
                          key={doc.id}
                          className="favorites-section__card"
                          style={{ borderLeftColor: typeConf.color }}
                          onClick={() => openDoc(doc)}
                        >
                          <TypeIcon />
                          <span className="favorites-section__name">
                            {doc.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })()}
            {recentDocs.length > 0 && (
              <section className="recent-docs">
                <h3 className="recent-docs__title">Recent</h3>
                <div className="recent-docs__row">
                  {recentDocs.map((doc) => {
                    const TypeIcon = TYPE_ICONS[doc.type] || IconTldraw;
                    return (
                      <button
                        key={doc.id}
                        className="recent-docs__card"
                        onClick={() => openDoc(doc)}
                      >
                        <TypeIcon />
                        <span className="recent-docs__name">{doc.name}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
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
                <span className="doc-list__col" />
                <span className="doc-list__col doc-list__col--name">Name</span>
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
                    className={`doc-row${isSelected ? " doc-row--selected" : ""}${focusedDocIndex === index ? " doc-row--focused" : ""}`}
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

                    <button
                      className={`doc-row__star${doc.starred ? " doc-row__star--active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStar(doc.id);
                      }}
                      title={doc.starred ? "Unstar" : "Star"}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill={doc.starred ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>

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
                        {doc.tags &&
                          doc.tags.length > 0 &&
                          doc.tags.slice(0, 2).map((t) => (
                            <span key={t} className="doc-tag-pill">
                              {t}
                            </span>
                          ))}
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
                          duplicateDoc={duplicateDoc}
                          deleteDoc={deleteDoc}
                          toggleSelect={toggleSelect}
                          setMoveMenuDocId={setMoveMenuDocId}
                          moveMenuDocId={moveMenuDocId}
                          moveDocToFolder={moveDocToFolder}
                          folderTree={folderTree}
                          setOpenMenuId={setOpenMenuId}
                          onEditTags={(id) => {
                            setTagEditDocId(id);
                            setTagInput("");
                          }}
                          onSaveAsTemplate={saveDocAsTemplate}
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
                  duplicateDoc={duplicateDoc}
                  deleteDoc={deleteDoc}
                  toggleSelect={toggleSelect}
                  setMoveMenuDocId={setMoveMenuDocId}
                  moveMenuDocId={moveMenuDocId}
                  moveDocToFolder={moveDocToFolder}
                  folderTree={folderTree}
                  setOpenMenuId={setOpenMenuId}
                  onEditTags={(id) => {
                    setTagEditDocId(id);
                    setTagInput("");
                  }}
                  onSaveAsTemplate={saveDocAsTemplate}
                />
              </div>
            );
          })()}

        <button
          className="mobile-new-fab"
          onClick={() => setNewDropdownOpen(true)}
          aria-label="Create new document"
          title="New"
        >
          <IconPlus />
          <span>New</span>
        </button>
      </main>

      {shortcutsOpen && (
        <ShortcutsModal onClose={() => setShortcutsOpen(false)} />
      )}

      {aiTemplateOpen && (
        <AiTemplateModal
          aiTemplatePrompt={aiTemplatePrompt}
          setAiTemplatePrompt={setAiTemplatePrompt}
          aiTemplateType={aiTemplateType}
          setAiTemplateType={setAiTemplateType}
          aiTemplateLoading={aiTemplateLoading}
          onGenerate={createFromAiTemplate}
          onClose={() => setAiTemplateOpen(false)}
        />
      )}

      {tagEditDocId && (
        <TagEditModal
          tagEditDocId={tagEditDocId}
          allDocs={allDocs}
          tagInput={tagInput}
          setTagInput={setTagInput}
          saveDocTags={saveDocTags}
          onClose={() => setTagEditDocId(null)}
        />
      )}

      {!fleetingOpen && (
        <button
          className="fleeting-fab"
          onClick={() => {
            setFleetingOpen(true);
            loadFleetingNotes();
          }}
          title="Quick Notes"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V3a1 1 0 00-1-1z" />
            <path d="M5 8h6M8 5v6" />
          </svg>
        </button>
      )}

      {fleetingOpen && (
        <FleetingPanel
          fleetingNotes={fleetingNotes}
          fleetingInput={fleetingInput}
          setFleetingInput={setFleetingInput}
          fleetingTypeMenu={fleetingTypeMenu}
          setFleetingTypeMenu={setFleetingTypeMenu}
          allDocs={allDocs}
          onClose={() => setFleetingOpen(false)}
          addFleetingNote={addFleetingNote}
          toggleFleetingDone={toggleFleetingDone}
          deleteFleetingNote={deleteFleetingNote}
          openFleetingAs={openFleetingAs}
        />
      )}
    </div>
  );
}
