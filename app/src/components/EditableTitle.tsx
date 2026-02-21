import { useCallback, useEffect, useRef, useState } from "react";

interface EditableTitleProps {
  documentId: string;
}

export function EditableTitle({ documentId }: EditableTitleProps) {
  const [displayName, setDisplayName] = useState(documentId);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
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
        setDisplayName(trimmed);
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
          if (e.key === "Escape") setEditing(false);
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
