import { useCallback, useEffect, useRef, useState } from "react";

interface MarkdownEditorProps {
  documentId: string;
}

export function MarkdownEditor({ documentId }: MarkdownEditorProps) {
  const [content, setContent] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNew = useRef(false);

  useEffect(() => {
    fetch(`/api/load/${documentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.snapshot?.content !== undefined) {
          setContent(data.snapshot.content);
        } else {
          isNew.current = true;
          setContent("");
        }
      })
      .catch(() => {
        isNew.current = true;
        setContent("");
      });
  }, [documentId]);

  const saveToServer = useCallback(
    async (text: string) => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/save/${documentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            snapshot: { content: text },
            type: "markdown",
          }),
        });
        setSaveStatus(res.ok ? "saved" : "error");
      } catch {
        setSaveStatus("error");
      }
    },
    [documentId],
  );

  useEffect(() => {
    if (content === undefined) return;
    if (isNew.current) {
      isNew.current = false;
      saveToServer(content);
    }
  }, [content, saveToServer]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => saveToServer(val), 1500);
  };

  const renderMarkdown = (md: string) => {
    let html = md
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(/^\- (.+)$/gm, "<li>$1</li>")
      .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
      .replace(/\n{2,}/g, "</p><p>")
      .replace(/\n/g, "<br/>");

    html = `<p>${html}</p>`;
    html = html
      .replace(/<p><h([123])>/g, "<h$1>")
      .replace(/<\/h([123])><\/p>/g, "</h$1>");
    html = html
      .replace(/<p><li>/g, "<ul><li>")
      .replace(/<\/li><\/p>/g, "</li></ul>");

    return html;
  };

  if (content === undefined) {
    return (
      <div className="editor-loading">
        <div className="editor-loading__spinner" />
        Loading Markdown editor...
      </div>
    );
  }

  return (
    <div className="editor-wrapper">
      <div className="editor-topbar">
        <button
          className="editor-back-btn"
          onClick={() => (window.location.href = "/")}
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
            <path d="M10 12L6 8l4-4" />
          </svg>
          Back
        </button>
        <span className="editor-topbar__title">{documentId}</span>
        <div className="editor-topbar__actions">
          <button
            className={`editor-mode-btn ${!viewMode ? "active" : ""}`}
            onClick={() => setViewMode(false)}
          >
            Edit
          </button>
          <button
            className={`editor-mode-btn ${viewMode ? "active" : ""}`}
            onClick={() => setViewMode(true)}
          >
            Preview
          </button>
        </div>
        <div className="editor-topbar__status">
          <span
            className={`editor-status-dot editor-status-dot--${saveStatus === "error" ? "error" : saveStatus === "saved" ? "saved" : "saving"}`}
          />
          <span>
            {saveStatus === "saved"
              ? "Saved"
              : saveStatus === "saving"
                ? "Saving..."
                : "Error"}
          </span>
        </div>
      </div>
      <div className="markdown-container">
        {viewMode ? (
          <div
            className="markdown-preview"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        ) : (
          <textarea
            ref={textareaRef}
            className="markdown-textarea"
            value={content}
            onChange={handleChange}
            placeholder="Start writing in Markdown..."
            spellCheck
          />
        )}
      </div>
    </div>
  );
}
