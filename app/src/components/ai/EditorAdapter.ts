export type EditorType =
  | "excalidraw"
  | "markdown"
  | "tldraw"
  | "drawio"
  | "kanban"
  | "spreadsheet"
  | "grid"
  | "code";

export interface EditorAdapter {
  type: EditorType;
  getContext(): string;
  applyContent(content: string): void | Promise<void>;
}

export { createTldrawAdapter } from "./adapters/tldrawAdapter";
export { createExcalidrawAdapter } from "./adapters/excalidrawAdapter";
export { createMarkdownAdapter } from "./adapters/markdownAdapter";
export { mergeDrawioXml, createDrawioAdapter } from "./adapters/drawioAdapter";
export {
  type KanbanCard,
  type KanbanColumn,
  type KanbanSnapshot,
  createKanbanAdapter,
} from "./adapters/kanbanAdapter";
export { createSpreadsheetAdapter } from "./adapters/spreadsheetAdapter";
export {
  type GridTableSnapshot,
  createGridAdapter,
} from "./adapters/gridAdapter";
export { createCodeAdapter } from "./adapters/codeAdapter";
