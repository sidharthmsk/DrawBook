export type DocumentType =
  | "tldraw"
  | "excalidraw"
  | "drawio"
  | "markdown"
  | "pdf"
  | "spreadsheet"
  | "kanban"
  | "code"
  | "grid";

export interface DocumentItem {
  id: string;
  name: string;
  folderId: string | null;
  type: DocumentType;
  modifiedAt: string;
  starred?: boolean;
  tags?: string[];
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export type RenameTarget = { id: string; kind: "doc" | "folder" } | null;

export interface FolderNode {
  folder: Folder;
  children: FolderNode[];
  depth: number;
}

export interface AppConfig {
  enableTldraw: boolean;
  enableLinking: boolean;
  isElectron?: boolean;
}
