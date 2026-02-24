import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { EditorShell } from "./EditorShell";
import {
  Tldraw,
  Editor,
  TLStoreSnapshot,
  createTLStore,
  defaultShapeUtils,
  TLRecord,
} from "tldraw";
import { createTldrawAdapter } from "./ai/EditorAdapter";
import type { EditorAdapter } from "./ai/EditorAdapter";
import { PreviewShapeUtil } from "./ai/PreviewShape";
import { MakeRealButton } from "./ai/MakeRealButton";

const customShapeUtils = [...defaultShapeUtils, PreviewShapeUtil];

interface TldrawEditorProps {
  documentId: string;
  initialFolderId?: string;
}

export function TldrawEditor({
  documentId,
  initialFolderId,
}: TldrawEditorProps) {
  const [initialSnapshot, setInitialSnapshot] = useState<
    TLStoreSnapshot | null | undefined
  >(undefined);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    "saved" | "saving" | "error" | "syncing"
  >("saved");
  const [adapter, setAdapter] = useState<EditorAdapter | null>(null);
  const [docName, setDocName] = useState("drawing");
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem("drawbook-tldraw-dark") !== "false";
    } catch {
      return true;
    }
  });
  const wsRef = useRef<WebSocket | null>(null);
  const isRemoteChange = useRef(false);
  const lastActiveTime = useRef<number>(Date.now());
  const initialSaveDone = useRef(false);

  const reloadFromServer = useCallback(async () => {
    if (!editor) return;

    try {
      const response = await fetch(`/api/load/${documentId}`);
      const data = await response.json();

      if (data.snapshot) {
        isRemoteChange.current = true;
        editor.store.loadSnapshot(data.snapshot);
        isRemoteChange.current = false;
        console.log(
          "[Sync] Reloaded document from server after inactive session",
        );
      }
    } catch (error) {
      console.error("Failed to reload document:", error);
    }
  }, [editor, documentId]);

  useEffect(() => {
    if (!editor) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const inactiveTime = Date.now() - lastActiveTime.current;
        if (inactiveTime > 5000) {
          reloadFromServer();
        }
        if (wsRef.current && wsRef.current.readyState !== WebSocket.OPEN) {
          window.location.reload();
        }
      } else {
        lastActiveTime.current = Date.now();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [editor, reloadFromServer]);

  useEffect(() => {
    async function loadDocument() {
      try {
        const response = await fetch(`/api/load/${documentId}`);
        const data = await response.json();
        setInitialSnapshot(data.snapshot || null);
      } catch (error) {
        console.error("Failed to load document:", error);
        setInitialSnapshot(null);
      }
    }
    loadDocument();
  }, [documentId]);

  const store = useMemo(() => {
    if (initialSnapshot === undefined) return undefined;

    const newStore = createTLStore({ shapeUtils: customShapeUtils });
    if (initialSnapshot) {
      newStore.loadSnapshot(initialSnapshot);
    }
    return newStore;
  }, [initialSnapshot]);

  useEffect(() => {
    if (!editor) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const token = localStorage.getItem("drawbook_token") || "";
    const wsUrl = `${protocol}//${window.location.host}/ws?doc=${documentId}${token ? `&token=${token}` : ""}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[Sync] Connected to sync server");
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === "changes") {
          isRemoteChange.current = true;

          const { added, updated, removed } = message.changes;

          editor.store.mergeRemoteChanges(() => {
            if (removed && Object.keys(removed).length > 0) {
              const idsToRemove = Object.keys(removed) as TLRecord["id"][];
              editor.store.remove(idsToRemove);
            }
            if (added && Object.keys(added).length > 0) {
              editor.store.put(Object.values(added) as TLRecord[]);
            }
            if (updated && Object.keys(updated).length > 0) {
              const updates = Object.values(updated).map((u: any) => u[1]);
              editor.store.put(updates as TLRecord[]);
            }
          });

          isRemoteChange.current = false;
        }
      } catch (error) {
        console.error("[Sync] Failed to parse message:", error);
      }
    };

    ws.onclose = () => {
      console.log("[Sync] Disconnected from sync server");
    };

    ws.onerror = (error) => {
      console.error("[Sync] WebSocket error:", error);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [editor, documentId]);

  useEffect(() => {
    if (!editor || !wsRef.current) return;

    const unsubscribe = editor.store.listen(
      (entry) => {
        if (isRemoteChange.current) return;

        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          const message = {
            type: "changes",
            changes: entry.changes,
          };
          ws.send(JSON.stringify(message));
        }
      },
      { scope: "document", source: "user" },
    );

    return () => {
      unsubscribe();
    };
  }, [editor]);

  const saveDocument = useCallback(
    async (editorInstance: Editor, options?: { includeFolder?: boolean }) => {
      setSaveStatus("saving");
      try {
        const snapshot = editorInstance.store.getSnapshot();
        const payload: { snapshot: TLStoreSnapshot; folderId?: string } = {
          snapshot,
        };
        if (options?.includeFolder && initialFolderId) {
          payload.folderId = initialFolderId;
        }
        const response = await fetch(`/api/save/${documentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          setSaveStatus("saved");
        } else {
          setSaveStatus("error");
        }
      } catch (error) {
        console.error("Failed to save document:", error);
        setSaveStatus("error");
      }
    },
    [documentId, initialFolderId],
  );

  useEffect(() => {
    if (!editor || initialSnapshot === undefined || initialSaveDone.current)
      return;
    if (initialSnapshot === null) {
      initialSaveDone.current = true;
      saveDocument(editor, { includeFolder: true });
    }
  }, [editor, initialSnapshot, saveDocument]);

  useEffect(() => {
    initialSaveDone.current = false;
  }, [documentId]);

  useEffect(() => {
    if (!editor) return;

    let saveTimeout: NodeJS.Timeout | null = null;

    const unsubscribe = editor.store.listen(
      () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          saveDocument(editor);
        }, 2000);
      },
      { scope: "document", source: "user" },
    );

    return () => {
      unsubscribe();
      if (saveTimeout) clearTimeout(saveTimeout);
    };
  }, [editor, saveDocument]);

  useEffect(() => {
    fetch(`/api/meta/${documentId}`)
      .then((r) => r.json())
      .then((meta) => {
        if (meta.name) setDocName(meta.name);
      })
      .catch(() => {});
  }, [documentId]);

  const handleExport = useCallback(async () => {
    if (!editor) return;
    try {
      const result = await editor.getSvgString([
        ...editor.getCurrentPageShapeIds(),
      ]);
      if (!result) return;
      const blob = new Blob([result.svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${docName}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("SVG export failed:", err);
    }
  }, [editor, docName]);

  const handleMount = useCallback(
    (editorInstance: Editor) => {
      setEditor(editorInstance);
      setAdapter(createTldrawAdapter(editorInstance));
      editorInstance.user.updateUserPreferences({
        colorScheme: isDark ? "dark" : "light",
      });
    },
    [isDark],
  );

  useEffect(() => {
    if (!editor) return;
    editor.user.updateUserPreferences({
      colorScheme: isDark ? "dark" : "light",
    });
    try {
      localStorage.setItem("drawbook-tldraw-dark", String(isDark));
    } catch {}
  }, [editor, isDark]);

  if (store === undefined) {
    return (
      <div className="editor-loading">
        <div className="editor-loading__spinner" />
        Loading canvas...
      </div>
    );
  }

  return (
    <EditorShell
      documentId={documentId}
      adapter={adapter}
      saveStatus={saveStatus}
      onExport={handleExport}
      exportLabel="Export SVG"
    >
      <Tldraw
        store={store}
        onMount={handleMount}
        autoFocus
        shapeUtils={[PreviewShapeUtil]}
      >
        <MakeRealButton />
        <div className="tldraw-theme-toggle">
          <button
            className="tldraw-theme-toggle__btn"
            onClick={() => setIsDark((v) => !v)}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? "☀️" : "🌙"}
          </button>
        </div>
      </Tldraw>
    </EditorShell>
  );
}
