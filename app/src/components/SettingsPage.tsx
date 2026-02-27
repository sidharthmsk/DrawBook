import { useCallback, useEffect, useRef, useState } from "react";
import { useConfirm } from "./ConfirmDialog";

interface SettingsData {
  appPassword: string;
  enableTldraw: string;
  enableLinking: string;
  corsOrigins: string;
  storageBackend: string;
  minioEndpointUrl: string;
  minioAccessKey: string;
  minioSecretKey: string;
  minioBucket: string;
  minioRegion: string;
  minioPrefix: string;
  groqApiKey: string;
  hasPassword: boolean;
  hasGroqKey: boolean;
  hasMinioCredentials: boolean;
}

export function SettingsPage({
  onClose,
  isElectron,
}: {
  onClose: () => void;
  isElectron?: boolean;
}) {
  const confirm = useConfirm();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Editable fields
  const [corsOrigins, setCorsOrigins] = useState("");
  const [enableTldraw, setEnableTldraw] = useState(false);
  const [enableLinking, setEnableLinking] = useState(false);
  const [storageBackend, setStorageBackend] = useState("local");
  const [minioEndpointUrl, setMinioEndpointUrl] = useState("");
  const [minioAccessKey, setMinioAccessKey] = useState("");
  const [minioSecretKey, setMinioSecretKey] = useState("");
  const [minioBucket, setMinioBucket] = useState("");
  const [minioRegion, setMinioRegion] = useState("");
  const [minioPrefix, setMinioPrefix] = useState("");
  const [groqApiKey, setGroqApiKey] = useState("");

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [dirty, setDirty] = useState(false);
  const [passwordDirty, setPasswordDirty] = useState(false);

  const [obsidianImporting, setObsidianImporting] = useState(false);
  const [obsidianImportResult, setObsidianImportResult] = useState<{
    imported: number;
    skipped: number;
    folders: number;
  } | null>(null);
  const obsidianFileRef = useRef<HTMLInputElement>(null);

  const [templates, setTemplates] = useState<
    Array<{ id: string; name: string; type: string; createdAt: string }>
  >([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      const data: SettingsData = await res.json();
      setSettings(data);
      setCorsOrigins(data.corsOrigins || "");
      setEnableTldraw(data.enableTldraw === "true");
      setEnableLinking(data.enableLinking === "true");
      setStorageBackend(data.storageBackend || "local");
      setMinioEndpointUrl(data.minioEndpointUrl || "");
      setMinioAccessKey(data.minioAccessKey || "");
      setMinioSecretKey(data.minioSecretKey || "");
      setMinioBucket(data.minioBucket || "drawbook");
      setMinioRegion(data.minioRegion || "us-east-1");
      setMinioPrefix(data.minioPrefix || "");
      setGroqApiKey(data.groqApiKey || "");
    } catch (err) {
      setError("Failed to load settings");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const pollHealth = useCallback(async () => {
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          setRestarting(false);
          window.location.reload();
          return;
        }
      } catch {
        // server still down
      }
    }
    setRestarting(false);
    setError(
      "Server did not restart in time. Please check the server manually.",
    );
  }, []);

  const handleSave = async () => {
    setError("");
    setSuccessMsg("");
    setSaving(true);

    try {
      const body: Record<string, unknown> = {
        corsOrigins,
        enableTldraw: enableTldraw ? "true" : "false",
        enableLinking: enableLinking ? "true" : "false",
        storageBackend,
        minioEndpointUrl,
        minioAccessKey,
        minioSecretKey,
        minioBucket,
        minioRegion,
        minioPrefix,
        groqApiKey,
      };

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      const data = await res.json();
      setDirty(false);

      if (data.restart) {
        setRestarting(true);
        pollHealth();
      } else {
        setSuccessMsg("Settings saved.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSave = async () => {
    setError("");
    setSuccessMsg("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (!newPassword) {
      setError("New password cannot be empty.");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        appPassword: newPassword,
        currentPassword: currentPassword,
      };

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to change password");
      }

      const data = await res.json();
      setPasswordDirty(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      if (data.restart) {
        setRestarting(true);
        pollHealth();
      } else {
        setSuccessMsg("Password updated.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  const markDirty = () => setDirty(true);

  const handleObsidianImport = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setObsidianImporting(true);
    setObsidianImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import/obsidian", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Import failed");
      }
      const data = await res.json();
      setObsidianImportResult({
        imported: data.imported,
        skipped: data.skipped,
        folders: data.folders,
      });
    } catch (err) {
      console.error("Obsidian import failed:", err);
      setObsidianImportResult(null);
    } finally {
      setObsidianImporting(false);
    }
    if (e.target) e.target.value = "";
  };

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      setTemplates(data.templates || []);
      setTemplatesLoaded(true);
    } catch (err) {
      console.error("Failed to load templates:", err);
    }
  }, []);

  const deleteTemplate = async (templateId: string) => {
    if (!(await confirm({ message: "Delete this template?", danger: true })))
      return;
    try {
      const res = await fetch(`/api/templates/${templateId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete template failed");
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  };

  const useTemplate = async (templateId: string) => {
    try {
      const res = await fetch(`/api/templates/${templateId}/use`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Use template failed");
      const data = await res.json();
      window.location.href = `/?doc=${data.documentId}&type=${data.type}`;
    } catch (err) {
      console.error("Failed to use template:", err);
    }
  };

  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-page__header">
          <h2>Settings</h2>
          <button className="settings-close-btn" onClick={onClose}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="editor-loading">
          <div className="editor-loading__spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      {restarting && (
        <div className="settings-restart-overlay">
          <div className="settings-restart-overlay__content">
            <div className="editor-loading__spinner" />
            <p>Server restarting...</p>
            <p className="settings-restart-overlay__hint">
              This page will reload automatically.
            </p>
          </div>
        </div>
      )}

      <div className="settings-page__header">
        <h2>Settings</h2>
        <button className="settings-close-btn" onClick={onClose}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && <div className="settings-error">{error}</div>}
      {successMsg && <div className="settings-success">{successMsg}</div>}

      <div className="settings-sections">
        {/* Security */}
        <section className="settings-section">
          <h3 className="settings-section__title">
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
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            Security
          </h3>

          {settings?.hasPassword ? (
            <div className="settings-password-group">
              <div className="settings-field">
                <label>Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    setPasswordDirty(true);
                  }}
                  placeholder="Enter current password"
                />
              </div>
              <div className="settings-field">
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPasswordDirty(true);
                  }}
                  placeholder="Enter new password"
                />
              </div>
              <div className="settings-field">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPasswordDirty(true);
                  }}
                  placeholder="Confirm new password"
                />
              </div>
              <button
                className="primary-btn settings-password-btn"
                disabled={saving || !passwordDirty}
                onClick={handlePasswordSave}
              >
                {saving ? "Saving..." : "Change Password"}
              </button>
            </div>
          ) : (
            <div className="settings-password-group">
              <p className="settings-field__hint">
                No password is currently set. Set one to protect your instance.
              </p>
              <div className="settings-field">
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPasswordDirty(true);
                  }}
                  placeholder="Set a password"
                />
              </div>
              <div className="settings-field">
                <label>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPasswordDirty(true);
                  }}
                  placeholder="Confirm password"
                />
              </div>
              <button
                className="primary-btn settings-password-btn"
                disabled={saving || !passwordDirty}
                onClick={handlePasswordSave}
              >
                {saving ? "Saving..." : "Set Password"}
              </button>
            </div>
          )}
        </section>

        {/* Features */}
        <section className="settings-section">
          <h3 className="settings-section__title">
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
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            Features
          </h3>

          <div className="settings-field settings-field--toggle">
            <div className="settings-field__info">
              <label>Enable tldraw</label>
              <span className="settings-field__hint">
                Requires a tldraw license key for production use.
              </span>
            </div>
            <button
              className={`settings-toggle ${enableTldraw ? "settings-toggle--on" : ""}`}
              onClick={() => {
                setEnableTldraw(!enableTldraw);
                markDirty();
              }}
              role="switch"
              aria-checked={enableTldraw}
            >
              <span className="settings-toggle__thumb" />
            </button>
          </div>

          <div className="settings-field settings-field--toggle">
            <div className="settings-field__info">
              <label>Enable [[wiki-links]]</label>
              <span className="settings-field__hint">
                Link graph, backlinks, and [[document]] links across editors.
              </span>
            </div>
            <button
              className={`settings-toggle ${enableLinking ? "settings-toggle--on" : ""}`}
              onClick={() => {
                setEnableLinking(!enableLinking);
                markDirty();
              }}
              role="switch"
              aria-checked={enableLinking}
            >
              <span className="settings-toggle__thumb" />
            </button>
          </div>
        </section>

        {/* Storage */}
        <section className="settings-section">
          <h3 className="settings-section__title">
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
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
            Storage
          </h3>

          <div className="settings-field">
            <label>Storage Backend</label>
            <div className="settings-radio-group">
              <label
                className={`settings-radio ${storageBackend === "local" ? "settings-radio--active" : ""}`}
              >
                <input
                  type="radio"
                  name="storageBackend"
                  value="local"
                  checked={storageBackend === "local"}
                  onChange={() => {
                    setStorageBackend("local");
                    markDirty();
                  }}
                />
                <span className="settings-radio__dot" />
                <span>Local filesystem</span>
              </label>
              <label
                className={`settings-radio ${storageBackend === "minio" ? "settings-radio--active" : ""}`}
              >
                <input
                  type="radio"
                  name="storageBackend"
                  value="minio"
                  checked={storageBackend === "minio"}
                  onChange={() => {
                    setStorageBackend("minio");
                    markDirty();
                  }}
                />
                <span className="settings-radio__dot" />
                <span>MinIO / S3-compatible</span>
              </label>
            </div>
          </div>

          {storageBackend === "minio" && (
            <div className="settings-minio-fields">
              <div className="settings-field">
                <label>Endpoint URL</label>
                <input
                  type="text"
                  value={minioEndpointUrl}
                  onChange={(e) => {
                    setMinioEndpointUrl(e.target.value);
                    markDirty();
                  }}
                  placeholder="http://localhost:9000"
                />
              </div>
              <div className="settings-field-row">
                <div className="settings-field">
                  <label>Access Key</label>
                  <input
                    type="password"
                    value={minioAccessKey}
                    onChange={(e) => {
                      setMinioAccessKey(e.target.value);
                      markDirty();
                    }}
                    placeholder={
                      settings?.hasMinioCredentials ? "****" : "Access key"
                    }
                  />
                </div>
                <div className="settings-field">
                  <label>Secret Key</label>
                  <input
                    type="password"
                    value={minioSecretKey}
                    onChange={(e) => {
                      setMinioSecretKey(e.target.value);
                      markDirty();
                    }}
                    placeholder={
                      settings?.hasMinioCredentials ? "****" : "Secret key"
                    }
                  />
                </div>
              </div>
              <div className="settings-field-row">
                <div className="settings-field">
                  <label>Bucket</label>
                  <input
                    type="text"
                    value={minioBucket}
                    onChange={(e) => {
                      setMinioBucket(e.target.value);
                      markDirty();
                    }}
                    placeholder="drawbook"
                  />
                </div>
                <div className="settings-field">
                  <label>Region</label>
                  <input
                    type="text"
                    value={minioRegion}
                    onChange={(e) => {
                      setMinioRegion(e.target.value);
                      markDirty();
                    }}
                    placeholder="us-east-1"
                  />
                </div>
              </div>
              <div className="settings-field">
                <label>
                  Key Prefix{" "}
                  <span className="settings-field__optional">(optional)</span>
                </label>
                <input
                  type="text"
                  value={minioPrefix}
                  onChange={(e) => {
                    setMinioPrefix(e.target.value);
                    markDirty();
                  }}
                  placeholder="e.g. drawbook/"
                />
              </div>
            </div>
          )}
        </section>

        {/* AI */}
        <section className="settings-section">
          <h3 className="settings-section__title">
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
              <path d="M12 2a4 4 0 014 4c0 1.95-1.4 3.58-3.25 3.93L12 22l-.75-12.07A4.001 4.001 0 0112 2z" />
              <path d="M8 10a4 4 0 00-4 4c0 1.95 1.4 3.58 3.25 3.93" />
              <path d="M16 10a4 4 0 014 4c0 1.95-1.4 3.58-3.25 3.93" />
            </svg>
            AI
          </h3>

          <div className="settings-field">
            <label>
              Groq API Key
              {settings?.hasGroqKey && (
                <span className="settings-field__badge">Configured</span>
              )}
            </label>
            <input
              type="password"
              value={groqApiKey}
              onChange={(e) => {
                setGroqApiKey(e.target.value);
                markDirty();
              }}
              placeholder={
                settings?.hasGroqKey ? "****" : "Enter your Groq API key"
              }
            />
            <span className="settings-field__hint">
              Get your API key at{" "}
              <a
                href="https://console.groq.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                console.groq.com
              </a>
            </span>
          </div>
        </section>

        {!isElectron && (
          <section className="settings-section">
            <h3 className="settings-section__title">
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
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
              General
            </h3>

            <div className="settings-field">
              <label>
                CORS Origins{" "}
                <span className="settings-field__optional">(optional)</span>
              </label>
              <input
                type="text"
                value={corsOrigins}
                onChange={(e) => {
                  setCorsOrigins(e.target.value);
                  markDirty();
                }}
                placeholder="Comma-separated origins, e.g. https://example.com"
              />
              <span className="settings-field__hint">
                Leave empty to allow all origins.
              </span>
            </div>
          </section>
        )}
        {/* Import */}
        <section className="settings-section">
          <h3 className="settings-section__title">
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Import
          </h3>

          <div className="settings-field">
            <div className="settings-field__info">
              <label>Import Obsidian Vault</label>
              <span className="settings-field__hint">
                Zip your vault folder and upload it. Markdown files, folder
                structure, wikilinks, PDFs, and CSVs are imported.{" "}
                <code>.obsidian/</code> config and images are skipped.
              </span>
            </div>

            {obsidianImportResult ? (
              <div className="obsidian-import-modal__result">
                <div className="obsidian-import-modal__result-icon">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <p className="obsidian-import-modal__result-text">
                  Import complete!
                </p>
                <div className="obsidian-import-modal__result-stats">
                  <span>
                    {obsidianImportResult.imported} documents imported
                  </span>
                  <span>{obsidianImportResult.folders} folders created</span>
                  {obsidianImportResult.skipped > 0 && (
                    <span>{obsidianImportResult.skipped} files skipped</span>
                  )}
                </div>
                <button
                  className="primary-btn"
                  style={{ marginTop: 8 }}
                  onClick={() => setObsidianImportResult(null)}
                >
                  Import Another
                </button>
              </div>
            ) : (
              <label
                className={`obsidian-import-modal__dropzone${obsidianImporting ? " obsidian-import-modal__dropzone--loading" : ""}`}
              >
                <input
                  ref={obsidianFileRef}
                  type="file"
                  accept=".zip"
                  style={{ display: "none" }}
                  onChange={handleObsidianImport}
                  disabled={obsidianImporting}
                />
                {obsidianImporting ? (
                  <>
                    <span className="obsidian-import-modal__spinner" />
                    <span>Importing vault...</span>
                  </>
                ) : (
                  <>
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span>Click to select your vault .zip file</span>
                    <span className="obsidian-import-modal__hint">
                      Max 50 MB
                    </span>
                  </>
                )}
              </label>
            )}
          </div>
        </section>

        {/* Templates */}
        <section className="settings-section">
          <h3 className="settings-section__title">
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
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M7 3v8l3.5-2L14 11V3" />
            </svg>
            Templates
          </h3>

          {!templatesLoaded ? (
            <button className="primary-btn" onClick={loadTemplates}>
              Load Templates
            </button>
          ) : templates.length === 0 ? (
            <p className="settings-field__hint">
              No templates yet. Save any document as a template from the editor
              toolbar.
            </p>
          ) : (
            <div className="settings-templates-list">
              {templates.map((tpl) => (
                <div key={tpl.id} className="settings-template-item">
                  <div className="settings-template-item__info">
                    <span className="settings-template-item__name">
                      {tpl.name}
                    </span>
                    <span className="settings-template-item__meta">
                      {tpl.type} &middot;{" "}
                      {new Date(tpl.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="settings-template-item__actions">
                    <button
                      className="primary-btn"
                      style={{ padding: "4px 12px", fontSize: 12 }}
                      onClick={() => useTemplate(tpl.id)}
                    >
                      Use
                    </button>
                    <button
                      className="danger-btn"
                      style={{ padding: "4px 12px", fontSize: 12 }}
                      onClick={() => deleteTemplate(tpl.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="settings-actions">
        <button
          className="primary-btn settings-save-btn"
          disabled={saving || !dirty}
          onClick={handleSave}
        >
          {saving ? "Saving..." : isElectron ? "Save" : "Save & Restart"}
        </button>
        {dirty && !isElectron && (
          <span className="settings-actions__hint">
            Saving will restart the server to apply changes.
          </span>
        )}
      </div>
    </div>
  );
}
