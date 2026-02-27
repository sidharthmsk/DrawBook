import { useCallback, useEffect, useRef, useState } from "react";
import { EditableTitle } from "./EditableTitle";
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

  if (snapshot === undefined) {
    return (
      <div className="editor-loading">
        <div className="editor-loading__spinner" />
        Loading Spreadsheet...
      </div>
    );
  }

  return (
    <div className="editor-wrapper">
      <div className="editor-topbar">
        <button
          className="editor-back-btn"
          onClick={() => (window.location.href = "/")}
        >
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
            <path d="M10 12L6 8l4-4" />
          </svg>
          Back
        </button>
        <EditableTitle documentId={documentId} />
        <div className="editor-topbar__status">
          <span
            className={`editor-status-dot editor-status-dot--${saveStatus === "error" ? "error" : saveStatus === "saved" ? "saved" : "saving"}`}
          />
          <span>
            {saveStatus === "saved"
              ? "Saved"
              : saveStatus === "saving"
                ? "Saving..."
                : "Error"}
          </span>
        </div>
      </div>
      <div className="editor-canvas" ref={containerRef} />
    </div>
  );
}
