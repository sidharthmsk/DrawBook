import type { PaletteAction } from "./types";

export const TYPE_COLORS: Record<string, string> = {
  tldraw: "var(--accent)",
  excalidraw: "var(--type-excalidraw, #6c5ce7)",
  drawio: "var(--type-drawio, #f39c12)",
  markdown: "var(--type-markdown, #00b894)",
  spreadsheet: "var(--type-spreadsheet, #0984e3)",
  kanban: "var(--type-kanban, #e17055)",
  pdf: "var(--type-pdf, #d63031)",
  code: "var(--type-code, #636e72)",
  grid: "var(--type-grid, #00cec9)",
};

export const DOC_TYPES: Array<{ type: string; label: string }> = [
  { type: "excalidraw", label: "New Excalidraw" },
  { type: "drawio", label: "New Draw.io" },
  { type: "markdown", label: "New Markdown" },
  { type: "spreadsheet", label: "New Spreadsheet" },
  { type: "kanban", label: "New Kanban" },
  { type: "code", label: "New Code" },
  { type: "grid", label: "New Data Grid" },
];

const IconSearch = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" />
  </svg>
);

const IconChevronRight = (
  <svg
    width="12"
    height="12"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 4l4 4-4 4" />
  </svg>
);

const IconFolder = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 4v8a1 1 0 001 1h10a1 1 0 001-1V6a1 1 0 00-1-1H8L6.5 3.5A1 1 0 005.8 3H3a1 1 0 00-1 1z" />
  </svg>
);

const IconPlus = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
  >
    <path d="M8 3v10M3 8h10" />
  </svg>
);

const IconTrash = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 5h10M5 5V4a1 1 0 011-1h4a1 1 0 011 1v1M6 7v5M10 7v5M4 5l.7 8a1 1 0 001 .9h4.6a1 1 0 001-.9L12 5" />
  </svg>
);

const IconSettings = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="8" cy="8" r="2" />
    <path d="M13.5 8a5.5 5.5 0 01-.3 1.8l1.3 1-1.2 2-1.5-.6a5.5 5.5 0 01-1.6.9L10 14.6H7.8l-.2-1.5a5.5 5.5 0 01-1.6-.9l-1.5.6-1.2-2 1.3-1A5.5 5.5 0 014.3 8c0-.6.1-1.2.3-1.8l-1.3-1 1.2-2 1.5.6a5.5 5.5 0 011.6-.9L7.8 1.4H10l.2 1.5a5.5 5.5 0 011.6.9l1.5-.6 1.2 2-1.3 1c.2.6.3 1.2.3 1.8z" />
  </svg>
);

const IconBack = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 12L6 8l4-4" />
  </svg>
);

const IconDelete = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 5h10M5 5V4a1 1 0 011-1h4a1 1 0 011 1v1M6 7v5M10 7v5M4 5l.7 8a1 1 0 001 .9h4.6a1 1 0 001-.9L12 5" />
  </svg>
);

const IconMove = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 4v8a1 1 0 001 1h10a1 1 0 001-1V6a1 1 0 00-1-1H8L6.5 3.5A1 1 0 005.8 3H3a1 1 0 00-1 1z" />
    <path d="M8 7v4M6 9l2-2 2 2" />
  </svg>
);

const IconTemplate = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="2" width="12" height="12" rx="1" />
    <path d="M5 2v5l2.5-1.5L10 7V2" />
  </svg>
);

const IconAi = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
  </svg>
);

const IconInfo = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="8" cy="8" r="6" />
    <path d="M8 7v4M8 5.5v0" />
  </svg>
);

const IconHistory = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="8" cy="8" r="6" />
    <path d="M8 5v3l2 2" />
  </svg>
);

export function buildActions(context: "dashboard" | "editor"): PaletteAction[] {
  const all: PaletteAction[] = [
    ...DOC_TYPES.map((dt) => ({
      id: `new:${dt.type}`,
      label: dt.label,
      icon: IconPlus,
      context: "both" as const,
    })),
    {
      id: "settings",
      label: "Open Settings",
      icon: IconSettings,
      context: "dashboard",
    },
    { id: "trash", label: "Open Trash", icon: IconTrash, context: "dashboard" },
    {
      id: "back",
      label: "Back to Dashboard",
      icon: IconBack,
      context: "editor",
    },
    {
      id: "delete",
      label: "Delete Document",
      icon: IconDelete,
      context: "editor",
    },
    { id: "move", label: "Move to Folder", icon: IconMove, context: "editor" },
    {
      id: "template",
      label: "Save as Template",
      icon: IconTemplate,
      context: "editor",
    },
    {
      id: "toggleAi",
      label: "Toggle AI Panel",
      icon: IconAi,
      context: "editor",
    },
    { id: "info", label: "Document Info", icon: IconInfo, context: "editor" },
    {
      id: "history",
      label: "Version History",
      icon: IconHistory,
      context: "editor",
    },
  ];

  return all.filter((a) => a.context === context || a.context === "both");
}

export { IconSearch, IconChevronRight, IconFolder };
