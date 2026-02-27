import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type {
  PaletteAction,
  PaletteDoc,
  PaletteMode,
  ResultItem,
} from "./command-palette/types";
import { pushRecentDoc, getRecentDocs } from "./command-palette/recentDocs";
import { fuzzyMatch, HighlightedText } from "./command-palette/fuzzySearch";
import {
  buildActions,
  TYPE_COLORS,
  IconSearch,
  IconChevronRight,
  IconFolder,
} from "./command-palette/icons";
import type { CommandPaletteProps } from "./command-palette/types";

export { pushRecentDoc };

export function openCommandPalette(mode: PaletteMode = "docs") {
  document.dispatchEvent(
    new CustomEvent("command-palette-open", { detail: { mode } }),
  );
}

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

  const actions: PaletteAction[] = useMemo(
    () => buildActions(context),
    [context],
  );

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
