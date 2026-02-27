import { useState, useCallback } from "react";
import { useEditor, useValue } from "tldraw";
import { makeReal } from "./makeReal";

export function MakeRealButton() {
  const editor = useEditor();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasSelection = useValue(
    "hasSelection",
    () => editor.getSelectedShapeIds().length > 0,
    [editor],
  );

  const handleClick = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      await makeReal(editor);
    } catch (e: any) {
      const msg = e?.message || "Something went wrong";
      setError(msg);
      setTimeout(() => setError(null), 4000);
    } finally {
      setLoading(false);
    }
  }, [editor, loading]);

  if (!hasSelection && !loading && !error) return null;

  return (
    <div className="make-real-container">
      {error && (
        <div className="make-real-error">
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
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span>{error}</span>
        </div>
      )}
      <button
        className={`make-real-btn ${loading ? "make-real-btn--loading" : ""}`}
        onClick={handleClick}
        disabled={loading || !hasSelection}
        title="Generate a working prototype from your selection"
      >
        {loading ? (
          <>
            <span className="make-real-btn__spinner" />
            <span>Generating...</span>
          </>
        ) : (
          <>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span>Make Real</span>
          </>
        )}
      </button>
    </div>
  );
}
