import { useCallback, useEffect, useRef, useState } from "react";
import { EditorShell } from "./EditorShell";
import { createExcalidrawAdapter } from "./ai/EditorAdapter";
import type { EditorAdapter } from "./ai/EditorAdapter";

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
  const excalidrawApiRef = useRef<any>(null);
  const [adapter, setAdapter] = useState<EditorAdapter | null>(null);

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

  const handleExcalidrawApi = useCallback((api: any) => {
    excalidrawApiRef.current = api;
    setAdapter(
      createExcalidrawAdapter(
        () => api.getSceneElements(),
        (scene: { elements: any[] }) => api.updateScene(scene),
      ),
    );
  }, []);

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
    <EditorShell
      documentId={documentId}
      adapter={adapter}
      saveStatus={saveStatus}
    >
      <ExcalidrawComp
        onChange={handleChange}
        excalidrawAPI={handleExcalidrawApi}
        theme="dark"
        {...excalidrawProps}
      />
    </EditorShell>
  );
}
