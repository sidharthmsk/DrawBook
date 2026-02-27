import { useState, useEffect, useRef, useCallback } from "react";
import {
  fetchAllDocs,
  clearAllDocsCache,
  type DocOption,
} from "./documentLinkUtils";

let _linkingEnabled = false;
export function setLinkingEnabled(enabled: boolean) {
  _linkingEnabled = enabled;
}
export function isLinkingEnabled() {
  return _linkingEnabled;
}

interface ResolvedDoc {
  id: string;
  name: string;
  type: string;
}

const resolveCache = new Map<string, ResolvedDoc | null>();

async function resolveDocName(name: string): Promise<ResolvedDoc | null> {
  if (resolveCache.has(name)) return resolveCache.get(name)!;
  try {
    const res = await fetch(`/api/resolve?name=${encodeURIComponent(name)}`);
    const data = await res.json();
    const doc = data.document || null;
    resolveCache.set(name, doc);
    return doc;
  } catch {
    return null;
  }
}

export function DocumentLink({ name }: { name: string }) {
  const [doc, setDoc] = useState<ResolvedDoc | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    resolveDocName(name).then((d) => {
      if (d) setDoc(d);
      else setNotFound(true);
    });
  }, [name]);

  if (notFound) {
    return (
      <span
        className="doc-link doc-link--broken"
        title={`Document not found: ${name}`}
      >
        [[{name}]]
      </span>
    );
  }

  if (!doc) {
    return <span className="doc-link doc-link--loading">[[{name}]]</span>;
  }

  return (
    <a
      className="doc-link"
      href={`/?doc=${doc.id}&type=${doc.type}`}
      title={`Open: ${doc.name}`}
      onClick={(e) => {
        e.preventDefault();
        window.location.href = `/?doc=${doc.id}&type=${doc.type}`;
      }}
    >
      {doc.name}
    </a>
  );
}

export function renderWithLinks(text: string): (string | JSX.Element)[] {
  const COMBINED_RE = /\[\[([^\]]+)\]\]|https?:\/\/[^\s)>\]]+/g;
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = COMBINED_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      if (_linkingEnabled) {
        parts.push(<DocumentLink key={match.index} name={match[1]} />);
      } else {
        parts.push(text.slice(match.index, match.index + match[0].length));
      }
    } else {
      const url = match[0];
      parts.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="doc-link doc-link--url"
        >
          {url}
        </a>,
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export type { DocOption };

export function invalidateDocCache() {
  clearAllDocsCache();
  resolveCache.clear();
}

// Inline auto-suggest for textareas: triggers when user types [[
export function useInlineLinkSuggest(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  onChange: (newValue: string) => void,
) {
  const [open, setOpen] = useState(false);
  const [triggerPos, setTriggerPos] = useState(-1);
  const [query, setQuery] = useState("");
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const checkTrigger = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const text = ta.value;

    // Look backwards from cursor for [[
    const before = text.slice(0, pos);
    const triggerIdx = before.lastIndexOf("[[");
    if (triggerIdx === -1 || before.indexOf("]]", triggerIdx) !== -1) {
      if (open) setOpen(false);
      return;
    }

    const partial = before.slice(triggerIdx + 2);
    if (partial.includes("\n")) {
      if (open) setOpen(false);
      return;
    }

    setTriggerPos(triggerIdx);
    setQuery(partial);
    setOpen(true);

    // Position dropdown near the textarea cursor
    const rect = ta.getBoundingClientRect();
    const lineHeight = parseInt(getComputedStyle(ta).lineHeight) || 20;
    const lines = text.slice(0, pos).split("\n");
    const lineNum = lines.length - 1;
    setDropdownPos({
      top: rect.top + (lineNum + 1) * lineHeight + 4,
      left: rect.left + 8,
    });
  }, [textareaRef, open]);

  const handleSelect = useCallback(
    (doc: DocOption) => {
      const ta = textareaRef.current;
      if (!ta || triggerPos === -1) return;
      const before = value.slice(0, triggerPos);
      const afterCursor = value.slice(ta.selectionStart);
      const newVal = `${before}[[${doc.name}]]${afterCursor}`;
      onChange(newVal);
      setOpen(false);
      setTimeout(() => {
        ta.focus();
        const newPos = triggerPos + doc.name.length + 4; // [[name]]
        ta.selectionStart = ta.selectionEnd = newPos;
      }, 0);
    },
    [textareaRef, triggerPos, value, onChange],
  );

  const handleClose = useCallback(() => setOpen(false), []);

  const suggestProps = {
    onKeyUp: checkTrigger,
    onClick: checkTrigger,
  };

  return { open, query, dropdownPos, handleSelect, handleClose, suggestProps };
}

export { InlineSuggestDropdown } from "./InlineSuggestDropdown";

export function DocumentPicker({
  onSelect,
  onClose,
  position,
}: {
  onSelect: (doc: DocOption) => void;
  onClose: () => void;
  position?: { top: number; left: number };
}) {
  const [docs, setDocs] = useState<DocOption[]>([]);
  const [filter, setFilter] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAllDocs().then(setDocs);
    inputRef.current?.focus();
  }, []);

  const filtered = docs.filter((d) =>
    d.name.toLowerCase().includes(filter.toLowerCase()),
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIdx]) {
          onSelect(filtered[selectedIdx]);
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [filtered, selectedIdx, onSelect, onClose],
  );

  return (
    <div
      className="doc-picker"
      style={
        position
          ? { position: "absolute", top: position.top, left: position.left }
          : {}
      }
    >
      <input
        ref={inputRef}
        className="doc-picker__input"
        value={filter}
        onChange={(e) => {
          setFilter(e.target.value);
          setSelectedIdx(0);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Search documents..."
      />
      <div className="doc-picker__list">
        {filtered.slice(0, 10).map((doc, i) => (
          <div
            key={doc.id}
            className={`doc-picker__item${i === selectedIdx ? " doc-picker__item--active" : ""}`}
            onClick={() => onSelect(doc)}
            onMouseEnter={() => setSelectedIdx(i)}
          >
            <span className="doc-picker__name">{doc.name}</span>
            <span className="doc-picker__type">{doc.type}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="doc-picker__empty">No documents found</div>
        )}
      </div>
    </div>
  );
}
