export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="quick-switcher-overlay" onClick={onClose}>
      <div
        className="kanban-detail"
        style={{ width: 380 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="kanban-detail__close" onClick={onClose}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
        <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Keyboard Shortcuts</h3>
        <div className="shortcuts-list">
          {[
            [
              navigator.platform.includes("Mac") ? "⌘ K" : "Ctrl+K",
              "Quick Switcher",
            ],
            [
              navigator.platform.includes("Mac") ? "⌘ N" : "Ctrl+N",
              "New Document",
            ],
            ["?", "Show this help"],
          ].map(([key, desc]) => (
            <div key={key} className="shortcuts-row">
              <kbd className="shortcuts-kbd">{key}</kbd>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
