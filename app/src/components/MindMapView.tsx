import { useCallback, useState, useRef, useEffect } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useReactFlow,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  type NodeMouseHandler,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { FileNode } from "./mindmap/FileNode";
import { FolderNode } from "./mindmap/FolderNode";
import { MindMapContextMenu } from "./mindmap/MindMapContextMenu";
import { useAutoLayout, getDescendantFolderIds } from "./mindmap/useAutoLayout";

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
  onMoveDocument: (docId: string, targetFolderId: string | null) => void;
  onMoveFolder: (folderId: string, targetParentId: string | null) => void;
}

const nodeTypes = {
  fileNode: FileNode,
  folderNode: FolderNode,
};

const ROOT_ID = "__root__";
const HIT_DISTANCE = 130;

function findNearestFolderNode(
  draggedNode: Node,
  allNodes: Node[],
  draggedNodeId: string,
): string | null {
  const dx = draggedNode.position.x + (draggedNode.measured?.width ?? 160) / 2;
  const dy = draggedNode.position.y + (draggedNode.measured?.height ?? 40) / 2;

  let closest: string | null = null;
  let closestDist = Infinity;

  for (const n of allNodes) {
    if (n.id === draggedNodeId) continue;
    if (n.type !== "folderNode") continue;

    const nw = n.measured?.width ?? 180;
    const nh = n.measured?.height ?? 50;
    const ncx = n.position.x + nw / 2;
    const ncy = n.position.y + nh / 2;

    const dist = Math.hypot(dx - ncx, dy - ncy);
    if (dist < closestDist) {
      closestDist = dist;
      closest = n.id;
    }
  }

  return closestDist <= HIT_DISTANCE ? closest : null;
}

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
  onMoveDocument,
  onMoveFolder,
}: MindMapViewProps) {
  const { fitView } = useReactFlow();

  const layoutResult = useAutoLayout(docs, folders, expandedFolders);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutResult.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutResult.edges);

  useEffect(() => {
    setNodes(layoutResult.nodes);
    setEdges(layoutResult.edges);
  }, [layoutResult, setNodes, setEdges]);

  const dragRef = useRef<{
    draggedNodeId: string;
    dropTargetId: string | null;
    isInvalidDrop: boolean;
  } | null>(null);
  const dragStarted = useRef(false);

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
      if (dragStarted.current) return;
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

  const applyDragHighlights = useCallback(
    (
      draggedNodeId: string,
      dropTargetId: string | null,
      isInvalidDrop: boolean,
    ) => {
      setNodes((nds) =>
        nds.map((n) => {
          const data = n.data as Record<string, unknown>;
          const isDraggedNode = n.id === draggedNodeId;
          const isDropTarget =
            n.id === dropTargetId && n.type === "folderNode" && !isInvalidDrop;
          const isInvalidTarget =
            n.id === dropTargetId && n.type === "folderNode" && isInvalidDrop;

          if (
            data.isDragging === isDraggedNode &&
            data.isDragTarget === isDropTarget &&
            data.isInvalidTarget === isInvalidTarget
          ) {
            return n;
          }

          return {
            ...n,
            data: {
              ...data,
              isDragging: isDraggedNode,
              isDragTarget: isDropTarget,
              isInvalidTarget: isInvalidTarget,
            },
          };
        }),
      );
    },
    [setNodes],
  );

  const clearDragHighlights = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) => {
        const data = n.data as Record<string, unknown>;
        if (!data.isDragging && !data.isDragTarget && !data.isInvalidTarget) {
          return n;
        }
        return {
          ...n,
          data: {
            ...data,
            isDragging: false,
            isDragTarget: false,
            isInvalidTarget: false,
          },
        };
      }),
    );
  }, [setNodes]);

  const handleNodeDragStart: NodeMouseHandler = useCallback(
    (_event, node) => {
      if ((node.data as Record<string, unknown>).isRoot) return;

      dragStarted.current = true;
      dragRef.current = {
        draggedNodeId: node.id,
        dropTargetId: null,
        isInvalidDrop: false,
      };

      applyDragHighlights(node.id, null, false);
    },
    [applyDragHighlights],
  );

  const handleNodeDrag: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (!dragRef.current) return;

      const currentNodes = nodes;
      const targetId = findNearestFolderNode(
        node,
        currentNodes,
        dragRef.current.draggedNodeId,
      );

      let isInvalid = false;
      if (targetId) {
        const draggedIsFolder = folders.some(
          (f) => f.id === dragRef.current!.draggedNodeId,
        );
        if (draggedIsFolder) {
          if (targetId === dragRef.current.draggedNodeId) {
            isInvalid = true;
          } else {
            const descendants = getDescendantFolderIds(
              dragRef.current.draggedNodeId,
              folders,
            );
            if (descendants.has(targetId)) {
              isInvalid = true;
            }
          }
          const draggedFolder = folders.find(
            (f) => f.id === dragRef.current!.draggedNodeId,
          );
          const currentParent = draggedFolder?.parentId ?? ROOT_ID;
          if (targetId === currentParent) {
            isInvalid = true;
          }
        } else {
          const draggedDoc = docs.find(
            (d) => d.id === dragRef.current!.draggedNodeId,
          );
          const currentParent = draggedDoc?.folderId ?? ROOT_ID;
          if (targetId === currentParent) {
            isInvalid = true;
          }
        }
      }

      if (
        targetId !== dragRef.current.dropTargetId ||
        isInvalid !== dragRef.current.isInvalidDrop
      ) {
        dragRef.current.dropTargetId = targetId;
        dragRef.current.isInvalidDrop = isInvalid;
        applyDragHighlights(dragRef.current.draggedNodeId, targetId, isInvalid);
      }
    },
    [nodes, folders, docs, applyDragHighlights],
  );

  const handleNodeDragStop: NodeMouseHandler = useCallback(
    (_event, _node) => {
      if (!dragRef.current) return;

      const { draggedNodeId, dropTargetId, isInvalidDrop } = dragRef.current;

      dragRef.current = null;
      clearDragHighlights();

      setTimeout(() => {
        dragStarted.current = false;
      }, 50);

      if (isInvalidDrop) return;

      const targetFolderId =
        dropTargetId === ROOT_ID ? null : (dropTargetId ?? null);

      const isFolder = folders.some((f) => f.id === draggedNodeId);
      if (isFolder) {
        const folder = folders.find((f) => f.id === draggedNodeId);
        const currentParent = folder?.parentId ?? null;
        if (targetFolderId === currentParent) return;
        onMoveFolder(draggedNodeId, targetFolderId);
      } else {
        const doc = docs.find((d) => d.id === draggedNodeId);
        const currentParent = doc?.folderId ?? null;
        if (targetFolderId === currentParent) return;
        onMoveDocument(draggedNodeId, targetFolderId);
      }

      schedulefit();
    },
    [
      folders,
      docs,
      onMoveDocument,
      onMoveFolder,
      schedulefit,
      clearDragHighlights,
    ],
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
        nodeId: ROOT_ID,
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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        fitView
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: false }}
        nodesConnectable={false}
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
