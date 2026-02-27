import { useState, type ReactNode } from "react";
import { EditableTitle } from "./EditableTitle";
import { AiChatPanel } from "./ai/AiChatPanel";
import type { EditorAdapter } from "./ai/EditorAdapter";

interface EditorShellProps {
  documentId: string;
  adapter: EditorAdapter | null;
  saveStatus: "saved" | "saving" | "error" | "syncing";
  children: ReactNode;
  contentClassName?: string;
}

export function EditorShell({
  documentId,
  adapter,
  saveStatus,
  children,
  contentClassName,
}: EditorShellProps) {
  const [aiOpen, setAiOpen] = useState(false);

  const statusLabel =
    saveStatus === "saved"
      ? "Saved"
      : saveStatus === "saving"
        ? "Saving..."
        : saveStatus === "syncing"
          ? "Syncing..."
          : "Error";
  const dotClass =
    saveStatus === "error"
      ? "error"
      : saveStatus === "saved"
        ? "saved"
        : "saving";

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
        <EditableTitle documentId={documentId} />
        <div className="editor-topbar__right">
          <div className="editor-topbar__status">
            <span
              className={`editor-status-dot editor-status-dot--${dotClass}`}
            />
            <span>{statusLabel}</span>
          </div>
          <button
            className={`ai-toggle-btn${aiOpen ? " ai-toggle-btn--active" : ""}`}
            onClick={() => setAiOpen((v) => !v)}
            title="Toggle AI Assistant"
          >
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
              <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
              <path d="M18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
            </svg>
            <span>AI</span>
          </button>
        </div>
      </div>
      <div className="editor-content">
        <div className={contentClassName || "editor-canvas"}>{children}</div>
        {aiOpen && adapter && (
          <AiChatPanel adapter={adapter} onClose={() => setAiOpen(false)} />
        )}
      </div>
    </div>
  );
}
