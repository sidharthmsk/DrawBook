import type { ObsidianImportResult } from "./types";

export function ImportSection({
  importing,
  result,
  onImport,
  onClearResult,
}: {
  importing: boolean;
  result: ObsidianImportResult | null;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearResult: () => void;
}) {
  return (
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

        {result ? (
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
              <span>{result.imported} documents imported</span>
              <span>{result.folders} folders created</span>
              {result.skipped > 0 && (
                <span>{result.skipped} files skipped</span>
              )}
            </div>
            <button
              className="primary-btn"
              style={{ marginTop: 8 }}
              onClick={onClearResult}
            >
              Import Another
            </button>
          </div>
        ) : (
          <label
            className={`obsidian-import-modal__dropzone${importing ? " obsidian-import-modal__dropzone--loading" : ""}`}
          >
            <input
              type="file"
              accept=".zip"
              style={{ display: "none" }}
              onChange={onImport}
              disabled={importing}
            />
            {importing ? (
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
                <span className="obsidian-import-modal__hint">Max 50 MB</span>
              </>
            )}
          </label>
        )}
      </div>
    </section>
  );
}
