import { useCallback, useEffect, useRef, useState } from "react";
import { EditorShell } from "./EditorShell";
import {
  createSpreadsheetAdapter,
  type EditorAdapter,
} from "./ai/EditorAdapter";
import { createUniver, LocaleType, mergeLocales } from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import UniverPresetSheetsCoreEnUS from "@univerjs/preset-sheets-core/locales/en-US";
import "@univerjs/preset-sheets-core/lib/index.css";

interface SpreadsheetEditorProps {
  documentId: string;
}

export function SpreadsheetEditor({ documentId }: SpreadsheetEditorProps) {
  const [snapshot, setSnapshot] = useState<any>(undefined);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const univerRef = useRef<ReturnType<typeof createUniver> | null>(null);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const isNew = useRef(false);
  const [adapter, setAdapter] = useState<EditorAdapter | null>(null);
  const [docName, setDocName] = useState("spreadsheet");

  const setCellsFromAI = useCallback(
    (cells: Array<{ row: number; col: number; value: string | number }>) => {
      const api = univerRef.current?.univerAPI;
      if (!api) return;
      const wb = api.getActiveWorkbook();
      if (!wb) return;
      const sheet = wb.getActiveSheet();
      if (!sheet) return;
      for (const { row, col, value } of cells) {
        const range = sheet.getRange(row, col, 1, 1);
        if (range) range.setValue(value);
      }
    },
    [],
  );

  useEffect(() => {
    setAdapter(createSpreadsheetAdapter(univerRef as any, setCellsFromAI));
  }, [setCellsFromAI]);

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
        if (data.snapshot) {
          setSnapshot(data.snapshot);
        } else {
          isNew.current = true;
          setSnapshot(null);
        }
      })
      .catch(() => {
        isNew.current = true;
        setSnapshot(null);
      });
  }, [documentId]);

  const saveToServer = useCallback(
    async (workbookData: any) => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/save/${documentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            snapshot: workbookData,
            type: "spreadsheet",
          }),
        });
        setSaveStatus(res.ok ? "saved" : "error");
      } catch {
        setSaveStatus("error");
      }
    },
    [documentId],
  );

  useEffect(() => {
    if (snapshot === undefined || !containerRef.current) return;

    const { univerAPI } = createUniver({
      locale: LocaleType.EN_US,
      locales: {
        [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS),
      },
      darkMode: true,
      presets: [
        UniverSheetsCorePreset({
          container: containerRef.current,
        }),
      ],
    });

    univerRef.current = { univerAPI } as any;

    if (snapshot) {
      univerAPI.createWorkbook(snapshot);
    } else {
      univerAPI.createWorkbook({});
    }

    if (isNew.current) {
      isNew.current = false;
      const wb = univerAPI.getActiveWorkbook();
      if (wb) saveToServer(wb.save());
    }

    const disposable = univerAPI.onCommandExecuted(() => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        const wb = univerAPI.getActiveWorkbook();
        if (wb) saveToServer(wb.save());
      }, 2000);
    });

    return () => {
      disposable?.dispose();
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      univerAPI.dispose();
      univerRef.current = null;
    };
  }, [snapshot, saveToServer]);

  const handleExport = useCallback(() => {
    const api = univerRef.current?.univerAPI;
    if (!api) return;
    const wb = api.getActiveWorkbook();
    if (!wb) return;
    try {
      const data = wb.save();
      const sheets = data?.sheets;
      if (!sheets) return;
      const rows: string[][] = [];
      for (const sheet of Object.values(sheets) as any[]) {
        const cellData = sheet.cellData;
        if (!cellData) continue;
        for (const [rowIdx, row] of Object.entries(cellData) as [
          string,
          any,
        ][]) {
          if (!row) continue;
          const r = parseInt(rowIdx, 10);
          for (const [colIdx, cell] of Object.entries(row) as [string, any][]) {
            const c = parseInt(colIdx, 10);
            const val = cell?.v;
            if (val !== undefined && val !== null && val !== "") {
              while (rows.length <= r) rows.push([]);
              while (rows[r].length <= c) rows[r].push("");
              rows[r][c] = String(val);
            }
          }
        }
        break;
      }
      const maxCols = Math.max(0, ...rows.map((r) => r.length));
      const csv = rows
        .map((r) => {
          while (r.length < maxCols) r.push("");
          return r
            .map((v) =>
              v.includes(",") || v.includes('"') || v.includes("\n")
                ? `"${v.replace(/"/g, '""')}"`
                : v,
            )
            .join(",");
        })
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${docName}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("CSV export failed:", err);
    }
  }, [docName]);

  if (snapshot === undefined) {
    return (
      <div className="editor-loading">
        <div className="editor-loading__spinner" />
        Loading Spreadsheet...
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
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </EditorShell>
  );
}
