import { useCallback, useEffect, useRef, useState } from "react";
import { EditorShell } from "./EditorShell";
import { createGridAdapter, type EditorAdapter } from "./ai/EditorAdapter";
import { TableView } from "./grid/TableView";
import type {
  TableSnapshot,
  TableRow,
  CellValue,
  SortConfig,
  FilterConfig,
  ColumnType,
} from "./grid/types";
import { DEFAULT_TABLE } from "./grid/types";

interface GridEditorProps {
  documentId: string;
}

export function GridEditor({ documentId }: GridEditorProps) {
  const [snapshot, setSnapshot] = useState<TableSnapshot | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [adapter, setAdapter] = useState<EditorAdapter | null>(null);
  const [docName, setDocName] = useState("table");

  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const isNew = useRef(false);
  const dataRef = useRef<TableSnapshot | undefined>(undefined);

  const saveToServer = useCallback(
    async (data: TableSnapshot) => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/save/${documentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot: data, type: "grid" }),
        });
        setSaveStatus(res.ok ? "saved" : "error");
      } catch {
        setSaveStatus("error");
      }
    },
    [documentId],
  );

  const scheduleSave = useCallback(
    (data: TableSnapshot) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => saveToServer(data), 1500);
    },
    [saveToServer],
  );

  const updateSnapshot = useCallback(
    (updater: (prev: TableSnapshot) => TableSnapshot) => {
      setSnapshot((prev) => {
        const next = updater(prev ?? DEFAULT_TABLE);
        dataRef.current = next;
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  // Load document
  useEffect(() => {
    fetch(`/api/meta/${documentId}`)
      .then((r) => r.json())
      .then((meta) => {
        if (meta.name) setDocName(meta.name);
      })
      .catch(() => {});
  }, [documentId]);

  useEffect(() => {
    fetch(`/api/load/${documentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.snapshot && data.snapshot.columns) {
          const s = data.snapshot as TableSnapshot;
          setSnapshot(s);
          dataRef.current = s;
        } else {
          isNew.current = true;
          setSnapshot(DEFAULT_TABLE);
          dataRef.current = DEFAULT_TABLE;
        }
      })
      .catch(() => {
        isNew.current = true;
        setSnapshot(DEFAULT_TABLE);
        dataRef.current = DEFAULT_TABLE;
      })
      .finally(() => setLoading(false));
  }, [documentId]);

  // Save new documents immediately
  useEffect(() => {
    if (isNew.current && snapshot) {
      isNew.current = false;
      saveToServer(snapshot);
    }
  }, [snapshot, saveToServer]);

  // AI adapter
  const setDataFromAI = useCallback(
    (newRows: Array<Record<string, unknown>>) => {
      updateSnapshot((prev) => {
        const added: TableRow[] = newRows.map((cells, i) => ({
          id: `row-${Date.now()}-${i}`,
          cells: cells as Record<string, CellValue>,
        }));
        return { ...prev, rows: [...prev.rows, ...added] };
      });
    },
    [updateSnapshot],
  );

  useEffect(() => {
    setAdapter(createGridAdapter(dataRef, setDataFromAI));
  }, [setDataFromAI]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, []);

  // Cell operations
  const onCellChange = useCallback(
    (rowId: string, columnId: string, value: CellValue) => {
      updateSnapshot((prev) => ({
        ...prev,
        rows: prev.rows.map((r) =>
          r.id === rowId
            ? { ...r, cells: { ...r.cells, [columnId]: value } }
            : r,
        ),
      }));
    },
    [updateSnapshot],
  );

  const onAddRow = useCallback(() => {
    updateSnapshot((prev) => ({
      ...prev,
      rows: [...prev.rows, { id: `row-${Date.now()}`, cells: {} }],
    }));
  }, [updateSnapshot]);

  const onDeleteRow = useCallback(
    (rowId: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        rows: prev.rows.filter((r) => r.id !== rowId),
      }));
    },
    [updateSnapshot],
  );

  const onAddColumn = useCallback(() => {
    updateSnapshot((prev) => ({
      ...prev,
      columns: [
        ...prev.columns,
        {
          id: `col-${Date.now()}`,
          name: "New Column",
          type: "text" as ColumnType,
        },
      ],
    }));
  }, [updateSnapshot]);

  const onRenameColumn = useCallback(
    (columnId: string, name: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        columns: prev.columns.map((c) =>
          c.id === columnId ? { ...c, name } : c,
        ),
      }));
    },
    [updateSnapshot],
  );

  const onChangeColumnType = useCallback(
    (columnId: string, type: ColumnType) => {
      updateSnapshot((prev) => ({
        ...prev,
        columns: prev.columns.map((c) =>
          c.id === columnId
            ? {
                ...c,
                type,
                options:
                  type === "select" || type === "multiselect"
                    ? (c.options ?? [])
                    : undefined,
                ratingMax: type === "rating" ? (c.ratingMax ?? 5) : undefined,
              }
            : c,
        ),
      }));
    },
    [updateSnapshot],
  );

  const onDeleteColumn = useCallback(
    (columnId: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        columns: prev.columns.filter((c) => c.id !== columnId),
        rows: prev.rows.map((r) => {
          const { [columnId]: _, ...rest } = r.cells;
          return { ...r, cells: rest };
        }),
      }));
    },
    [updateSnapshot],
  );

  const onAddOption = useCallback(
    (columnId: string, option: string) => {
      updateSnapshot((prev) => ({
        ...prev,
        columns: prev.columns.map((c) =>
          c.id === columnId && (c.type === "select" || c.type === "multiselect")
            ? { ...c, options: [...(c.options ?? []), option] }
            : c,
        ),
      }));
    },
    [updateSnapshot],
  );

  const onSortChange = useCallback(
    (config: SortConfig | null) => {
      updateSnapshot((prev) => ({ ...prev, sortConfig: config }));
    },
    [updateSnapshot],
  );

  const onFilterChange = useCallback(
    (configs: FilterConfig[]) => {
      updateSnapshot((prev) => ({ ...prev, filterConfigs: configs }));
    },
    [updateSnapshot],
  );

  const handleExport = useCallback(() => {
    if (!snapshot) return;
    const header = snapshot.columns.map((c) => c.name);
    const csvRows = snapshot.rows.map((row) =>
      snapshot.columns.map((col) => {
        const val = row.cells[col.id];
        if (val === null || val === undefined) return "";
        if (Array.isArray(val)) return val.join(", ");
        return String(val);
      }),
    );
    const lines = [header, ...csvRows].map((row) =>
      row
        .map((v) =>
          v.includes(",") || v.includes('"') || v.includes("\n")
            ? `"${v.replace(/"/g, '""')}"`
            : v,
        )
        .join(","),
    );
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${docName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [snapshot, docName]);

  if (loading || !snapshot) {
    return (
      <div className="editor-loading">
        <div className="editor-loading__spinner" />
        Loading Table...
      </div>
    );
  }

  return (
    <EditorShell
      documentId={documentId}
      adapter={adapter}
      saveStatus={saveStatus}
      onExport={handleExport}
      exportLabel="Export CSV"
    >
      <TableView
        columns={snapshot.columns}
        rows={snapshot.rows}
        sortConfig={snapshot.sortConfig ?? null}
        filterConfigs={snapshot.filterConfigs ?? []}
        onCellChange={onCellChange}
        onAddRow={onAddRow}
        onDeleteRow={onDeleteRow}
        onAddColumn={onAddColumn}
        onRenameColumn={onRenameColumn}
        onChangeColumnType={onChangeColumnType}
        onDeleteColumn={onDeleteColumn}
        onAddOption={onAddOption}
        onSortChange={onSortChange}
        onFilterChange={onFilterChange}
      />
    </EditorShell>
  );
}
