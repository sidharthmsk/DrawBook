import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

interface FileNodeData {
  document: {
    id: string;
    name: string;
    type: string;
  };
  isDragging?: boolean;
  [key: string]: unknown;
}

const TYPE_COLORS: Record<string, string> = {
  tldraw: "var(--accent)",
  excalidraw: "var(--type-excalidraw)",
  drawio: "var(--type-drawio)",
  markdown: "var(--type-markdown)",
  pdf: "var(--type-pdf)",
  spreadsheet: "var(--type-spreadsheet)",
  kanban: "var(--type-kanban)",
};

const TYPE_ICONS: Record<string, () => JSX.Element> = {
  tldraw: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 19l7-7 3 3-7 7-3-3z" />
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="M2 2l7.586 7.586" />
      <circle cx="11" cy="11" r="2" />
    </svg>
  ),
  excalidraw: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 4h16v16H4z" />
      <circle cx="9" cy="9" r="2" />
      <path d="M15 9h.01" />
      <path d="M9 15l2-2 4 4" />
    </svg>
  ),
  drawio: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="8" y="14" width="7" height="7" rx="1" />
      <path d="M7 10v4h4" />
      <path d="M17 10v7h-2" />
    </svg>
  ),
  markdown: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 5h18v14H3z" />
      <path d="M6 15V9l3 3.5L12 9v6" />
      <path d="M18 13l-2-2-2 2" />
      <path d="M16 15v-4" />
    </svg>
  ),
  pdf: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  ),
  spreadsheet: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  ),
  kanban: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="5" height="14" rx="1" />
      <rect x="10" y="3" width="5" height="10" rx="1" />
      <rect x="17" y="3" width="5" height="18" rx="1" />
    </svg>
  ),
};

function FileNodeComponent({ data }: NodeProps) {
  const { document: doc, isDragging } = data as unknown as FileNodeData;
  const color = TYPE_COLORS[doc.type] || "var(--accent)";
  const Icon = TYPE_ICONS[doc.type];

  const className = [
    "mindmap-file-node",
    isDragging && "mindmap-file-node--dragging",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} style={{ borderLeftColor: color }}>
      <Handle
        type="target"
        position={Position.Top}
        className="mindmap-handle"
      />
      <span className="mindmap-node__icon" style={{ color }}>
        {Icon ? (
          <Icon />
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5z" />
            <polyline points="9 1 9 5 13 5" />
          </svg>
        )}
      </span>
      <span className="mindmap-node__label" title={doc.name}>
        {doc.name}
      </span>
    </div>
  );
}

export const FileNode = memo(FileNodeComponent);
