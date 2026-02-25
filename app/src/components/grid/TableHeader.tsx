import { useState, useRef, useEffect } from "react";
import type { Header } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { ColumnTypeMenu, TYPE_ICONS } from "./ColumnTypeMenu";
import type { TableColumn, TableRow, ColumnType } from "./types";

interface TableHeaderProps {
  headers: Header<TableRow, unknown>[];
  columns: TableColumn[];
  onRenameColumn: (columnId: string, name: string) => void;
  onChangeColumnType: (columnId: string, type: ColumnType) => void;
  onDeleteColumn: (columnId: string) => void;
  onAddColumn: () => void;
}

export function TableHeader({
  headers,
  columns,
  onRenameColumn,
  onChangeColumnType,
  onDeleteColumn,
  onAddColumn,
}: TableHeaderProps) {
  return (
    <thead>
      <tr className="grid-header-row">
        <th className="grid-header-cell grid-header-cell--row-num">#</th>
        {headers.map((header) => (
          <HeaderCell
            key={header.id}
            header={header}
            column={columns.find((c) => c.id === header.id)}
            onRename={(name) => onRenameColumn(header.id, name)}
            onChangeType={(type) => onChangeColumnType(header.id, type)}
            onDelete={() => onDeleteColumn(header.id)}
          />
        ))}
        <th className="grid-header-cell grid-header-cell--add">
          <button
            className="grid-add-col-btn"
            onClick={onAddColumn}
            title="Add column"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M7 3v8M3 7h8" />
            </svg>
          </button>
        </th>
      </tr>
    </thead>
  );
}

function HeaderCell({
  header,
  column,
  onRename,
  onChangeType,
  onDelete,
}: {
  header: Header<TableRow, unknown>;
  column?: TableColumn;
  onRename: (name: string) => void;
  onChangeType: (type: ColumnType) => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(column?.name ?? "");
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (renaming) {
      setDraft(column?.name ?? "");
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming, column?.name]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const commitRename = () => {
    if (draft.trim()) onRename(draft.trim());
    setRenaming(false);
  };

  return (
    <th
      className="grid-header-cell"
      style={column?.width ? { width: column.width } : undefined}
    >
      <div className="grid-header-cell__inner">
        {column && (
          <span className="grid-header-cell__type-icon" title={column.type}>
            {TYPE_ICONS[column.type]}
          </span>
        )}
        {renaming ? (
          <input
            ref={inputRef}
            className="grid-header-cell__rename-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <span
            className="grid-header-cell__name"
            onDoubleClick={() => setRenaming(true)}
          >
            {header.isPlaceholder
              ? null
              : flexRender(header.column.columnDef.header, header.getContext())}
          </span>
        )}
        <button
          className="grid-header-cell__menu-btn"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <circle cx="6" cy="2.5" r="1" />
            <circle cx="6" cy="6" r="1" />
            <circle cx="6" cy="9.5" r="1" />
          </svg>
        </button>
      </div>
      {menuOpen && (
        <div className="grid-header-menu" ref={menuRef}>
          <button
            className="grid-header-menu__item"
            onClick={() => {
              setRenaming(true);
              setMenuOpen(false);
            }}
          >
            Rename
          </button>
          <button
            className="grid-header-menu__item"
            onClick={() => {
              setTypeMenuOpen(true);
              setMenuOpen(false);
            }}
          >
            Change type
          </button>
          <button
            className="grid-header-menu__item grid-header-menu__item--danger"
            onClick={() => {
              onDelete();
              setMenuOpen(false);
            }}
          >
            Delete column
          </button>
        </div>
      )}
      {typeMenuOpen && (
        <ColumnTypeMenu
          onSelect={onChangeType}
          onClose={() => setTypeMenuOpen(false)}
        />
      )}
    </th>
  );
}
