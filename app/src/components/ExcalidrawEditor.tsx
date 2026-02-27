import { useCallback, useEffect, useRef, useState } from "react";
import { EditorShell } from "./EditorShell";
import { createExcalidrawAdapter } from "./ai/EditorAdapter";
import type { EditorAdapter } from "./ai/EditorAdapter";
import { generateFlowchart } from "./FlowchartGenerator";
import { useIsMobile } from "../hooks/useIsMobile";
import { LIBRARY_PRESETS } from "./excalidraw/presets";

interface ExcalidrawEditorProps {
  documentId: string;
}

export function ExcalidrawEditor({ documentId }: ExcalidrawEditorProps) {
  const isMobile = useIsMobile();
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
  const [docName, setDocName] = useState("drawing");

  useEffect(() => {
    import("@excalidraw/excalidraw").then((mod) => {
      setExcalidrawComp(() => mod.Excalidraw);
    });
    // @ts-ignore - Vite handles CSS imports
    import("@excalidraw/excalidraw/index.css");
  }, []);

  useEffect(() => {
    fetch(`/api/meta/${documentId}`)
      .then((r) => r.json())
      .then((meta) => {
        if (meta.name) setDocName(meta.name);
      })
      .catch(() => {});

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
        (scene: { elements: any[]; files?: any }) => api.updateScene(scene),
      ),
    );
  }, []);

  const [flowchartOpen, setFlowchartOpen] = useState(false);
  const [allDocs, setAllDocs] = useState<
    Array<{ id: string; name: string; type: string }>
  >([]);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!flowchartOpen) return;
    fetch("/api/documents/names")
      .then((r) => r.json())
      .then((data) => setAllDocs(data.documents || []))
      .catch(() => {});
  }, [flowchartOpen]);

  const handleGenerateFlowchart = useCallback(async () => {
    const api = excalidrawApiRef.current;
    if (!api || selectedDocIds.size === 0) return;
    setGenerating(true);
    try {
      const elements = await generateFlowchart([...selectedDocIds]);
      if (elements.length > 0) {
        const existing = api.getSceneElements() || [];
        api.updateScene({ elements: [...existing, ...elements] });
        api.scrollToContent(elements, { fitToContent: true });
      }
      setFlowchartOpen(false);
      setSelectedDocIds(new Set());
    } catch (err) {
      console.error("Flowchart generation failed:", err);
    } finally {
      setGenerating(false);
    }
  }, [selectedDocIds]);

  const toggleDocSelection = useCallback((docId: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  }, []);

  const [exportFormat, setExportFormat] = useState<"png" | "svg">("png");

  const handleExport = useCallback(async () => {
    const api = excalidrawApiRef.current;
    if (!api) return;
    try {
      if (exportFormat === "svg") {
        const svg = await api.exportToSvg();
        const svgStr = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([svgStr], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${docName}.svg`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = await api.exportToBlob({
          mimeType: "image/png",
          quality: 1,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${docName}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Export failed:", err);
    }
  }, [docName, exportFormat]);

  if (!ExcalidrawComp || initialData === undefined) {
    return (
      <div className="editor-loading">
        <div className="editor-loading__spinner" />
        Loading Excalidraw...
      </div>
    );
  }

  const excalidrawProps: any = {};
  const libraryItems = LIBRARY_PRESETS;
  if (initialData) {
    excalidrawProps.initialData = {
      elements: initialData.elements || [],
      appState: initialData.appState || {},
      libraryItems,
    };
  } else {
    excalidrawProps.initialData = { libraryItems };
  }

  const editorBody = (
    <>
      {flowchartOpen && (
        <div
          className={`flowchart-panel${isMobile ? " flowchart-panel--mobile-overlay" : ""}`}
        >
          <div className="flowchart-panel__header">
            <h4>Generate Flowchart from Documents</h4>
            <button
              className="flowchart-panel__close"
              onClick={() => setFlowchartOpen(false)}
            >
              &times;
            </button>
          </div>
          <p className="flowchart-panel__hint">
            Select documents to visualize as a flowchart. Markdown headings
            become sections, Kanban columns become groups.
          </p>
          <div className="flowchart-panel__list">
            {allDocs
              .filter((d) => d.id !== documentId)
              .map((doc) => (
                <label key={doc.id} className="flowchart-panel__item">
                  <input
                    type="checkbox"
                    checked={selectedDocIds.has(doc.id)}
                    onChange={() => toggleDocSelection(doc.id)}
                  />
                  <span className="flowchart-panel__name">{doc.name}</span>
                  <span className="flowchart-panel__type">{doc.type}</span>
                </label>
              ))}
            {allDocs.filter((d) => d.id !== documentId).length === 0 && (
              <div className="flowchart-panel__empty">
                No other documents found. Create some documents first!
              </div>
            )}
          </div>
          <button
            className="flowchart-panel__generate"
            disabled={selectedDocIds.size === 0 || generating}
            onClick={handleGenerateFlowchart}
          >
            {generating
              ? "Generating..."
              : `Generate from ${selectedDocIds.size} document${selectedDocIds.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}
      <div style={{ width: "100%", height: "100%", touchAction: "none" }}>
        <ExcalidrawComp
          onChange={handleChange}
          excalidrawAPI={handleExcalidrawApi}
          theme="dark"
          {...excalidrawProps}
        />
      </div>
    </>
  );

  if (isMobile) {
    return <div className="excalidraw-mobile-host">{editorBody}</div>;
  }

  return (
    <EditorShell
      documentId={documentId}
      adapter={adapter}
      saveStatus={saveStatus}
      mobileImmersive
      onExport={handleExport}
      exportLabel={exportFormat === "svg" ? "Export SVG" : "Export PNG"}
      exportExtra={
        <>
          <select
            className="export-format-select"
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as "png" | "svg")}
          >
            <option value="png">PNG</option>
            <option value="svg">SVG</option>
          </select>
          <button
            className={`editor-topbar-btn${flowchartOpen ? " editor-topbar-btn--active" : ""}`}
            onClick={() => setFlowchartOpen((v) => !v)}
            title="Generate flowchart from documents"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="1" y="1" width="5" height="4" rx="1" />
              <rect x="10" y="1" width="5" height="4" rx="1" />
              <rect x="5.5" y="11" width="5" height="4" rx="1" />
              <path d="M3.5 5v3h4.5v3M12.5 5v3H8v3" />
            </svg>
            <span>Flowchart</span>
          </button>
        </>
      }
    >
      {editorBody}
    </EditorShell>
  );
}
