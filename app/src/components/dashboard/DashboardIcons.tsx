import type { DocumentType } from "./types";

export const IconTreeChevron = ({ expanded }: { expanded: boolean }) => (
  <svg
    className={`tree-chevron ${expanded ? "tree-chevron--open" : ""}`}
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

export const TYPE_CONFIG: Record<
  DocumentType,
  { label: string; color: string }
> = {
  tldraw: { label: "tldraw", color: "var(--accent)" },
  excalidraw: { label: "Excalidraw", color: "var(--type-excalidraw)" },
  drawio: { label: "Draw.io", color: "var(--type-drawio)" },
  markdown: { label: "Markdown", color: "var(--type-markdown)" },
  pdf: { label: "PDF", color: "var(--type-pdf)" },
  spreadsheet: { label: "Spreadsheet", color: "var(--type-spreadsheet)" },
  kanban: { label: "Kanban", color: "var(--type-kanban)" },
  code: { label: "Code", color: "var(--type-code)" },
  grid: { label: "Table", color: "var(--type-grid)" },
};

export const IconHome = () => (
  <svg
    className="folder-icon"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2.5 6.5L8 2l5.5 4.5V13a1 1 0 01-1 1h-9a1 1 0 01-1-1V6.5z" />
    <path d="M6 14V9h4v5" />
  </svg>
);

export const IconFolder = () => (
  <svg
    className="folder-icon"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 4.5A1.5 1.5 0 013.5 3h2.382a1 1 0 01.894.553L7.5 5h5A1.5 1.5 0 0114 6.5v5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5v-7z" />
  </svg>
);

export const IconPlus = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M8 3v10M3 8h10" />
  </svg>
);

export const IconTemplate = () => (
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

export const IconDots = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <circle cx="8" cy="3.5" r="1.25" />
    <circle cx="8" cy="8" r="1.25" />
    <circle cx="8" cy="12.5" r="1.25" />
  </svg>
);

export const IconMenu = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
  >
    <path d="M2 4h12M2 8h12M2 12h12" />
  </svg>
);

export const IconUpload = () => (
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
    <path d="M8 10V2M8 2L5 5M8 2l3 3" />
    <path d="M2 10v2a2 2 0 002 2h8a2 2 0 002-2v-2" />
  </svg>
);

export const IconChevron = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 6l4 4 4-4" />
  </svg>
);

export const IconTldraw = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="M2 2l7.586 7.586" />
    <circle cx="11" cy="11" r="2" />
  </svg>
);

export const IconExcalidraw = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 4h16v16H4z" />
    <circle cx="9" cy="9" r="2" />
    <path d="M15 9h.01" />
    <path d="M9 15l2-2 4 4" />
  </svg>
);

export const IconDrawio = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="8" y="14" width="7" height="7" rx="1" />
    <path d="M7 10v4h4" />
    <path d="M17 10v7h-2" />
  </svg>
);

export const IconMarkdown = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 5h18v14H3z" />
    <path d="M6 15V9l3 3.5L12 9v6" />
    <path d="M18 13l-2-2-2 2" />
    <path d="M16 15v-4" />
  </svg>
);

export const IconPdf = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
  </svg>
);

export const IconSpreadsheet = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
  </svg>
);

export const IconKanban = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="5" height="14" rx="1" />
    <rect x="10" y="3" width="5" height="10" rx="1" />
    <rect x="17" y="3" width="5" height="18" rx="1" />
  </svg>
);

export const IconCode = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

export const IconGrid = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
  </svg>
);

export const TYPE_ICONS: Record<DocumentType, () => JSX.Element> = {
  tldraw: IconTldraw,
  excalidraw: IconExcalidraw,
  drawio: IconDrawio,
  markdown: IconMarkdown,
  pdf: IconPdf,
  spreadsheet: IconSpreadsheet,
  kanban: IconKanban,
  code: IconCode,
  grid: IconGrid,
};
