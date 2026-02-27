# Mobile Phone Support Design

## Goal

Full editing experience on phones (<640px) for Markdown, Kanban, Excalidraw, and Spreadsheet editors.

## Approach

Responsive hooks + CSS: a shared `useIsMobile()` hook for behavioral changes, CSS `@media (max-width: 640px)` for layout. Single component tree with conditional rendering — no separate mobile components.

## Breakpoint

640px, matching the existing mobile breakpoint in `index.css`.

## Components

### useIsMobile Hook

- `window.matchMedia('(max-width: 640px)')` with change listener
- Returns boolean
- Located at `app/src/hooks/useIsMobile.ts`

### EditorShell Topbar

- Back button: icon only, hide "Back" text
- Breadcrumbs: hidden
- EditableTitle: flex-shrink with ellipsis
- Status: dot only, hide text
- Action buttons (Info, History, Export, Template): collapse into "..." overflow dropdown
- AI toggle remains visible alongside overflow button

### AI Chat Panel

- Full-screen overlay (`position: fixed; inset: 0`) instead of side panel
- No resize handle
- `padding-bottom: env(safe-area-inset-bottom)` on input area

### Kanban Editor

- Single column at a time, full width
- Horizontal scrollable tab strip for column switching
- TouchSensor alongside PointerSensor
- "Move to column" dropdown in card detail modal
- "+" tab to add column
- Long-press column tab for rename/delete/WIP context menu

### Excalidraw

- `touch-action: none` on container
- Flowchart panel as full-screen overlay

### Spreadsheet

- Full-height container; Univer handles touch natively

### Markdown / BlockNote

- Full-height container
- Horizontal scroll on toolbar overflow

### Dashboard

- Doc grid: `minmax(150px, 1fr)` at 640px
- QuickSwitcher: `width: 90vw`
