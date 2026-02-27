import { useCallback, useEffect, useRef, useState } from "react";

interface EditableTitleProps {
  documentId: string;
}

export function EditableTitle({ documentId }: EditableTitleProps) {
  const [displayName, setDisplayName] = useState(documentId);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const cancelled = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/meta/${documentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.name) setDisplayName(data.name);
      })
      .catch(() => {});
  }, [documentId]);

  const startEditing = useCallback(() => {
    cancelled.current = false;
    setEditValue(displayName);
    setEditing(true);
  }, [displayName]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const finishEditing = useCallback(async () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    setEditing(false);
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === displayName) return;

    try {
      const res = await fetch(`/api/rename/${documentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName: trimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        setDisplayName(trimmed);
        if (data.newDocumentId && data.newDocumentId !== documentId) {
          const params = new URLSearchParams(window.location.search);
          params.set("doc", data.newDocumentId);
          window.location.search = params.toString();
        }
      }
    } catch {
      // keep old name on failure
    }
  }, [editValue, displayName, documentId]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="editor-topbar__title-input"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={finishEditing}
        onKeyDown={(e) => {
          if (e.key === "Enter") finishEditing();
          if (e.key === "Escape") {
            cancelled.current = true;
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <span
      className="editor-topbar__title"
      onDoubleClick={startEditing}
      title="Double-click to rename"
    >
      {displayName}
    </span>
  );
}
