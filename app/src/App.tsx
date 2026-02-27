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
import { LoginPage } from "./components/LoginPage";
import { ConfirmProvider } from "./components/ConfirmDialog";
import { QuickSwitcher } from "./components/QuickSwitcher";
import { setLinkingEnabled } from "./components/DocumentLink";

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

export interface AppConfig {
  enableTldraw: boolean;
  enableLinking: boolean;
  storageBackend: string;
  isElectron: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  enableTldraw: false,
  enableLinking: false,
  storageBackend: "local",
  isElectron: false,
};

function App() {
  const [authState, setAuthState] = useState<
    "checking" | "login" | "authenticated"
  >("checking");
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    const token = localStorage.getItem("drawbook_token") || "";

    const authCheck = fetch("/api/auth/check", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then((r) => r.json());

    const configCheck = fetch("/api/config")
      .then((r) => r.json())
      .catch(() => DEFAULT_CONFIG);

    Promise.all([authCheck, configCheck])
      .then(([authData, configData]) => {
        setConfig(configData);
        setLinkingEnabled(!!configData.enableLinking);
        if (!authData.required || authData.authenticated) {
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
      <AppRouter config={config} />
    </ConfirmProvider>
  );
}

function AppRouter({ config }: { config: AppConfig }) {
  const urlParams = new URLSearchParams(window.location.search);
  const documentId = urlParams.get("doc");
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

  if (!documentId) {
    return (
      <>
        <QuickSwitcher folders={qsFolders} />
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
      <QuickSwitcher folders={qsFolders} />
      {editorView}
    </>
  );
}

export default App;
