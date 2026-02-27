import type { ReactNode } from "react";

export interface PaletteDoc {
  id: string;
  name: string;
  type: string;
  folderId: string | null;
}

export interface RecentDoc {
  id: string;
  name: string;
  type: string;
  timestamp: number;
}

export interface PaletteAction {
  id: string;
  label: string;
  icon: ReactNode;
  context: "dashboard" | "editor" | "both";
}

export interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
}

export type PaletteMode = "docs" | "actions" | "folders";

export interface ResultItem {
  kind: "doc" | "action" | "folder" | "recent" | "content";
  id: string;
  label: string;
  score: number;
  meta?: string;
  icon?: ReactNode;
  type?: string;
  folderId?: string | null;
  matchIndices?: number[];
}

export interface CommandPaletteProps {
  folders: FolderItem[];
  context: "dashboard" | "editor";
  currentDocId?: string;
  currentDocName?: string;
}

export interface FuzzyResult {
  match: boolean;
  score: number;
  indices: number[];
}
