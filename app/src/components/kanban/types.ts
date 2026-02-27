export interface KanbanEditorProps {
  documentId: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export type CardPriority = "none" | "low" | "medium" | "high" | "urgent";

export const PRIORITY_CONFIG: Record<
  CardPriority,
  { label: string; color: string; icon: string }
> = {
  none: { label: "None", color: "transparent", icon: "" },
  low: { label: "Low", color: "#00b894", icon: "▽" },
  medium: { label: "Medium", color: "#fdcb6e", icon: "◇" },
  high: { label: "High", color: "#e17055", icon: "△" },
  urgent: { label: "Urgent", color: "#d63031", icon: "⬆" },
};

export interface KanbanCard {
  id: string;
  title: string;
  description: string;
  labels?: string[];
  dueDate?: string;
  priority?: CardPriority;
  checklist?: ChecklistItem[];
  comments?: Array<{ id: string; text: string; createdAt: string }>;
}

export const LABEL_COLORS = [
  "#e17055",
  "#00b894",
  "#0984e3",
  "#6c5ce7",
  "#fdcb6e",
  "#e84393",
  "#00cec9",
  "#d63031",
];

export function labelColor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++)
    hash = (hash * 31 + label.charCodeAt(i)) | 0;
  return LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length];
}

export interface KanbanColumn {
  id: string;
  title: string;
  cardIds: string[];
  wipLimit?: number;
}

export interface KanbanSnapshot {
  columns: KanbanColumn[];
  cards: KanbanCard[];
}

export const DEFAULT_SNAPSHOT: KanbanSnapshot = {
  columns: [
    { id: "col-todo", title: "To Do", cardIds: [] },
    { id: "col-progress", title: "In Progress", cardIds: [] },
    { id: "col-done", title: "Done", cardIds: [] },
  ],
  cards: [],
};
