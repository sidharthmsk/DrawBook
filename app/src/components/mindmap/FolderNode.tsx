import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

interface FolderNodeData {
  folder: {
    id: string;
    name: string;
    parentId: string | null;
  };
  isExpanded: boolean;
  isRoot: boolean;
  docCount: number;
  isDragging?: boolean;
  isDragTarget?: boolean;
  isInvalidTarget?: boolean;
  [key: string]: unknown;
}

function FolderNodeComponent({ data }: NodeProps) {
  const {
    folder,
    isExpanded,
    isRoot,
    docCount,
    isDragging,
    isDragTarget,
    isInvalidTarget,
  } = data as unknown as FolderNodeData;

  const className = [
    "mindmap-folder-node",
    isRoot && "mindmap-folder-node--root",
    isDragging && "mindmap-folder-node--dragging",
    isDragTarget && "mindmap-folder-node--drop-target",
    isInvalidTarget && "mindmap-folder-node--invalid-target",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <Handle
        type="target"
        position={Position.Top}
        className="mindmap-handle"
        style={{ visibility: isRoot ? "hidden" : "visible" }}
      />

      {isRoot ? (
        <svg
          className="mindmap-node__icon"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.5 6.5L8 2l5.5 4.5V13a1 1 0 01-1 1h-9a1 1 0 01-1-1V6.5z" />
          <path d="M6 14V9h4v5" />
        </svg>
      ) : (
        <svg
          className="mindmap-node__icon"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 4.5A1.5 1.5 0 013.5 3h2.382a1 1 0 01.894.553L7.5 5h5A1.5 1.5 0 0114 6.5v5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5v-7z" />
        </svg>
      )}

      <span className="mindmap-node__label" title={folder.name}>
        {folder.name}
      </span>

      {docCount > 0 && <span className="mindmap-node__badge">{docCount}</span>}

      {!isRoot && (
        <span
          className={`mindmap-node__chevron ${isExpanded ? "mindmap-node__chevron--open" : ""}`}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 4l4 4-4 4" />
          </svg>
        </span>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="mindmap-handle"
      />
    </div>
  );
}

export const FolderNode = memo(FolderNodeComponent);
