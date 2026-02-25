export type ColumnType =
  | "text"
  | "longtext"
  | "number"
  | "select"
  | "multiselect"
  | "checkbox"
  | "date"
  | "url"
  | "rating";

export interface TableColumn {
  id: string;
  name: string;
  type: ColumnType;
  width?: number;
  options?: string[];
  ratingMax?: number;
}

export interface TableRow {
  id: string;
  cells: Record<string, CellValue>;
}

export type CellValue = string | number | boolean | string[] | null;

export interface FilterConfig {
  columnId: string;
  operator: "eq" | "neq" | "contains" | "gt" | "lt" | "empty" | "notEmpty";
  value: string;
}

export interface SortConfig {
  columnId: string;
  direction: "asc" | "desc";
}

export interface TableSnapshot {
  columns: TableColumn[];
  rows: TableRow[];
  sortConfig?: SortConfig | null;
  filterConfigs?: FilterConfig[];
}

export const COLUMN_TYPE_LABELS: Record<ColumnType, string> = {
  text: "Text",
  longtext: "Long Text",
  number: "Number",
  select: "Select",
  multiselect: "Multi-Select",
  checkbox: "Checkbox",
  date: "Date",
  url: "URL",
  rating: "Rating",
};

export const DEFAULT_TABLE: TableSnapshot = {
  columns: [
    { id: "col-name", name: "Name", type: "text" },
    {
      id: "col-status",
      name: "Status",
      type: "select",
      options: ["Todo", "In Progress", "Done"],
    },
    { id: "col-notes", name: "Notes", type: "text" },
  ],
  rows: [],
  sortConfig: null,
  filterConfigs: [],
};

export const OPTION_COLORS = [
  "#E07A5F",
  "#A78BFA",
  "#60A5FA",
  "#6EE7B7",
  "#F472B6",
  "#FCD34D",
  "#F87171",
  "#34D399",
  "#818CF8",
  "#FB923C",
];
