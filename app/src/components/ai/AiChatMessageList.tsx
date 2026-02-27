import ReactMarkdown from "react-markdown";
import { renderWithLinks } from "../DocumentLink";
import { CopyButton } from "./CopyButton";
import type { ChatMessage } from "./types";

export interface AiChatMessageListProps {
  messages: ChatMessage[];
  applyLabel: string;
  loading: boolean;
  error: string | null;
  hasRetry: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onApply: (index: number) => void;
  onRateUp: (index: number) => void;
  onRateDown: (index: number) => void;
  onRetry: () => void;
}

export function AiChatMessageList({
  messages,
  applyLabel,
  loading,
  error,
  hasRetry,
  messagesEndRef,
  onApply,
  onRateUp,
  onRateDown,
  onRetry,
}: AiChatMessageListProps) {
  return (
    <>
      {messages.map((msg, i) => {
        const prevMsg = i > 0 ? messages[i - 1] : null;
        const isGrouped = prevMsg?.role === msg.role;
        const timeStr = msg.timestamp
          ? new Intl.DateTimeFormat(undefined, {
              hour: "numeric",
              minute: "2-digit",
            }).format(msg.timestamp)
          : "";
        return (
          <div
            key={i}
            className={`ai-chat-panel__message ai-chat-panel__message--${msg.role}${isGrouped ? " ai-chat-panel__message--grouped" : ""}`}
          >
            <div className="ai-chat-panel__message-content">
              {msg.role === "assistant" ? (
                <ReactMarkdown
                  components={{
                    code({ className, children, ...props }) {
                      const isInline = !className;
                      return isInline ? (
                        <code className="ai-inline-code" {...props}>
                          {children}
                        </code>
                      ) : (
                        <pre className="ai-code-block">
                          <code className={className} {...props}>
                            {children}
                          </code>
                        </pre>
                      );
                    },
                    p({ children }) {
                      const text = typeof children === "string" ? children : "";
                      if (text && /\[\[.+?\]\]/.test(text)) {
                        return <p>{renderWithLinks(text)}</p>;
                      }
                      return <p>{children}</p>;
                    },
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
            {msg.role === "assistant" && msg.content && (
              <div className="ai-chat-panel__msg-actions">
                <CopyButton text={msg.content} />
                <button
                  className={`ai-chat-panel__rate-btn${msg.rating === "up" ? " ai-chat-panel__rate-btn--active" : ""}`}
                  onClick={() => onRateUp(i)}
                  title="Good response"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill={msg.rating === "up" ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
                    <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
                  </svg>
                </button>
                <button
                  className={`ai-chat-panel__rate-btn${msg.rating === "down" ? " ai-chat-panel__rate-btn--active" : ""}`}
                  onClick={() => onRateDown(i)}
                  title="Poor response"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill={msg.rating === "down" ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z" />
                    <path d="M17 2h3a2 2 0 012 2v7a2 2 0 01-2 2h-3" />
                  </svg>
                </button>
              </div>
            )}
            {msg.role === "assistant" && msg.aiContent && (
              <button
                className={`ai-chat-panel__apply-btn${msg.applied ? " ai-chat-panel__apply-btn--applied" : ""}`}
                onClick={() => onApply(i)}
                disabled={msg.applied}
              >
                {msg.applied ? (
                  <>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Applied
                  </>
                ) : (
                  <>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    {applyLabel}
                  </>
                )}
              </button>
            )}
            {timeStr && (
              <span className="ai-chat-panel__timestamp">{timeStr}</span>
            )}
          </div>
        );
      })}
      {loading && (
        <div className="ai-chat-panel__message ai-chat-panel__message--assistant">
          <div className="ai-chat-panel__typing">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
      {error && (
        <div className="ai-chat-panel__error">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span>{error}</span>
          {hasRetry && (
            <button className="ai-chat-panel__retry-btn" onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      )}
      <div ref={messagesEndRef} />
    </>
  );
}
