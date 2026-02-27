import { useCallback, useEffect, useState } from "react";
import { useConfirm } from "./ConfirmDialog";
import type { SettingsData } from "./settings/types";
import { SecuritySection } from "./settings/SecuritySection";
import { FeaturesSection } from "./settings/FeaturesSection";
import { StorageSection } from "./settings/StorageSection";
import { AiSection } from "./settings/AiSection";
import { GeneralSection } from "./settings/GeneralSection";
import { ImportSection } from "./settings/ImportSection";
import { TemplatesSection } from "./settings/TemplatesSection";

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
        <SecuritySection
          currentPassword={currentPassword}
          setCurrentPassword={setCurrentPassword}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          hasPassword={settings?.hasPassword ?? false}
          onSave={handlePasswordSave}
          saving={saving}
          passwordDirty={passwordDirty}
          setPasswordDirty={setPasswordDirty}
        />

        <FeaturesSection
          enableTldraw={enableTldraw}
          enableLinking={enableLinking}
          onEnableTldrawChange={setEnableTldraw}
          onEnableLinkingChange={setEnableLinking}
          onMarkDirty={markDirty}
        />

        <StorageSection
          storageBackend={storageBackend}
          setStorageBackend={setStorageBackend}
          minioEndpointUrl={minioEndpointUrl}
          setMinioEndpointUrl={setMinioEndpointUrl}
          minioAccessKey={minioAccessKey}
          setMinioAccessKey={setMinioAccessKey}
          minioSecretKey={minioSecretKey}
          setMinioSecretKey={setMinioSecretKey}
          minioBucket={minioBucket}
          setMinioBucket={setMinioBucket}
          minioRegion={minioRegion}
          setMinioRegion={setMinioRegion}
          minioPrefix={minioPrefix}
          setMinioPrefix={setMinioPrefix}
          hasMinioCredentials={settings?.hasMinioCredentials ?? false}
          onMarkDirty={markDirty}
        />

        <AiSection
          groqApiKey={groqApiKey}
          setGroqApiKey={setGroqApiKey}
          hasGroqKey={settings?.hasGroqKey ?? false}
          onMarkDirty={markDirty}
        />

        {!isElectron && (
          <GeneralSection
            corsOrigins={corsOrigins}
            setCorsOrigins={setCorsOrigins}
            onMarkDirty={markDirty}
          />
        )}

        <ImportSection
          importing={obsidianImporting}
          result={obsidianImportResult}
          onImport={handleObsidianImport}
          onClearResult={() => setObsidianImportResult(null)}
        />

        <TemplatesSection
          templates={templates}
          templatesLoaded={templatesLoaded}
          onLoadTemplates={loadTemplates}
          onUseTemplate={useTemplate}
          onDeleteTemplate={deleteTemplate}
        />
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
