import { useEffect, useState } from "react";
import { TldrawEditor } from "./components/TldrawEditor";
import { ExcalidrawEditor } from "./components/ExcalidrawEditor";
import { DrawioEditor } from "./components/DrawioEditor";
import { MarkdownEditor } from "./components/MarkdownEditor";
import { PdfViewer } from "./components/PdfViewer";
import { SpreadsheetEditor } from "./components/SpreadsheetEditor";
import { KanbanEditor } from "./components/KanbanEditor";
import { CodeEditor } from "./components/CodeEditor";
import { GridEditor } from "./components/GridEditor";
import { Dashboard } from "./components/Dashboard";
import { CommandPalette, pushRecentDoc } from "./components/CommandPalette";
import type { AppConfig } from "./App";

type DocumentType =
  | "tldraw"
  | "excalidraw"
  | "drawio"
  | "markdown"
  | "pdf"
  | "spreadsheet"
  | "kanban"
  | "code"
  | "grid";

function typeFromId(id: string): DocumentType {
  if (id.startsWith("excalidraw-")) return "excalidraw";
  if (id.startsWith("drawio-")) return "drawio";
  if (id.startsWith("markdown-")) return "markdown";
  if (id.startsWith("pdf-")) return "pdf";
  if (id.startsWith("spreadsheet-")) return "spreadsheet";
  if (id.startsWith("kanban-")) return "kanban";
  if (id.startsWith("code-")) return "code";
  if (id.startsWith("grid-")) return "grid";
  return "tldraw";
}

function SharedDocumentViewer() {
  const urlParams = new URLSearchParams(window.location.search);
  const sharedToken = urlParams.get("shared")!;
  const [sharedMeta, setSharedMeta] = useState<{
    type: string;
    name: string;
    permission: string;
    sharedBy: string;
    documentId: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/shared/${sharedToken}/meta`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => setSharedMeta(data))
      .catch(() => setError("This share link is invalid or has expired."))
      .finally(() => setLoading(false));
  }, [sharedToken]);

  if (loading) {
    return (
      <div className="editor-loading">
        <div className="editor-loading__spinner" />
        Loading shared document...
      </div>
    );
  }

  if (error || !sharedMeta) {
    return (
      <div className="editor-loading">
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <h2 style={{ margin: "0 0 8px" }}>Shared Document</h2>
          <p style={{ opacity: 0.7, margin: 0 }}>
            {error || "Document not found"}
          </p>
          <a
            href="/"
            style={{
              display: "inline-block",
              marginTop: 16,
              color: "var(--accent)",
            }}
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-loading">
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <h2 style={{ margin: "0 0 8px" }}>
          {sharedMeta.name || "Shared Document"}
        </h2>
        <p style={{ opacity: 0.7, margin: "0 0 4px" }}>
          Shared by {sharedMeta.sharedBy} ({sharedMeta.permission} access)
        </p>
        <p style={{ opacity: 0.5, margin: 0, fontSize: 13 }}>
          Type: {sharedMeta.type}
        </p>
      </div>
    </div>
  );
}

export function AppRouter({ config }: { config: AppConfig }) {
  const urlParams = new URLSearchParams(window.location.search);
  const documentId = urlParams.get("doc");
  const sharedToken = urlParams.get("shared");
  const folderId = urlParams.get("folder") ?? undefined;
  const urlType = urlParams.get("type") as DocumentType | null;

  const [resolvedType, setResolvedType] = useState<DocumentType | null>(
    urlType,
  );
  const [loading, setLoading] = useState(!urlType && !!documentId);
  const [qsFolders, setQsFolders] = useState<
    Array<{ id: string; name: string; parentId: string | null }>
  >([]);

  useEffect(() => {
    fetch("/api/folders")
      .then((r) => r.json())
      .then((data) => setQsFolders(data.folders || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!documentId || urlType) return;

    fetch(`/api/meta/${documentId}`)
      .then((r) => r.json())
      .then((data) => setResolvedType(data.type || typeFromId(documentId)))
      .catch(() => setResolvedType(typeFromId(documentId)))
      .finally(() => setLoading(false));
  }, [documentId, urlType]);

  // Track recently opened documents
  useEffect(() => {
    if (!documentId) return;
    const type = resolvedType || urlType || typeFromId(documentId);
    fetch(`/api/meta/${documentId}`)
      .then((r) => r.json())
      .then((meta) => {
        pushRecentDoc({
          id: documentId,
          name: meta.name || documentId,
          type,
        });
      })
      .catch(() => {
        pushRecentDoc({ id: documentId, name: documentId, type });
      });
  }, [documentId, resolvedType, urlType]);

  if (sharedToken) {
    return <SharedDocumentViewer />;
  }

  if (!documentId) {
    return (
      <>
        <CommandPalette folders={qsFolders} context="dashboard" />
        <Dashboard config={config} />
      </>
    );
  }

  if (loading) {
    return (
      <div className="editor-loading">
        <div className="editor-loading__spinner" />
        Loading...
      </div>
    );
  }

  const docType = resolvedType || typeFromId(documentId);

  const editorView = (() => {
    switch (docType) {
      case "excalidraw":
        return <ExcalidrawEditor documentId={documentId} />;
      case "drawio":
        return <DrawioEditor documentId={documentId} />;
      case "markdown":
        return <MarkdownEditor documentId={documentId} />;
      case "pdf":
        return <PdfViewer documentId={documentId} />;
      case "spreadsheet":
        return <SpreadsheetEditor documentId={documentId} />;
      case "kanban":
        return <KanbanEditor documentId={documentId} />;
      case "code":
        return <CodeEditor documentId={documentId} />;
      case "grid":
        return <GridEditor documentId={documentId} />;
      default:
        if (!config.enableTldraw) {
          return (
            <div className="editor-loading">
              <div style={{ textAlign: "center", maxWidth: 420 }}>
                <h2 style={{ margin: "0 0 8px" }}>tldraw is disabled</h2>
                <p style={{ opacity: 0.7, margin: 0 }}>
                  Set <code>ENABLE_TLDRAW=true</code> in your <code>.env</code>{" "}
                  file and restart the server to use the tldraw editor. A tldraw
                  license key is required for production use.
                </p>
                <a
                  href="/"
                  style={{
                    display: "inline-block",
                    marginTop: 16,
                    color: "var(--accent)",
                  }}
                >
                  Back to Dashboard
                </a>
              </div>
            </div>
          );
        }
        return (
          <TldrawEditor documentId={documentId} initialFolderId={folderId} />
        );
    }
  })();

  return (
    <>
      <CommandPalette
        folders={qsFolders}
        context="editor"
        currentDocId={documentId}
      />
      {editorView}
    </>
  );
}
