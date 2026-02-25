import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from "@tanstack/react-table";
import type {
  TableColumn,
  TableRow,
  CellValue,
  SortConfig,
  FilterConfig,
  ColumnType,
} from "./types";
import { TableHeader } from "./TableHeader";
import { TableToolbar } from "./TableToolbar";
import { TextCell } from "./cells/TextCell";
import { LongTextCell } from "./cells/LongTextCell";
import { NumberCell } from "./cells/NumberCell";
import { SelectCell } from "./cells/SelectCell";
import { MultiSelectCell } from "./cells/MultiSelectCell";
import { CheckboxCell } from "./cells/CheckboxCell";
import { DateCell } from "./cells/DateCell";
import { UrlCell } from "./cells/UrlCell";
import { RatingCell } from "./cells/RatingCell";

interface TableViewProps {
  columns: TableColumn[];
  rows: TableRow[];
  sortConfig: SortConfig | null;
  filterConfigs: FilterConfig[];
  onCellChange: (rowId: string, columnId: string, value: CellValue) => void;
  onAddRow: () => void;
  onDeleteRow: (rowId: string) => void;
  onAddColumn: () => void;
  onRenameColumn: (columnId: string, name: string) => void;
  onChangeColumnType: (columnId: string, type: ColumnType) => void;
  onDeleteColumn: (columnId: string) => void;
  onAddOption: (columnId: string, option: string) => void;
  onSortChange: (config: SortConfig | null) => void;
  onFilterChange: (configs: FilterConfig[]) => void;
}

function applyFilters(
  rows: TableRow[],
  _columns: TableColumn[],
  filters: FilterConfig[],
): TableRow[] {
  if (filters.length === 0) return rows;
  return rows.filter((row) =>
    filters.every((f) => {
      const raw = row.cells[f.columnId];
      const val = raw === null || raw === undefined ? "" : String(raw);
      switch (f.operator) {
        case "eq":
          return val === f.value;
        case "neq":
          return val !== f.value;
        case "contains":
          return val.toLowerCase().includes(f.value.toLowerCase());
        case "gt":
          return Number(val) > Number(f.value);
        case "lt":
          return Number(val) < Number(f.value);
        case "empty":
          return (
            val === "" ||
            raw === null ||
            raw === undefined ||
            (Array.isArray(raw) && raw.length === 0)
          );
        case "notEmpty":
          return (
            val !== "" &&
            raw !== null &&
            raw !== undefined &&
            !(Array.isArray(raw) && raw.length === 0)
          );
        default:
          return true;
      }
    }),
  );
}

function applySorting(
  rows: TableRow[],
  columns: TableColumn[],
  sort: SortConfig | null,
): TableRow[] {
  if (!sort) return rows;
  const col = columns.find((c) => c.id === sort.columnId);
  if (!col) return rows;
  const dir = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a.cells[sort.columnId];
    const bv = b.cells[sort.columnId];
    if (av === null || av === undefined) return dir;
    if (bv === null || bv === undefined) return -dir;
    if (col.type === "number") return (Number(av) - Number(bv)) * dir;
    if (col.type === "checkbox") return ((av ? 1 : 0) - (bv ? 1 : 0)) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
}

export function TableView({
  columns,
  rows,
  sortConfig,
  filterConfigs,
  onCellChange,
  onAddRow,
  onDeleteRow,
  onAddColumn,
  onRenameColumn,
  onChangeColumnType,
  onDeleteColumn,
  onAddOption,
  onSortChange,
  onFilterChange,
}: TableViewProps) {
  const processedRows = useMemo(() => {
    const filtered = applyFilters(rows, columns, filterConfigs);
    return applySorting(filtered, columns, sortConfig);
  }, [rows, columns, filterConfigs, sortConfig]);

  const columnDefs = useMemo<ColumnDef<TableRow, CellValue>[]>(
    () =>
      columns.map((col) => ({
        id: col.id,
        header: col.name,
        accessorFn: (row: TableRow) => row.cells[col.id] ?? null,
        cell: ({ row: tableRow, getValue }) => {
          const rowData = tableRow.original;
          const cellValue = getValue();

          return (
            <CellRenderer
              column={col}
              value={cellValue}
              onChange={(val) => onCellChange(rowData.id, col.id, val)}
              onAddOption={(opt) => onAddOption(col.id, opt)}
            />
          );
        },
      })),
    [columns, onCellChange, onAddOption],
  );

  const table = useReactTable({
    data: processedRows,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualFiltering: true,
  });

  return (
    <div className="grid-view">
      <TableToolbar
        columns={columns}
        sortConfig={sortConfig}
        filterConfigs={filterConfigs}
        onSortChange={onSortChange}
        onFilterChange={onFilterChange}
      />
      <div className="grid-table-wrap">
        <table className="grid-table">
          <TableHeader
            headers={table.getHeaderGroups()[0]?.headers ?? []}
            columns={columns}
            onRenameColumn={onRenameColumn}
            onChangeColumnType={onChangeColumnType}
            onDeleteColumn={onDeleteColumn}
            onAddColumn={onAddColumn}
          />
          <tbody>
            {table.getRowModel().rows.map((row, idx) => (
              <tr key={row.original.id} className="grid-row">
                <td className="grid-cell grid-cell--row-num">
                  <span className="grid-row-num">{idx + 1}</span>
                  <button
                    className="grid-row-delete"
                    onClick={() => onDeleteRow(row.original.id)}
                    title="Delete row"
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
                </td>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="grid-cell">
                    {cell.column.columnDef.cell
                      ? typeof cell.column.columnDef.cell === "function"
                        ? cell.column.columnDef.cell(cell.getContext())
                        : cell.column.columnDef.cell
                      : null}
                  </td>
                ))}
                <td className="grid-cell grid-cell--spacer" />
              </tr>
            ))}
          </tbody>
        </table>
        <button className="grid-add-row-btn" onClick={onAddRow}>
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
          <span>New row</span>
        </button>
      </div>
    </div>
  );
}

function CellRenderer({
  column,
  value,
  onChange,
  onAddOption,
}: {
  column: TableColumn;
  value: CellValue;
  onChange: (val: CellValue) => void;
  onAddOption: (opt: string) => void;
}) {
  switch (column.type) {
    case "text":
      return <TextCell value={(value as string) ?? ""} onChange={onChange} />;
    case "longtext":
      return (
        <LongTextCell value={(value as string) ?? ""} onChange={onChange} />
      );
    case "number":
      return (
        <NumberCell
          value={typeof value === "number" ? value : null}
          onChange={onChange}
        />
      );
    case "select":
      return (
        <SelectCell
          value={(value as string) ?? ""}
          options={column.options ?? []}
          onChange={(v) => onChange(v)}
          onAddOption={onAddOption}
        />
      );
    case "multiselect":
      return (
        <MultiSelectCell
          value={Array.isArray(value) ? value : []}
          options={column.options ?? []}
          onChange={(v) => onChange(v)}
          onAddOption={onAddOption}
        />
      );
    case "checkbox":
      return <CheckboxCell value={!!value} onChange={(v) => onChange(v)} />;
    case "date":
      return <DateCell value={(value as string) ?? ""} onChange={onChange} />;
    case "url":
      return <UrlCell value={(value as string) ?? ""} onChange={onChange} />;
    case "rating":
      return (
        <RatingCell
          value={typeof value === "number" ? value : 0}
          max={column.ratingMax ?? 5}
          onChange={(v) => onChange(v)}
        />
      );
    default:
      return <TextCell value={String(value ?? "")} onChange={onChange} />;
  }
}
