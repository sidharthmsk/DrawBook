interface EditorVersionBarProps {
  versions: Array<{ index: number; timestamp: string }>;
  documentId: string;
}

export function EditorVersionBar({
  versions,
  documentId,
}: EditorVersionBarProps) {
  return (
    <div className="editor-version-bar">
      <strong>Version History</strong>
      {versions.length === 0 ? (
        <span className="editor-version-bar__empty">
          No versions saved yet. Versions are created on each save.
        </span>
      ) : (
        <div className="editor-version-bar__list">
          {versions.map((v) => (
            <div key={v.index} className="editor-version-bar__item">
              <span>{new Date(v.timestamp).toLocaleString()}</span>
              <button
                className="editor-version-bar__restore"
                onClick={async () => {
                  try {
                    const res = await fetch(
                      `/api/versions/${documentId}/restore`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ index: v.index }),
                      },
                    );
                    if (res.ok) {
                      window.location.reload();
                    }
                  } catch (err) {
                    console.error("Restore failed:", err);
                  }
                }}
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
