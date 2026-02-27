export interface DocMeta {
  type?: string;
  createdAt?: string;
  tags?: string[];
  folderId?: string | null;
  name?: string;
}

interface EditorInfoBarProps {
  docMeta: DocMeta | null;
}

export function EditorInfoBar({ docMeta }: EditorInfoBarProps) {
  if (!docMeta) return null;

  return (
    <div className="editor-info-bar">
      <span>
        <strong>Type:</strong> {docMeta.type || "unknown"}
      </span>
      {docMeta.createdAt && (
        <span>
          <strong>Created:</strong>{" "}
          {new Date(docMeta.createdAt).toLocaleDateString()}
        </span>
      )}
      {docMeta.folderId && (
        <span>
          <strong>Folder:</strong> {docMeta.folderId}
        </span>
      )}
      {docMeta.tags && docMeta.tags.length > 0 && (
        <span>
          <strong>Tags:</strong> {docMeta.tags.join(", ")}
        </span>
      )}
    </div>
  );
}
