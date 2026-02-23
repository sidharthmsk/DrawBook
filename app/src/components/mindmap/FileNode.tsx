import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

interface FileNodeData {
  document: {
    id: string;
    name: string;
    type: string;
  };
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

const TYPE_LABELS: Record<string, string> = {
  tldraw: "tldraw",
  excalidraw: "Excalidraw",
  drawio: "Draw.io",
  markdown: "Markdown",
  pdf: "PDF",
  spreadsheet: "Spreadsheet",
  kanban: "Kanban",
};

function FileNodeComponent({ data }: NodeProps) {
  const { document: doc } = data as unknown as FileNodeData;
  const color = TYPE_COLORS[doc.type] || "var(--accent)";

  return (
    <div className="mindmap-file-node" style={{ borderLeftColor: color }}>
      <Handle
        type="target"
        position={Position.Top}
        className="mindmap-handle"
      />
      <span className="mindmap-node__icon" style={{ color }}>
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
      </span>
      <span className="mindmap-node__label" title={doc.name}>
        {doc.name}
      </span>
      <span
        className="mindmap-node__type-dot"
        style={{ background: color }}
        title={TYPE_LABELS[doc.type] || doc.type}
      />
    </div>
  );
}

export const FileNode = memo(FileNodeComponent);
