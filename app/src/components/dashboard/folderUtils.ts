import type { DocumentType, Folder, FolderNode } from "./types";

export function typeFromId(id: string): DocumentType {
  if (id.startsWith("excalidraw-")) return "excalidraw";
  if (id.startsWith("drawio-")) return "drawio";
  if (id.startsWith("markdown-")) return "markdown";
  if (id.startsWith("pdf-")) return "pdf";
  if (id.startsWith("spreadsheet-")) return "spreadsheet";
  if (id.startsWith("kanban-")) return "kanban";
  if (id.startsWith("code-")) return "code";
  if (id.startsWith("grid-")) return "grid";
  return "tldraw";
}

export function buildFolderTree(folders: Folder[]): FolderNode[] {
  const byParent = new Map<string | null, Folder[]>();
  for (const f of folders) {
    const key = f.parentId ?? "__root__";
    const list = byParent.get(key) || [];
    list.push(f);
    byParent.set(key, list);
  }
  const build = (parentId: string | null, depth: number): FolderNode[] => {
    const key = parentId ?? "__root__";
    return (byParent.get(key) || []).map((f) => ({
      folder: f,
      children: build(f.id, depth + 1),
      depth,
    }));
  };
  return build(null, 0);
}

export function flattenTree(nodes: FolderNode[]): FolderNode[] {
  const out: FolderNode[] = [];
  for (const n of nodes) {
    out.push(n);
    out.push(...flattenTree(n.children));
  }
  return out;
}

export function collectDescendantIds(
  nodes: FolderNode[],
  targetId: string,
): Set<string> {
  const ids = new Set<string>();
  const collect = (children: FolderNode[]) => {
    for (const n of children) {
      ids.add(n.folder.id);
      collect(n.children);
    }
  };
  const find = (tree: FolderNode[]): FolderNode | undefined => {
    for (const n of tree) {
      if (n.folder.id === targetId) return n;
      const found = find(n.children);
      if (found) return found;
    }
  };
  const node = find(nodes);
  if (node) collect(node.children);
  return ids;
}
