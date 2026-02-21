import { useCallback, useEffect, useRef, useState } from "react";

interface ExcalidrawEditorProps {
  documentId: string;
}

export function ExcalidrawEditor({ documentId }: ExcalidrawEditorProps) {
  const [ExcalidrawComp, setExcalidrawComp] = useState<any>(null);
  const [initialData, setInitialData] = useState<any>(undefined);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const latestScene = useRef<any>(null);
  const initialSaveDone = useRef(false);

  useEffect(() => {
    import("@excalidraw/excalidraw").then((mod) => {
      setExcalidrawComp(() => mod.Excalidraw);
    });
    // @ts-ignore - Vite handles CSS imports
    import("@excalidraw/excalidraw/index.css");
  }, []);

  useEffect(() => {
    fetch(`/api/load/${documentId}`)
      .then((r) => r.json())
      .then((data) => {
        setInitialData(data.snapshot || null);
      })
      .catch(() => setInitialData(null));
  }, [documentId]);

  const saveToServer = useCallback(
    async (scene: any) => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/save/${documentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot: scene, type: "excalidraw" }),
        });
        setSaveStatus(res.ok ? "saved" : "error");
      } catch {
        setSaveStatus("error");
      }
    },
    [documentId],
  );

  const handleChange = useCallback(
    (elements: any, appState: any) => {
      const scene = {
        elements,
        appState: { viewBackgroundColor: appState.viewBackgroundColor },
      };
      latestScene.current = scene;

      if (!initialSaveDone.current) {
        initialSaveDone.current = true;
        if (!initialData) {
          saveToServer(scene);
        }
        return;
      }

      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        if (latestScene.current) saveToServer(latestScene.current);
      }, 2000);
    },
    [saveToServer, initialData],
  );

  if (!ExcalidrawComp || initialData === undefined) {
    return (
      <div className="editor-loading">
        <div className="editor-loading__spinner" />
        Loading Excalidraw...
      </div>
    );
  }

  const excalidrawProps: any = {};
  if (initialData) {
    excalidrawProps.initialData = {
      elements: initialData.elements || [],
      appState: initialData.appState || {},
    };
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
        <span className="editor-topbar__title">{documentId}</span>
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
      <div className="editor-canvas">
        <ExcalidrawComp
          onChange={handleChange}
          theme="dark"
          {...excalidrawProps}
        />
      </div>
    </div>
  );
}
