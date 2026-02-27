import type { TemplateItem } from "./types";

export function TemplatesSection({
  templates,
  templatesLoaded,
  onLoadTemplates,
  onUseTemplate,
  onDeleteTemplate,
}: {
  templates: TemplateItem[];
  templatesLoaded: boolean;
  onLoadTemplates: () => void;
  onUseTemplate: (templateId: string) => void;
  onDeleteTemplate: (templateId: string) => void;
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
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M7 3v8l3.5-2L14 11V3" />
        </svg>
        Templates
      </h3>

      {!templatesLoaded ? (
        <button className="primary-btn" onClick={onLoadTemplates}>
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
                <span className="settings-template-item__name">{tpl.name}</span>
                <span className="settings-template-item__meta">
                  {tpl.type} &middot;{" "}
                  {new Date(tpl.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="settings-template-item__actions">
                <button
                  className="primary-btn"
                  style={{ padding: "4px 12px", fontSize: 12 }}
                  onClick={() => onUseTemplate(tpl.id)}
                >
                  Use
                </button>
                <button
                  className="danger-btn"
                  style={{ padding: "4px 12px", fontSize: 12 }}
                  onClick={() => onDeleteTemplate(tpl.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
