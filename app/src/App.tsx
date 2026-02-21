import { useEffect, useState } from "react";
import { TldrawEditor } from "./components/TldrawEditor";
import { ExcalidrawEditor } from "./components/ExcalidrawEditor";
import { DrawioEditor } from "./components/DrawioEditor";
import { MarkdownEditor } from "./components/MarkdownEditor";
import { PdfViewer } from "./components/PdfViewer";
import { Dashboard } from "./components/Dashboard";

type DocumentType = "tldraw" | "excalidraw" | "drawio" | "markdown" | "pdf";

function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const documentId = urlParams.get("doc");
  const folderId = urlParams.get("folder") ?? undefined;
  const urlType = urlParams.get("type") as DocumentType | null;

  const [resolvedType, setResolvedType] = useState<DocumentType | null>(
    urlType,
  );
  const [loading, setLoading] = useState(!urlType && !!documentId);

  useEffect(() => {
    if (!documentId || urlType) return;

    fetch(`/api/meta/${documentId}`)
      .then((r) => r.json())
      .then((data) => setResolvedType(data.type || "tldraw"))
      .catch(() => setResolvedType("tldraw"))
      .finally(() => setLoading(false));
  }, [documentId, urlType]);

  if (!documentId) {
    return <Dashboard />;
  }

  if (loading) {
    return (
      <div className="editor-loading">
        <div className="editor-loading__spinner" />
        Loading...
      </div>
    );
  }

  const docType = resolvedType || "tldraw";

  switch (docType) {
    case "excalidraw":
      return <ExcalidrawEditor documentId={documentId} />;
    case "drawio":
      return <DrawioEditor documentId={documentId} />;
    case "markdown":
      return <MarkdownEditor documentId={documentId} />;
    case "pdf":
      return <PdfViewer documentId={documentId} />;
    default:
      return (
        <div style={{ width: "100%", height: "100%" }}>
          <TldrawEditor documentId={documentId} initialFolderId={folderId} />
        </div>
      );
  }
}

export default App;
