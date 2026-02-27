export function FeaturesSection({
  enableTldraw,
  enableLinking,
  onEnableTldrawChange,
  onEnableLinkingChange,
  onMarkDirty,
}: {
  enableTldraw: boolean;
  enableLinking: boolean;
  onEnableTldrawChange: (value: boolean) => void;
  onEnableLinkingChange: (value: boolean) => void;
  onMarkDirty: () => void;
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
            onEnableTldrawChange(!enableTldraw);
            onMarkDirty();
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
            onEnableLinkingChange(!enableLinking);
            onMarkDirty();
          }}
          role="switch"
          aria-checked={enableLinking}
        >
          <span className="settings-toggle__thumb" />
        </button>
      </div>
    </section>
  );
}
