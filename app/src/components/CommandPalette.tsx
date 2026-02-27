import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

// ── Types ──

interface PaletteDoc {
  id: string;
  name: string;
  type: string;
  folderId: string | null;
}

interface RecentDoc {
  id: string;
  name: string;
  type: string;
  timestamp: number;
}

interface PaletteAction {
  id: string;
  label: string;
  icon: ReactNode;
  context: "dashboard" | "editor" | "both";
}

interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
}

type PaletteMode = "docs" | "actions" | "folders";

interface ResultItem {
  kind: "doc" | "action" | "folder" | "recent" | "content";
  id: string;
  label: string;
  score: number;
  meta?: string;
  icon?: ReactNode;
  type?: string;
  folderId?: string | null;
  matchIndices?: number[];
}

interface CommandPaletteProps {
  folders: FolderItem[];
  context: "dashboard" | "editor";
  currentDocId?: string;
  currentDocName?: string;
}

// ── Recent docs helpers ──

const RECENT_KEY = "drawbook_recent_docs";
const MAX_RECENT = 20;

export function pushRecentDoc(doc: { id: string; name: string; type: string }) {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list: RecentDoc[] = raw ? JSON.parse(raw) : [];
    const entry: RecentDoc = { ...doc, timestamp: Date.now() };
    const updated = [entry, ...list.filter((d) => d.id !== doc.id)].slice(
      0,
      MAX_RECENT,
    );
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    /* ignore */
  }
}

function getRecentDocs(): RecentDoc[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ── Fuzzy matching ──

interface FuzzyResult {
  match: boolean;
  score: number;
  indices: number[];
}

function fuzzyMatch(query: string, target: string): FuzzyResult {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  const noMatch: FuzzyResult = { match: false, score: -1, indices: [] };

  if (!q) return { match: true, score: 0, indices: [] };

  const subIdx = t.indexOf(q);
  if (subIdx !== -1) {
    const indices = Array.from({ length: q.length }, (_, i) => subIdx + i);
    if (subIdx === 0) return { match: true, score: 100, indices };
    return { match: true, score: 80, indices };
  }

  let qi = 0;
  const indices: number[] = [];
  let gaps = 0;
  let lastMatchIdx = -1;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (lastMatchIdx >= 0 && ti - lastMatchIdx > 1) {
        gaps += ti - lastMatchIdx - 1;
      }
      indices.push(ti);
      lastMatchIdx = ti;
      qi++;
    }
  }

  if (qi < q.length) return noMatch;

  const score = Math.max(10, 60 - gaps * 3);
  return { match: true, score, indices };
}

// ── Highlight helper ──

function HighlightedText({
  text,
  indices,
}: {
  text: string;
  indices: number[];
}) {
  if (!indices.length) return <>{text}</>;

  const set = new Set(indices);
  const parts: ReactNode[] = [];
  let buf = "";
  let inMatch = false;

  for (let i = 0; i < text.length; i++) {
    const isMatch = set.has(i);
    if (isMatch !== inMatch) {
      if (buf) {
        parts.push(
          inMatch ? (
            <span key={i} className="command-palette__match-hl">
              {buf}
            </span>
          ) : (
            buf
          ),
        );
      }
      buf = "";
      inMatch = isMatch;
    }
    buf += text[i];
  }
  if (buf) {
    parts.push(
      inMatch ? (
        <span key="end" className="command-palette__match-hl">
          {buf}
        </span>
      ) : (
        buf
      ),
    );
  }
  return <>{parts}</>;
}

// ── Icons ──

const TYPE_COLORS: Record<string, string> = {
  tldraw: "var(--accent)",
  excalidraw: "var(--type-excalidraw, #6c5ce7)",
  drawio: "var(--type-drawio, #f39c12)",
  markdown: "var(--type-markdown, #00b894)",
  spreadsheet: "var(--type-spreadsheet, #0984e3)",
  kanban: "var(--type-kanban, #e17055)",
  pdf: "var(--type-pdf, #d63031)",
  code: "var(--type-code, #636e72)",
  grid: "var(--type-grid, #00cec9)",
};

