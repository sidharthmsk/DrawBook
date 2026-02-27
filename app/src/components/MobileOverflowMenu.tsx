import {
  useState,
  useRef,
  useEffect,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from "react";

export function MobileOverflowMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleMenuClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;

    // Keep the menu open for nested interactive controls (e.g. select dropdowns).
    if (
      target.closest(
        "select, option, input, textarea, [role='combobox'], .export-format-select, .editor-task-popover-wrapper",
      )
    ) {
      return;
    }

    if (target.closest("button, a")) {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  return (
    <div className="mobile-overflow" ref={menuRef}>
      <button
        className="mobile-overflow__trigger"
        onClick={() => setOpen((v) => !v)}
        title="More actions"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="13" cy="8" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="mobile-overflow__menu" onClick={handleMenuClick}>
          {children}
        </div>
      )}
    </div>
  );
}
