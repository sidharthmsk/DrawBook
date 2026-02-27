import type { EditorAdapter } from "../EditorAdapter";

export function createSpreadsheetAdapter(
  univerRef: { current: { univerAPI: any } | null },
  setCells?: (
    cells: Array<{ row: number; col: number; value: string | number }>,
  ) => void,
): EditorAdapter {
  return {
    type: "spreadsheet",
    getContext() {
      const api = univerRef.current?.univerAPI;
      if (!api) return "Spreadsheet not loaded.";

      const wb = api.getActiveWorkbook();
      if (!wb) return "No active workbook.";

      try {
        const data = wb.save();
        const sheets = data?.sheets;
        if (!sheets || typeof sheets !== "object")
          return "The spreadsheet is empty.";

        const parts: string[] = [];
        let cellCount = 0;
        const maxCells = 50;

        for (const [sheetId, sheet] of Object.entries(sheets) as [
          string,
          any,
        ][]) {
          const name = sheet.name || sheetId;
          const cellData = sheet.cellData;
          if (!cellData || typeof cellData !== "object") {
            parts.push(`Sheet "${name}": empty`);
            continue;
          }

          const cells: string[] = [];
          for (const [rowIdx, row] of Object.entries(cellData) as [
            string,
            any,
          ][]) {
            if (cellCount >= maxCells) break;
            if (!row || typeof row !== "object") continue;
            for (const [colIdx, cell] of Object.entries(row) as [
              string,
              any,
            ][]) {
              if (cellCount >= maxCells) break;
              const val = cell?.v;
              if (val !== undefined && val !== null && val !== "") {
                cells.push(
                  `  [${rowIdx},${colIdx}]: ${String(val).slice(0, 100)}`,
                );
                cellCount++;
              }
            }
          }

          if (cells.length > 0) {
            parts.push(
              `Sheet "${name}" (${cells.length} cells):\n${cells.join("\n")}`,
            );
          } else {
            parts.push(`Sheet "${name}": empty`);
          }
        }

        if (parts.length === 0) return "The spreadsheet is empty.";
        const summary = parts.join("\n\n");
        if (cellCount >= maxCells) {
          return `${summary}\n... (showing first ${maxCells} cells)`;
        }
        return summary;
      } catch (e) {
        console.error("[AI] Failed to read spreadsheet:", e);
        return "Unable to read spreadsheet content.";
      }
    },
    applyContent(content: string) {
      if (!setCells) return;
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          setCells(parsed);
        }
      } catch {
        // ignore invalid JSON
      }
    },
  };
}