const IconSearch = (
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
);

const IconChevronRight = (
  <svg
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

const IconFolder = (
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
    <path d="M2 4v8a1 1 0 001 1h10a1 1 0 001-1V6a1 1 0 00-1-1H8L6.5 3.5A1 1 0 005.8 3H3a1 1 0 00-1 1z" />
  </svg>
);

const IconPlus = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
  >
    <path d="M8 3v10M3 8h10" />
  </svg>
);

const IconTrash = (
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
    <path d="M3 5h10M5 5V4a1 1 0 011-1h4a1 1 0 011 1v1M6 7v5M10 7v5M4 5l.7 8a1 1 0 001 .9h4.6a1 1 0 001-.9L12 5" />
  </svg>
);

const IconSettings = (
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
    <circle cx="8" cy="8" r="2" />
    <path d="M13.5 8a5.5 5.5 0 01-.3 1.8l1.3 1-1.2 2-1.5-.6a5.5 5.5 0 01-1.6.9L10 14.6H7.8l-.2-1.5a5.5 5.5 0 01-1.6-.9l-1.5.6-1.2-2 1.3-1A5.5 5.5 0 014.3 8c0-.6.1-1.2.3-1.8l-1.3-1 1.2-2 1.5.6a5.5 5.5 0 011.6-.9L7.8 1.4H10l.2 1.5a5.5 5.5 0 011.6.9l1.5-.6 1.2 2-1.3 1c.2.6.3 1.2.3 1.8z" />
  </svg>
);

const IconBack = (
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
    <path d="M10 12L6 8l4-4" />
  </svg>
);

const IconDelete = (
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
    <path d="M3 5h10M5 5V4a1 1 0 011-1h4a1 1 0 011 1v1M6 7v5M10 7v5M4 5l.7 8a1 1 0 001 .9h4.6a1 1 0 001-.9L12 5" />
  </svg>
);

const IconMove = (
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
    <path d="M2 4v8a1 1 0 001 1h10a1 1 0 001-1V6a1 1 0 00-1-1H8L6.5 3.5A1 1 0 005.8 3H3a1 1 0 00-1 1z" />
    <path d="M8 7v4M6 9l2-2 2 2" />
  </svg>
);

const IconTemplate = (
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
);

const IconAi = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
  </svg>
);

const IconInfo = (
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
);

const IconHistory = (
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
);

// ── Actions registry ──

const DOC_TYPES: Array<{ type: string; label: string }> = [
  { type: "excalidraw", label: "New Excalidraw" },
  { type: "drawio", label: "New Draw.io" },
  { type: "markdown", label: "New Markdown" },
  { type: "spreadsheet", label: "New Spreadsheet" },
  { type: "kanban", label: "New Kanban" },
  { type: "code", label: "New Code" },
  { type: "grid", label: "New Data Grid" },
];

function buildActions(context: "dashboard" | "editor"): PaletteAction[] {
  const all: PaletteAction[] = [
    ...DOC_TYPES.map((dt) => ({
      id: `new:${dt.type}`,
      label: dt.label,
      icon: IconPlus,
      context: "both" as const,
    })),
    {
      id: "settings",
      label: "Open Settings",
      icon: IconSettings,
      context: "dashboard",
    },
    { id: "trash", label: "Open Trash", icon: IconTrash, context: "dashboard" },
    {
      id: "back",
      label: "Back to Dashboard",
      icon: IconBack,
      context: "editor",
    },
    {
      id: "delete",
      label: "Delete Document",
      icon: IconDelete,
      context: "editor",
    },
    { id: "move", label: "Move to Folder", icon: IconMove, context: "editor" },
    {
      id: "template",
      label: "Save as Template",
      icon: IconTemplate,
      context: "editor",
    },
    {
      id: "toggleAi",
      label: "Toggle AI Panel",
      icon: IconAi,
      context: "editor",
    },
    { id: "info", label: "Document Info", icon: IconInfo, context: "editor" },
    {
      id: "history",
      label: "Version History",
      icon: IconHistory,
      context: "editor",
    },
  ];

  return all.filter((a) => a.context === context || a.context === "both");
}

