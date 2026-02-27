import { useRef } from "react";

export function ClickOrDouble({
  className,
  children,
  onSingleClick,
  onDoubleClick,
}: {
  className?: string;
  children: React.ReactNode;
  onSingleClick: () => void;
  onDoubleClick: () => void;
}) {
  const clickTimer = useRef<NodeJS.Timeout | null>(null);
  return (
    <button
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        if (clickTimer.current) {
          clearTimeout(clickTimer.current);
          clickTimer.current = null;
          onDoubleClick();
        } else {
          clickTimer.current = setTimeout(() => {
            clickTimer.current = null;
            onSingleClick();
          }, 400);
        }
      }}
    >
      {children}
    </button>
  );
}
