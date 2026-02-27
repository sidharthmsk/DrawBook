import { useState, useEffect } from "react";
import { EditableTitle } from "./EditableTitle";
import { AiChatPanel } from "./ai/AiChatPanel";
import type { EditorAdapter } from "./ai/EditorAdapter";
import { useIsMobile } from "../hooks/useIsMobile";
import { openCommandPalette } from "./CommandPalette";
import { ShareModal } from "./ShareModal";
import { useConfirm } from "./ConfirmDialog";
import { MobileOverflowMenu } from "./MobileOverflowMenu";
import { EditorVersionBar } from "./EditorVersionBar";
import { EditorInfoBar, type DocMeta } from "./EditorInfoBar";
import { EditorTaskPopover } from "./EditorTaskPopover";

interface EditorShellProps {
  documentId: string;
  adapter: EditorAdapter | null;
  saveStatus: "saved" | "saving" | "error" | "syncing";
  children: React.ReactNode;
  contentClassName?: string;
  onExport?: () => void;
  exportLabel?: string;
  exportExtra?: React.ReactNode;
  mobileImmersive?: boolean;
}

export function EditorShell({
  documentId,
  adapter,
  saveStatus,
  children,
  contentClassName,
  onExport,
  exportLabel,
  exportExtra,
  mobileImmersive = false,
}: EditorShellProps) {
  const isMobile = useIsMobile();
  const immersiveMobile = isMobile && mobileImmersive;
  const confirm = useConfirm();
  const [aiOpen, setAiOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [isMultiUser, setIsMultiUser] = useState(false);
  const [versions, setVersions] = useState<
    Array<{ index: number; timestamp: string }>
  >([]);
  const [docMeta, setDocMeta] = useState<DocMeta | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<
    Array<{ id: string | null; name: string }>
  >([]);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => setIsMultiUser(!!data.multiUser))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "a"
      ) {
        e.preventDefault();
        setAiOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Listen for command palette actions
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.action) return;

      switch (detail.action) {
        case "toggleAi":
          setAiOpen((v) => !v);
          break;
        case "info":
          setInfoOpen((v) => !v);
          break;
        case "history":
          setVersionOpen((v) => {
            if (!v) {
              fetch(`/api/versions/${documentId}`)
                .then((r) => r.json())
                .then((data) => setVersions(data.versions || []))
                .catch(() => {});
            }
            return !v;
          });
          break;
        case "template": {
          setTemplateSaving(true);
          const name = window.prompt("Template name:");
          if (!name?.trim()) {
            setTemplateSaving(false);
            return;
          }
          fetch(`/api/templates/from-doc/${documentId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim() }),
          })
            .catch((err) => console.error("Save as template failed:", err))
            .finally(() => setTemplateSaving(false));
          break;
        }
        case "delete": {
          const ok = await confirm({
            message: "Delete this document? It will be moved to trash.",
            confirmLabel: "Delete",
            danger: true,
          });
          if (ok) {
            fetch(`/api/delete/${documentId}`, { method: "DELETE" })
              .then(() => {
                window.location.href = "/";
              })
              .catch((err) => console.error("Delete failed:", err));
          }
          break;
        }
        case "move": {
          const folderId = window.prompt(
            "Enter folder ID to move to (or leave empty for root):",
          );
          if (folderId === null) return;
          fetch(`/api/documents/${documentId}/move`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folderId: folderId.trim() || null }),
          }).catch((err) => console.error("Move failed:", err));
          break;
        }
      }
    };
    document.addEventListener("command-palette-action", handler);
    return () =>
      document.removeEventListener("command-palette-action", handler);
  }, [documentId, confirm]);

  useEffect(() => {
    async function loadBreadcrumbs() {
      try {
        const metaRes = await fetch(`/api/meta/${documentId}`);
        const meta = await metaRes.json();
        setDocMeta(meta);
        const crumbs: Array<{ id: string | null; name: string }> = [
          { id: null, name: "Home" },
        ];
        if (meta.folderId) {
          const foldersRes = await fetch("/api/folders");
          const foldersData = await foldersRes.json();
          const folders = foldersData.folders || [];
          const chain: Array<{ id: string; name: string }> = [];
          let cur = meta.folderId;
          while (cur) {
            const f = folders.find((fo: any) => fo.id === cur);
            if (!f) break;
            chain.unshift({ id: f.id, name: f.name });
            cur = f.parentId;
          }
          crumbs.push(...chain);
        }
        setBreadcrumbs(crumbs);
      } catch {}
    }
    loadBreadcrumbs();
  }, [documentId]);

  const statusLabel =
    saveStatus === "saved"
      ? "Saved"
      : saveStatus === "saving"
        ? "Saving..."
        : saveStatus === "syncing"
          ? "Syncing..."
          : "Error";
  const dotClass =
    saveStatus === "error"
      ? "error"
      : saveStatus === "saved"
        ? "saved"
        : "saving";

  const infoButton = (
    <button
      className={`editor-export-btn${infoOpen ? " editor-export-btn--active" : ""}`}
      onClick={() => setInfoOpen((v) => !v)}
      title="Document Info"
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
        <circle cx="8" cy="8" r="6" />
        <path d="M8 7v4M8 5.5v0" />
      </svg>
      <span>Info</span>
    </button>
  );

  const historyButton = (
    <button
      className={`editor-topbar-btn${versionOpen ? " editor-topbar-btn--active" : ""}`}
      onClick={() => {
        setVersionOpen((v) => !v);
        if (!versionOpen) {
          fetch(`/api/versions/${documentId}`)
            .then((r) => r.json())
            .then((data) => setVersions(data.versions || []))
            .catch(() => {});
        }
      }}
      title="Version history"
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
        <circle cx="8" cy="8" r="6" />
        <path d="M8 5v3l2 2" />
      </svg>
      <span>History</span>
    </button>
  );

  const exportButton = onExport ? (
    <button
      className="editor-export-btn"
      onClick={onExport}
      title={exportLabel || "Export"}
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
        <path d="M8 2v9M4 8l4 4 4-4M2 14h12" />
      </svg>
      <span>{exportLabel || "Export"}</span>
    </button>
  ) : null;

  const templateButton = (
    <button
      className="editor-export-btn"
      disabled={templateSaving}
      onClick={async () => {
        setTemplateSaving(true);
        try {
          const name = window.prompt("Template name:");
          if (!name?.trim()) return;
          const res = await fetch(`/api/templates/from-doc/${documentId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim() }),
          });
          if (!res.ok) throw new Error("Save failed");
        } catch (err) {
          console.error("Save as template failed:", err);
        } finally {
          setTemplateSaving(false);
        }
      }}
      title="Save as Template"
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
        <rect x="2" y="2" width="12" height="12" rx="1" />
        <path d="M5 2v5l2.5-1.5L10 7V2" />
      </svg>
      <span>{templateSaving ? "Saving..." : "Template"}</span>
    </button>
  );

  const shareButton = isMultiUser ? (
    <button
      className="editor-export-btn"
      onClick={() => setShareOpen(true)}
      title="Share document"
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
        <circle cx="12" cy="3" r="2" />
        <circle cx="12" cy="13" r="2" />
        <circle cx="4" cy="8" r="2" />
        <path d="M6 9l4 3M6 7l4-3" />
      </svg>
      <span>Share</span>
    </button>
  ) : null;

  const paletteButton = (
    <button
      className="editor-topbar-btn"
      onClick={() => openCommandPalette("actions")}
      title="Command Palette"
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
        <path d="M6 4l4 4-4 4" />
        <rect x="1" y="1" width="14" height="14" rx="3" />
      </svg>
      <span className="editor-topbar__btn-label">Actions</span>
    </button>
  );

  const aiToggle = adapter ? (
    <button
      className={`ai-toggle-btn${aiOpen ? " ai-toggle-btn--active" : ""}`}
      onClick={() => setAiOpen((v) => !v)}
      title="Toggle AI Assistant"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
        <path d="M18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
      </svg>
      <span className="editor-topbar__btn-label">AI</span>
    </button>
  ) : null;

  return (
    <div
      className={`editor-wrapper${immersiveMobile ? " editor-wrapper--mobile-immersive" : ""}`}
    >
      {!immersiveMobile && (
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
            <span className="editor-topbar__btn-label">Back</span>
          </button>
          {!isMobile && breadcrumbs.length > 0 && (
            <nav className="editor-breadcrumbs">
              {breadcrumbs.map((crumb, i) => (
                <span key={crumb.id ?? "home"}>
                  {i > 0 && <span className="editor-breadcrumbs__sep">/</span>}
                  <a
                    className="editor-breadcrumbs__link"
                    href={crumb.id ? `/?folder=${crumb.id}` : "/"}
                  >
                    {crumb.name}
                  </a>
                </span>
              ))}
              <span className="editor-breadcrumbs__sep">/</span>
            </nav>
          )}
          <EditableTitle documentId={documentId} />
          <div className="editor-topbar__right">
            <div className="editor-topbar__status">
              <span
                className={`editor-status-dot editor-status-dot--${dotClass}`}
              />
              <span className="editor-topbar__status-label">{statusLabel}</span>
            </div>
            {isMobile ? (
              <>
                {paletteButton}
                <MobileOverflowMenu>
                  {infoButton}
                  {historyButton}
                  {exportButton}
                  {exportExtra}
                  {templateButton}
                  <EditorTaskPopover documentId={documentId} />
                  {shareButton}
                </MobileOverflowMenu>
                {aiToggle}
              </>
            ) : (
              <>
                {infoButton}
                {historyButton}
                {exportButton}
                {exportExtra}
                {templateButton}
                <EditorTaskPopover documentId={documentId} />
                {shareButton}
                {paletteButton}
                {aiToggle}
              </>
            )}
          </div>
        </div>
      )}
      {!immersiveMobile && infoOpen && <EditorInfoBar docMeta={docMeta} />}
      {!immersiveMobile && versionOpen && (
        <EditorVersionBar versions={versions} documentId={documentId} />
      )}
      <div className="editor-content">
        <div className={contentClassName || "editor-canvas"}>{children}</div>
        {!isMobile && aiOpen && adapter && (
          <AiChatPanel
            adapter={adapter}
            onClose={() => setAiOpen(false)}
            documentId={documentId}
          />
        )}
      </div>
      {isMobile && aiOpen && adapter && (
        <div className="ai-mobile-overlay">
          <AiChatPanel
            adapter={adapter}
            onClose={() => setAiOpen(false)}
            documentId={documentId}
            fullScreen
          />
        </div>
      )}
      {shareOpen && (
        <ShareModal
          documentId={documentId}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
