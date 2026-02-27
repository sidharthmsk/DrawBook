export function AiTemplateModal({
  aiTemplatePrompt,
  setAiTemplatePrompt,
  aiTemplateType,
  setAiTemplateType,
  aiTemplateLoading,
  onGenerate,
  onClose,
}: {
  aiTemplatePrompt: string;
  setAiTemplatePrompt: (v: string) => void;
  aiTemplateType: "markdown" | "kanban";
  setAiTemplateType: (v: "markdown" | "kanban") => void;
  aiTemplateLoading: boolean;
  onGenerate: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="quick-switcher-overlay"
      onClick={() => !aiTemplateLoading && onClose()}
    >
      <div
        className="kanban-detail"
        style={{ width: 440 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="kanban-detail__close" onClick={onClose}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
        <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>
          Create from AI Template
        </h3>
        <label className="kanban-detail__label">Document Type</label>
        <select
          className="sort-select"
          style={{ width: "100%", marginBottom: 12 }}
          value={aiTemplateType}
          onChange={(e) =>
            setAiTemplateType(e.target.value as "markdown" | "kanban")
          }
        >
          <option value="markdown">Markdown</option>
          <option value="kanban">Kanban Board</option>
        </select>
        <label className="kanban-detail__label">Describe what you want</label>
        <textarea
          className="kanban-detail__desc"
          value={aiTemplatePrompt}
          onChange={(e) => setAiTemplatePrompt(e.target.value)}
          placeholder="e.g. Create a meeting notes template with agenda, action items, and decisions..."
          rows={4}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onGenerate();
          }}
          autoFocus
        />
        <button
          style={{
            marginTop: 12,
            width: "100%",
            padding: "8px 16px",
            borderRadius: 8,
            background: "var(--accent)",
            color: "var(--text-on-accent)",
            border: "none",
            cursor: "pointer",
            opacity: aiTemplateLoading ? 0.6 : 1,
          }}
          onClick={onGenerate}
          disabled={aiTemplateLoading || !aiTemplatePrompt.trim()}
        >
          {aiTemplateLoading ? "Generating..." : "Generate & Create"}
        </button>
      </div>
    </div>
  );
}
