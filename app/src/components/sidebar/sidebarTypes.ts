import type { RenameTarget } from "../dashboard/types";

export interface DocumentItem {
  id: string;
  name: string;
  folderId: string | null;
  modifiedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: string;
}

export type { RenameTarget };
