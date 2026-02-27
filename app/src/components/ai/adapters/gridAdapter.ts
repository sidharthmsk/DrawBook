import type { EditorAdapter } from "../EditorAdapter";

export interface GridTableSnapshot {
  columns: Array<{ id: string; name: string; type: string }>;
  rows: Array<{ id: string; cells: Record<string, unknown> }>;
}

export function createGridAdapter(
  dataRef: { current: GridTableSnapshot | undefined },
  addRows?: (rows: Array<Record<string, unknown>>) => void,
): EditorAdapter {
  return {
    type: "grid",
    getContext() {
      const data = dataRef.current;
      if (!data || data.columns.length === 0) return "The table is empty.";

      const header = data.columns.map((c) => c.name).join(" | ");
      const separator = data.columns.map(() => "---").join(" | ");
      const bodyRows = data.rows.slice(0, 50).map((row) =>
        data.columns
          .map((col) => {
            const val = row.cells[col.id];
            if (val === null || val === undefined) return "";
            if (Array.isArray(val)) return val.join(", ");
            return String(val);
          })
          .join(" | "),
      );

      const table = [header, separator, ...bodyRows].join("\n");
      const summary = `Table with ${data.columns.length} column(s) and ${data.rows.length} row(s):\n\n${table}`;
      if (data.rows.length > 50) {
        return `${summary}\n... and ${data.rows.length - 50} more rows`;
      }
      return summary;
    },
    applyContent(content: string) {
      if (!addRows) return;
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          addRows(parsed);
        }
      } catch {
        console.warn("Failed to parse grid AI content");
      }
    },
  };
}
