import { useState, useRef, useEffect } from "react";
import type { TableColumn, SortConfig, FilterConfig } from "./types";

interface TableToolbarProps {
  columns: TableColumn[];
  sortConfig: SortConfig | null;
  filterConfigs: FilterConfig[];
  onSortChange: (config: SortConfig | null) => void;
  onFilterChange: (configs: FilterConfig[]) => void;
}

export function TableToolbar({
  columns,
  sortConfig,
  filterConfigs,
  onSortChange,
  onFilterChange,
}: TableToolbarProps) {
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sortOpen) return;
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node))
        setSortOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sortOpen]);

  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node))
        setFilterOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterOpen]);

  return (
    <div className="grid-toolbar">
      <div className="grid-toolbar__left">
        {/* Sort */}
        <div className="grid-toolbar__control" ref={sortRef}>
          <button
            className={`grid-toolbar__btn${sortConfig ? " grid-toolbar__btn--active" : ""}`}
            onClick={() => setSortOpen(!sortOpen)}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            >
              <path d="M2 4h10M4 7h6M6 10h2" />
            </svg>
            <span>
              Sort
              {sortConfig
                ? `: ${columns.find((c) => c.id === sortConfig.columnId)?.name ?? ""}`
                : ""}
            </span>
          </button>
          {sortOpen && (
            <div className="grid-toolbar__dropdown">
              {sortConfig && (
                <button
                  className="grid-toolbar__dropdown-item grid-toolbar__dropdown-item--clear"
                  onClick={() => {
                    onSortChange(null);
                    setSortOpen(false);
                  }}
                >
                  Clear sort
                </button>
              )}
              {columns.map((col) => (
                <div key={col.id} className="grid-toolbar__sort-row">
                  <span className="grid-toolbar__sort-name">{col.name}</span>
                  <button
                    className={`grid-toolbar__sort-dir${sortConfig?.columnId === col.id && sortConfig.direction === "asc" ? " grid-toolbar__sort-dir--active" : ""}`}
                    onClick={() => {
                      onSortChange({ columnId: col.id, direction: "asc" });
                      setSortOpen(false);
                    }}
                  >
                    A-Z
                  </button>
                  <button
                    className={`grid-toolbar__sort-dir${sortConfig?.columnId === col.id && sortConfig.direction === "desc" ? " grid-toolbar__sort-dir--active" : ""}`}
                    onClick={() => {
                      onSortChange({ columnId: col.id, direction: "desc" });
                      setSortOpen(false);
                    }}
                  >
                    Z-A
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filter */}
        <div className="grid-toolbar__control" ref={filterRef}>
          <button
            className={`grid-toolbar__btn${filterConfigs.length > 0 ? " grid-toolbar__btn--active" : ""}`}
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            >
              <path d="M1.5 3h11L8 7.5V11l-2 1V7.5L1.5 3z" />
            </svg>
            <span>
              Filter
              {filterConfigs.length > 0 ? ` (${filterConfigs.length})` : ""}
            </span>
          </button>
          {filterOpen && (
            <div className="grid-toolbar__dropdown grid-toolbar__dropdown--filter">
              {filterConfigs.map((fc, i) => (
                <FilterRow
                  key={i}
                  columns={columns}
                  config={fc}
                  onChange={(updated) => {
                    const next = [...filterConfigs];
                    next[i] = updated;
                    onFilterChange(next);
                  }}
                  onRemove={() =>
                    onFilterChange(filterConfigs.filter((_, j) => j !== i))
                  }
                />
              ))}
              <button
                className="grid-toolbar__dropdown-item grid-toolbar__add-filter"
                onClick={() => {
                  if (columns.length === 0) return;
                  onFilterChange([
                    ...filterConfigs,
                    {
                      columnId: columns[0].id,
                      operator: "contains",
                      value: "",
                    },
                  ]);
                }}
              >
                + Add filter
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const OPERATORS: Array<{ value: FilterConfig["operator"]; label: string }> = [
  { value: "contains", label: "contains" },
  { value: "eq", label: "is" },
  { value: "neq", label: "is not" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "empty", label: "is empty" },
  { value: "notEmpty", label: "is not empty" },
];

function FilterRow({
  columns,
  config,
  onChange,
  onRemove,
}: {
  columns: TableColumn[];
  config: FilterConfig;
  onChange: (config: FilterConfig) => void;
  onRemove: () => void;
}) {
  const needsValue = !["empty", "notEmpty"].includes(config.operator);

  return (
    <div className="grid-filter-row">
      <select
        className="grid-filter-row__select"
        value={config.columnId}
        onChange={(e) => onChange({ ...config, columnId: e.target.value })}
      >
        {columns.map((col) => (
          <option key={col.id} value={col.id}>
            {col.name}
          </option>
        ))}
      </select>
      <select
        className="grid-filter-row__select"
        value={config.operator}
        onChange={(e) =>
          onChange({
            ...config,
            operator: e.target.value as FilterConfig["operator"],
          })
        }
      >
        {OPERATORS.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>
      {needsValue && (
        <input
          className="grid-filter-row__input"
          value={config.value}
          onChange={(e) => onChange({ ...config, value: e.target.value })}
          placeholder="Value..."
        />
      )}
      <button
        className="grid-filter-row__remove"
        onClick={onRemove}
        title="Remove filter"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      </button>
    </div>
  );
}
