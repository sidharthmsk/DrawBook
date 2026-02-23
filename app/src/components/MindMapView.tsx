import { useCallback, useState, useRef } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { FileNode } from "./mindmap/FileNode";
import { FolderNode } from "./mindmap/FolderNode";
import { MindMapContextMenu } from "./mindmap/MindMapContextMenu";
import { useAutoLayout } from "./mindmap/useAutoLayout";

type DocumentType =
  | "tldraw"
  | "excalidraw"
  | "drawio"
  | "markdown"
  | "pdf"
  | "spreadsheet"
  | "kanban";

interface DocumentItem {
  id: string;
  name: string;
  folderId: string | null;
  type: DocumentType;
  modifiedAt: string;
}

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

interface MindMapViewProps {
  docs: DocumentItem[];
  folders: Folder[];
  expandedFolders: Set<string>;
  onToggleFolder: (folderId: string) => void;
  onOpenDocument: (docId: string) => void;
  onCreateDocument: (folderId: string | null, type: DocumentType) => void;
  onCreateFolder: (parentId: string | null) => void;
  onRenameDocument: (docId: string) => void;
  onRenameFolder: (folderId: string) => void;
  onDeleteDocument: (docId: string) => void;
  onDeleteFolder: (folderId: string) => void;
}

const nodeTypes = {
  fileNode: FileNode,
  folderNode: FolderNode,
};

function MindMapViewInner({
  docs,
  folders,
  expandedFolders,
  onToggleFolder,
  onOpenDocument,
  onCreateDocument,
  onCreateFolder,
  onRenameDocument,
  onRenameFolder,
  onDeleteDocument,
  onDeleteFolder,
}: MindMapViewProps) {
  const { fitView } = useReactFlow();
  const { nodes, edges } = useAutoLayout(docs, folders, expandedFolders);

  const [contextMenu, setContextMenu] = useState<{
    position: { x: number; y: number };
    nodeType: "folder" | "file" | "root";
    nodeId: string;
  } | null>(null);

  const fitViewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedulefit = useCallback(() => {
    if (fitViewTimer.current) clearTimeout(fitViewTimer.current);
    fitViewTimer.current = setTimeout(
      () => fitView({ padding: 0.2, duration: 300 }),
      50,
    );
  }, [fitView]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type === "fileNode") {
        onOpenDocument(node.id);
      } else if (node.type === "folderNode") {
        const isRoot = (node.data as Record<string, unknown>).isRoot;
        if (!isRoot) {
          onToggleFolder(node.id);
          schedulefit();
        }
      }
    },
    [onOpenDocument, onToggleFolder, schedulefit],
  );

  const onNodeContextMenu: NodeMouseHandler = useCallback((event, node) => {
    event.preventDefault();
    const data = node.data as Record<string, unknown>;
    let nodeType: "folder" | "file" | "root";
    if (node.type === "fileNode") {
      nodeType = "file";
    } else if (data.isRoot) {
      nodeType = "root";
    } else {
      nodeType = "folder";
    }
    setContextMenu({
      position: {
        x: (event as unknown as MouseEvent).clientX,
        y: (event as unknown as MouseEvent).clientY,
      },
      nodeType,
      nodeId: node.id,
    });
  }, []);

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      setContextMenu({
        position: { x: event.clientX, y: event.clientY },
        nodeType: "root",
        nodeId: "__root__",
      });
    },
    [],
  );

  const handleContextClose = useCallback(() => setContextMenu(null), []);

  return (
    <div className="mindmap-view">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        fitView
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: false }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Controls showInteractive={false} />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--border-subtle)"
        />
      </ReactFlow>

      <button
        className="mindmap-fit-btn"
        onClick={() => fitView({ padding: 0.2, duration: 300 })}
        title="Fit to view"
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
          <path d="M2 5V3a1 1 0 011-1h2M11 2h2a1 1 0 011 1v2M14 11v2a1 1 0 01-1 1h-2M5 14H3a1 1 0 01-1-1v-2" />
        </svg>
      </button>

      <MindMapContextMenu
        position={contextMenu?.position ?? null}
        nodeType={contextMenu?.nodeType ?? null}
        nodeId={contextMenu?.nodeId ?? null}
        onCreateFile={(folderId, type) => onCreateDocument(folderId, type)}
        onCreateFolder={(parentId) => onCreateFolder(parentId)}
        onRename={(id, kind) => {
          if (kind === "doc") onRenameDocument(id);
          else onRenameFolder(id);
        }}
        onDelete={(id, kind) => {
          if (kind === "doc") onDeleteDocument(id);
          else onDeleteFolder(id);
        }}
        onOpen={(id) => onOpenDocument(id)}
        onClose={handleContextClose}
      />
    </div>
  );
}

export function MindMapView(props: MindMapViewProps) {
  return (
    <ReactFlowProvider>
      <MindMapViewInner {...props} />
    </ReactFlowProvider>
  );
}
