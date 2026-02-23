import { useMemo } from "react";
import dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";

interface DocumentItem {
  id: string;
  name: string;
  folderId: string | null;
  type: string;
  modifiedAt: string;
}

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

const NODE_DIMENSIONS = {
  folder: { width: 180, height: 50 },
  file: { width: 160, height: 40 },
  root: { width: 200, height: 56 },
};

function getDescendantFolderIds(
  folderId: string,
  folders: Folder[],
): Set<string> {
  const ids = new Set<string>();
  const stack = [folderId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const f of folders) {
      if (f.parentId === current && !ids.has(f.id)) {
        ids.add(f.id);
        stack.push(f.id);
      }
    }
  }
  return ids;
}

export function useAutoLayout(
  docs: DocumentItem[],
  folders: Folder[],
  expandedFolders: Set<string>,
): { nodes: Node[]; edges: Edge[] } {
  return useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 60, edgesep: 20 });
    g.setDefaultEdgeLabel(() => ({}));

    const ROOT_ID = "__root__";

    g.setNode(ROOT_ID, {
      width: NODE_DIMENSIONS.root.width,
      height: NODE_DIMENSIONS.root.height,
    });

    const collapsedFolderIds = new Set<string>();
    for (const f of folders) {
      if (!expandedFolders.has(f.id)) {
        const descendants = getDescendantFolderIds(f.id, folders);
        for (const d of descendants) collapsedFolderIds.add(d);
        collapsedFolderIds.add(f.id);
      }
    }

    const visibleFolders = folders.filter((f) => {
      if (f.parentId === null) return true;
      let cur: string | null = f.parentId;
      while (cur) {
        if (!expandedFolders.has(cur)) return false;
        const parent = folders.find((p) => p.id === cur);
        cur = parent?.parentId ?? null;
      }
      return true;
    });

    const docCountByFolder = new Map<string, number>();
    for (const doc of docs) {
      const key = doc.folderId ?? ROOT_ID;
      docCountByFolder.set(key, (docCountByFolder.get(key) ?? 0) + 1);
    }

    for (const f of visibleFolders) {
      g.setNode(f.id, {
        width: NODE_DIMENSIONS.folder.width,
        height: NODE_DIMENSIONS.folder.height,
      });
      const parentId = f.parentId ?? ROOT_ID;
      g.setEdge(parentId, f.id);
    }

    const visibleFolderIds = new Set(visibleFolders.map((f) => f.id));

    const visibleDocs = docs.filter((doc) => {
      if (doc.folderId === null) return true;
      return (
        visibleFolderIds.has(doc.folderId) && expandedFolders.has(doc.folderId)
      );
    });

    for (const doc of visibleDocs) {
      g.setNode(doc.id, {
        width: NODE_DIMENSIONS.file.width,
        height: NODE_DIMENSIONS.file.height,
      });
      const parentId = doc.folderId ?? ROOT_ID;
      g.setEdge(parentId, doc.id);
    }

    dagre.layout(g);

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const rootNode = g.node(ROOT_ID);
    if (rootNode) {
      nodes.push({
        id: ROOT_ID,
        type: "folderNode",
        position: {
          x: rootNode.x - NODE_DIMENSIONS.root.width / 2,
          y: rootNode.y - NODE_DIMENSIONS.root.height / 2,
        },
        data: {
          folder: { id: ROOT_ID, name: "Home", parentId: null, createdAt: "" },
          isExpanded: true,
          isRoot: true,
          docCount: docCountByFolder.get(ROOT_ID) ?? 0,
        },
      });
    }

    for (const f of visibleFolders) {
      const nodeData = g.node(f.id);
      if (!nodeData) continue;
      nodes.push({
        id: f.id,
        type: "folderNode",
        position: {
          x: nodeData.x - NODE_DIMENSIONS.folder.width / 2,
          y: nodeData.y - NODE_DIMENSIONS.folder.height / 2,
        },
        data: {
          folder: f,
          isExpanded: expandedFolders.has(f.id),
          isRoot: false,
          docCount: docCountByFolder.get(f.id) ?? 0,
        },
      });
    }

    for (const doc of visibleDocs) {
      const nodeData = g.node(doc.id);
      if (!nodeData) continue;
      nodes.push({
        id: doc.id,
        type: "fileNode",
        position: {
          x: nodeData.x - NODE_DIMENSIONS.file.width / 2,
          y: nodeData.y - NODE_DIMENSIONS.file.height / 2,
        },
        data: { document: doc },
      });
    }

    const edgeEntries = g.edges();
    for (const e of edgeEntries) {
      edges.push({
        id: `${e.v}->${e.w}`,
        source: e.v,
        target: e.w,
        type: "smoothstep",
        style: { stroke: "var(--border-default)", strokeWidth: 1.5 },
        animated: false,
      });
    }

    return { nodes, edges };
  }, [docs, folders, expandedFolders]);
}
