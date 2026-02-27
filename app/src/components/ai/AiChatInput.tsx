import type { RefObject } from "react";

export interface AiChatInputProps {
  value: string;
  loading: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
}

export function AiChatInput({
  value,
  loading,
  inputRef,
  onChange,
  onKeyDown,
  onSend,
}: AiChatInputProps) {
  return (
    <div className="ai-chat-panel__input-area">
      <textarea
        ref={inputRef}
        className="ai-chat-panel__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask AI anything..."
        rows={2}
        disabled={loading}
      />
      <button
        className="ai-chat-panel__send"
        onClick={onSend}
        disabled={loading || !value.trim()}
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
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  );
}