export function openCommandPalette(mode: PaletteMode = "docs") {
  document.dispatchEvent(
    new CustomEvent("command-palette-open", { detail: { mode } }),
  );
}

// ── Component ──

export function CommandPalette({
  folders,
  context,
  currentDocId,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [docs, setDocs] = useState<PaletteDoc[]>([]);
  const [contentResults, setContentResults] = useState<PaletteDoc[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const contentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const mode: PaletteMode = query.startsWith(">")
    ? "actions"
    : query.startsWith("/")
      ? "folders"
      : "docs";

  const modeQuery = mode === "docs" ? query : query.slice(1);

  const [initialMode, setInitialMode] = useState<PaletteMode | null>(null);

  // Cmd+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // External open event (for mobile buttons, etc.)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const requestedMode: PaletteMode = detail?.mode || "docs";
      setInitialMode(requestedMode);
      setOpen(true);
    };
    document.addEventListener("command-palette-open", handler);
    return () => document.removeEventListener("command-palette-open", handler);
  }, []);

  // On open: fetch docs, reset state
  useEffect(() => {
    if (!open) return;
    const prefix =
      initialMode === "actions" ? ">" : initialMode === "folders" ? "/" : "";
    setQuery(prefix);
    setSelectedIndex(0);
    setContentResults([]);
    setInitialMode(null);
    fetch("/api/documents")
      .then((r) => r.json())
      .then((data) => setDocs(data.documents || []))
      .catch(() => {});
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Content search fallback (debounced)
  useEffect(() => {
    if (contentTimerRef.current) clearTimeout(contentTimerRef.current);
    if (mode !== "docs" || modeQuery.trim().length < 2) {
      setContentResults([]);
      return;
    }
    contentTimerRef.current = setTimeout(() => {
      fetch(`/api/search/content?q=${encodeURIComponent(modeQuery.trim())}`)
        .then((r) => r.json())
        .then((data) => setContentResults(data.results || []))
        .catch(() => setContentResults([]));
    }, 300);
    return () => {
      if (contentTimerRef.current) clearTimeout(contentTimerRef.current);
    };
  }, [mode, modeQuery]);

  const getFolderPath = useCallback(
    (folderId: string | null): string => {
      if (!folderId) return "";
      const parts: string[] = [];
      let cur: string | null = folderId;
      while (cur) {
        const f = folders.find((fo) => fo.id === cur);
        if (!f) break;
        parts.unshift(f.name);
        cur = f.parentId;
      }
      return parts.join(" / ");
    },
    [folders],
  );

  const actions = useMemo(() => buildActions(context), [context]);

  // Build results list
  const results: ResultItem[] = useMemo(() => {
    const nonNull = (arr: (ResultItem | null)[]): ResultItem[] =>
      arr.filter((x): x is ResultItem => x !== null);

    if (mode === "actions") {
      const q = modeQuery.trim();
      return nonNull(
        actions.map((a): ResultItem | null => {
          const fm = fuzzyMatch(q, a.label);
          if (!fm.match) return null;
          return {
            kind: "action",
            id: a.id,
            label: a.label,
            score: fm.score,
            icon: a.icon,
            matchIndices: fm.indices,
          };
        }),
      ).sort((a, b) => b.score - a.score);
    }

    if (mode === "folders") {
      const q = modeQuery.trim();
      return nonNull(
        folders.map((f): ResultItem | null => {
          const fm = fuzzyMatch(q, f.name);
          if (!fm.match) return null;
          const parentPath = getFolderPath(f.parentId);
          return {
            kind: "folder",
            id: f.id,
            label: f.name,
            score: fm.score,
            meta: parentPath || undefined,
            icon: IconFolder,
            matchIndices: fm.indices,
          };
        }),
      ).sort((a, b) => b.score - a.score);
    }

    // Document search mode
    const q = modeQuery.trim();
    const recents = getRecentDocs();
    const now = Date.now();

    if (!q) {
      const recentItems = nonNull(
        recents.map((r): ResultItem | null => {
          const doc = docs.find((d) => d.id === r.id);
          if (!doc) return null;
          return {
            kind: "recent",
            id: doc.id,
            label: doc.name,
            score: 0,
            type: doc.type,
            folderId: doc.folderId,
            meta: getFolderPath(doc.folderId) || undefined,
            matchIndices: [],
          };
        }),
      ).slice(0, 10);

      if (recentItems.length > 0) return recentItems;

      return docs.slice(0, 20).map(
        (d): ResultItem => ({
          kind: "doc",
          id: d.id,
          label: d.name,
          score: 0,
          type: d.type,
          folderId: d.folderId,
          meta: getFolderPath(d.folderId) || undefined,
          matchIndices: [],
        }),
      );
    }

    // Fuzzy search with recency bonus
    const recentMap = new Map(recents.map((r) => [r.id, r.timestamp]));
    const nameResults = nonNull(
      docs.map((d): ResultItem | null => {
        const fm = fuzzyMatch(q, d.name);
        if (!fm.match) return null;
        let bonus = 0;
        const ts = recentMap.get(d.id);
        if (ts) {
          const age = now - ts;
          if (age < 3600_000) bonus = 20;
          else if (age < 86400_000) bonus = 10;
        }
        return {
          kind: "doc",
          id: d.id,
          label: d.name,
          score: fm.score + bonus,
          type: d.type,
          folderId: d.folderId,
          meta: getFolderPath(d.folderId) || undefined,
          matchIndices: fm.indices,
        };
      }),
    ).sort((a, b) => b.score - a.score);

    // Append content search results if name matches are sparse
    const nameIds = new Set(nameResults.map((r) => r.id));
    if (nameResults.length < 3 && contentResults.length > 0) {
      const contentItems: ResultItem[] = contentResults
        .filter((c) => !nameIds.has(c.id))
        .slice(0, 5)
        .map(
          (c): ResultItem => ({
            kind: "content",
            id: c.id,
            label: c.name,
            score: 0,
            type: c.type,
            folderId: c.folderId,
            meta: "content match",
            matchIndices: [],
          }),
        );
      return [...nameResults, ...contentItems];
    }

    return nameResults;
  }, [mode, modeQuery, docs, folders, actions, contentResults, getFolderPath]);

  // Reset selection on results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (!resultsRef.current) return;
    const selected = resultsRef.current.children[selectedIndex] as HTMLElement;
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const executeItem = useCallback(
    (item: ResultItem) => {
      setOpen(false);

      if (
        item.kind === "doc" ||
        item.kind === "recent" ||
        item.kind === "content"
      ) {
        pushRecentDoc({
          id: item.id,
          name: item.label,
          type: item.type || "markdown",
        });
        window.location.href = `/?doc=${item.id}&type=${item.type}`;
        return;
      }

      if (item.kind === "folder") {
        window.location.href = `/?folder=${item.id}`;
        return;
      }

      if (item.kind === "action") {
        const actionId = item.id;

        // Dashboard: create new document
        if (actionId.startsWith("new:")) {
          const type = actionId.slice(4);
          const prefix = type === "tldraw" ? "drawing" : type;
          const docId = `${prefix}-${Date.now()}`;
          window.location.href = `/?doc=${docId}&type=${type}`;
          return;
        }

        // Dashboard: navigate to settings/trash
        if (actionId === "settings" || actionId === "trash") {
          document.dispatchEvent(
            new CustomEvent("command-palette-action", {
              detail: { action: actionId },
            }),
          );
          return;
        }

        // Editor: back to dashboard
        if (actionId === "back") {
          window.location.href = "/";
          return;
        }

        // Editor actions: dispatch event for EditorShell
        document.dispatchEvent(
          new CustomEvent("command-palette-action", {
            detail: { action: actionId, documentId: currentDocId },
          }),
        );
      }
    },
    [currentDocId],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      executeItem(results[selectedIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  if (!open) return null;

  const placeholder =
    mode === "actions"
      ? "Run action..."
      : mode === "folders"
        ? "Go to folder..."
        : "Search documents...";

  const modeIcon =
    mode === "actions"
      ? IconChevronRight
      : mode === "folders"
        ? IconFolder
        : IconSearch;

  const sectionLabel =
    mode === "docs" && !modeQuery.trim()
      ? results.length > 0 && results[0].kind === "recent"
        ? "Recent"
        : "All Documents"
      : null;

  const hasContentSection =
    mode === "docs" && results.some((r) => r.kind === "content");
  const firstContentIdx = hasContentSection
    ? results.findIndex((r) => r.kind === "content")
    : -1;

  return (
    <div className="command-palette-overlay" onClick={() => setOpen(false)}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette__input-row">
          <button
            className="command-palette__mode-pill"
            onClick={() => {
              const next: PaletteMode =
                mode === "docs"
                  ? "actions"
                  : mode === "actions"
                    ? "folders"
                    : "docs";
              setQuery(
                next === "actions" ? ">" : next === "folders" ? "/" : "",
              );
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            title={`Mode: ${mode} (click to switch)`}
          >
            {modeIcon}
          </button>
          <input
            ref={inputRef}
            className="command-palette__input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
          />
        </div>
        <div className="command-palette__results" ref={resultsRef}>
          {results.length === 0 && (
            <div className="command-palette__empty">
              {mode === "actions"
                ? "No matching actions"
                : mode === "folders"
                  ? "No matching folders"
                  : "No documents found"}
            </div>
          )}
          {sectionLabel && results.length > 0 && (
            <div className="command-palette__section-label">{sectionLabel}</div>
          )}
          {results.slice(0, 12).map((item, i) => (
            <div key={`${item.kind}-${item.id}`}>
              {i === firstContentIdx && (
                <div className="command-palette__section-label">
                  Content matches
                </div>
              )}
              <button
                className={`command-palette__item${i === selectedIndex ? " command-palette__item--selected" : ""}`}
                onClick={() => executeItem(item)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                {item.kind === "action" || item.kind === "folder" ? (
                  <span className="command-palette__action-icon">
                    {item.icon}
                  </span>
                ) : (
                  <span
                    className="command-palette__type-dot"
                    style={{
                      background:
                        TYPE_COLORS[item.type || ""] || "var(--text-secondary)",
                    }}
                  />
                )}
                <span className="command-palette__name">
                  <HighlightedText
                    text={item.label}
                    indices={item.matchIndices || []}
                  />
                </span>
                {item.meta && (
                  <span className="command-palette__path">{item.meta}</span>
                )}
                {(item.kind === "doc" ||
                  item.kind === "recent" ||
                  item.kind === "content") &&
                  item.type && (
                    <span className="command-palette__type-badge">
                      {item.type}
                    </span>
                  )}
                {item.kind === "content" && (
                  <span className="command-palette__content-badge">
                    content
                  </span>
                )}
              </button>
            </div>
          ))}
        </div>
        <div className="command-palette__footer">
          <kbd>↑↓</kbd> navigate <kbd>↵</kbd> open <kbd>esc</kbd> close{" "}
          <span className="command-palette__footer-sep" />
          <button
            className={`command-palette__mode-btn${mode === "actions" ? " command-palette__mode-btn--active" : ""}`}
            onClick={() => {
              setQuery(mode === "actions" ? "" : ">");
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
          >
            <kbd>&gt;</kbd> Actions
          </button>
          <button
            className={`command-palette__mode-btn${mode === "folders" ? " command-palette__mode-btn--active" : ""}`}
            onClick={() => {
              setQuery(mode === "folders" ? "" : "/");
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
          >
            <kbd>/</kbd> Folders
          </button>
        </div>
      </div>
    </div>
  );
}
