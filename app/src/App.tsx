import { useEffect, useState } from "react";
import { TldrawEditor } from "./components/TldrawEditor";
import { ExcalidrawEditor } from "./components/ExcalidrawEditor";
import { DrawioEditor } from "./components/DrawioEditor";
import { MarkdownEditor } from "./components/MarkdownEditor";
import { PdfViewer } from "./components/PdfViewer";
import { SpreadsheetEditor } from "./components/SpreadsheetEditor";
import { KanbanEditor } from "./components/KanbanEditor";
import { Dashboard } from "./components/Dashboard";
import { LoginPage } from "./components/LoginPage";
import { ConfirmProvider } from "./components/ConfirmDialog";

type DocumentType =
  | "tldraw"
  | "excalidraw"
  | "drawio"
  | "markdown"
  | "pdf"
  | "spreadsheet"
  | "kanban";

function typeFromId(id: string): DocumentType {
  if (id.startsWith("excalidraw-")) return "excalidraw";
  if (id.startsWith("drawio-")) return "drawio";
  if (id.startsWith("markdown-")) return "markdown";
  if (id.startsWith("pdf-")) return "pdf";
  if (id.startsWith("spreadsheet-")) return "spreadsheet";
  if (id.startsWith("kanban-")) return "kanban";
  return "tldraw";
}

function injectAuthFetch(token: string) {
  if ((window as any).__authFetchPatched) return;
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input instanceof Request
            ? input.url
            : "";
    if (url.startsWith("/api/") && !url.includes("/api/auth/")) {
      init = init || {};
      const headers = new Headers(init.headers);
      if (!headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      init.headers = headers;
    }
    return originalFetch.call(this, input, init);
  };
  (window as any).__authFetchPatched = true;
}

export function getAuthToken(): string {
  return localStorage.getItem("drawbook_token") || "";
}

function App() {
  const [authState, setAuthState] = useState<
    "checking" | "login" | "authenticated"
  >("checking");

  useEffect(() => {
    const token = localStorage.getItem("drawbook_token") || "";
    fetch("/api/auth/check", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.required || data.authenticated) {
          if (token) injectAuthFetch(token);
          setAuthState("authenticated");
        } else {
          setAuthState("login");
        }
      })
      .catch(() => setAuthState("login"));
  }, []);

  const handleLogin = (token: string) => {
    if (token) injectAuthFetch(token);
    setAuthState("authenticated");
  };

  if (authState === "checking") {
    return (
      <div className="editor-loading">
        <div className="editor-loading__spinner" />
      </div>
    );
  }

  if (authState === "login") {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <ConfirmProvider>
      <AppRouter />
    </ConfirmProvider>
  );
}

function AppRouter() {
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
      .then((data) => setResolvedType(data.type || typeFromId(documentId)))
      .catch(() => setResolvedType(typeFromId(documentId)))
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

  const docType = resolvedType || typeFromId(documentId);

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
    default:
      return (
        <TldrawEditor documentId={documentId} initialFolderId={folderId} />
      );
  }
}

export default App;
