import { useState, useCallback, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { EditorAdapter } from "./EditorAdapter";
import { renderWithLinks } from "../DocumentLink";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      className={`ai-chat-panel__copy-btn${copied ? " ai-chat-panel__copy-btn--copied" : ""}`}
      onClick={handleCopy}
      title="Copy to clipboard"
    >
      {copied ? (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  aiContent?: string;
  aiContentType?: string;
  applied?: boolean;
  rating?: "up" | "down";
  timestamp?: number;
}

interface AiChatPanelProps {
  adapter: EditorAdapter;
  onClose: () => void;
  documentId?: string;
  fullScreen?: boolean;
}

const CHAT_STORAGE_PREFIX = "drawbook-chat-";
const MAX_STORED_MESSAGES = 50;

function loadStoredMessages(docId?: string): ChatMessage[] {
  if (!docId) return [];
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_PREFIX + docId);
    if (raw) return JSON.parse(raw) as ChatMessage[];
  } catch {}
  return [];
}

function saveStoredMessages(docId: string | undefined, msgs: ChatMessage[]) {
  if (!docId) return;
  try {
    const trimmed = msgs.slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(CHAT_STORAGE_PREFIX + docId, JSON.stringify(trimmed));
  } catch {}
}

const AI_PANEL_WIDTH_KEY = "drawbook-ai-panel-width";
const MIN_PANEL_WIDTH = 280;
const MAX_PANEL_WIDTH = 600;
const DEFAULT_PANEL_WIDTH = 360;

export function AiChatPanel({
  adapter,
  onClose,
  documentId,
  fullScreen,
}: AiChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadStoredMessages(documentId),
  );
  const [panelWidth, setPanelWidth] = useState(() => {
    try {
      const stored = localStorage.getItem(AI_PANEL_WIDTH_KEY);
      if (stored)
        return Math.max(
          MIN_PANEL_WIDTH,
          Math.min(MAX_PANEL_WIDTH, parseInt(stored, 10)),
        );
    } catch {}
    return DEFAULT_PANEL_WIDTH;
  });
  const resizing = useRef(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextPreview, setContextPreview] = useState("");
  const [contextExpanded, setContextExpanded] = useState(false);
  const lastFailedMessages = useRef<ChatMessage[] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (messages.length > 0) saveStoredMessages(documentId, messages);
  }, [messages, documentId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const refreshContext = useCallback(() => {
    try {
      setContextPreview(adapter.getContext());
    } catch {}
  }, [adapter]);

  useEffect(() => {
    refreshContext();
  }, [refreshContext]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizing.current = true;
      const startX = e.clientX;
      const startWidth = panelWidth;
      const onMove = (ev: MouseEvent) => {
        if (!resizing.current) return;
        const delta = startX - ev.clientX;
        const newWidth = Math.max(
          MIN_PANEL_WIDTH,
          Math.min(MAX_PANEL_WIDTH, startWidth + delta),
        );
        setPanelWidth(newWidth);
      };
      const onUp = () => {
        resizing.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        setPanelWidth((w) => {
          try {
            localStorage.setItem(AI_PANEL_WIDTH_KEY, String(w));
          } catch {}
          return w;
        });
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [panelWidth],
  );

  const sendMessage = useCallback(
    async (promptText?: string) => {
      const trimmed = (promptText || input).trim();
      if (!trimmed || loading) return;

      const userMessage: ChatMessage = {
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput("");
      setLoading(true);
      setError(null);

      try {
        const canvasContext = adapter.getContext();

        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            canvasContext,
            editorType: adapter.type,
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(
            (err as { error?: string }).error ||
              `Server returned ${response.status}`,
          );
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let streamedText = "";
        const streamIdx = updatedMessages.length;

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "", timestamp: Date.now() },
        ]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(trimmed.slice(6)) as {
                chunk?: string;
                done?: boolean;
                message?: string;
                content?: string;
                contentType?: string;
                error?: string;
              };
              if (data.error) throw new Error(data.error);
              if (data.chunk) {
                streamedText += data.chunk;
                setMessages((prev) =>
                  prev.map((m, i) =>
                    i === streamIdx ? { ...m, content: streamedText } : m,
                  ),
                );
              }
              if (data.done) {
                setMessages((prev) =>
                  prev.map((m, i) =>
                    i === streamIdx
                      ? {
                          ...m,
                          content: data.message || streamedText,
                          aiContent: data.content,
                          aiContentType: data.contentType,
                        }
                      : m,
                  ),
                );
              }
            } catch (parseErr: any) {
              if (parseErr.message && parseErr.message !== "No response body") {
                throw parseErr;
              }
            }
          }
        }
      } catch (e: any) {
        setError(e?.message || "Failed to get response");
        lastFailedMessages.current = updatedMessages;
      } finally {
        setLoading(false);
      }
    },
    [input, messages, loading, adapter],
  );

  const retryLastMessage = useCallback(async () => {
    const failedMsgs = lastFailedMessages.current;
    if (!failedMsgs || loading) return;
    lastFailedMessages.current = null;
    setError(null);
    setLoading(true);

    try {
      const canvasContext = adapter.getContext();
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: failedMsgs.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          canvasContext,
          editorType: adapter.type,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ||
            `Server returned ${response.status}`,
        );
      }

      const data = (await response.json()) as {
        message: string;
        content?: string;
        contentType?: string;
      };
      setMessages([
        ...failedMsgs,
        {
          role: "assistant",
          content: data.message,
          aiContent: data.content,
          aiContentType: data.contentType,
        },
      ]);
    } catch (e: any) {
      setError(e?.message || "Failed to get response");
      lastFailedMessages.current = failedMsgs;
    } finally {
      setLoading(false);
    }
  }, [loading, adapter]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        sendMessage();
      }
      if (e.key === "Escape") {
        onClose();
      }
    },
    [sendMessage, onClose],
  );

  const handleApply = useCallback(
    (index: number) => {
      const msg = messages[index];
      if (!msg?.aiContent) return;

      adapter.applyContent(msg.aiContent);
      setMessages((prev) =>
        prev.map((m, i) => (i === index ? { ...m, applied: true } : m)),
      );
    },
    [messages, adapter],
  );

  const applyLabel =
    adapter.type === "markdown" ? "Apply to Document" : "Apply to Canvas";

  return (
    <div
      className={`ai-chat-panel${fullScreen ? " ai-chat-panel--fullscreen" : ""}`}
      style={fullScreen ? undefined : { width: panelWidth }}
    >
      {!fullScreen && (
        <div
          className="ai-chat-panel__resize"
          onMouseDown={handleResizeStart}
        />
      )}
      <div className="ai-chat-panel__header">
        <div className="ai-chat-panel__title">
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
            <path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5 7.4V20h6v-2.6c2.9-1.1 5-4 5-7.4a8 8 0 0 0-8-8z" />
            <path d="M9 22h6" />
          </svg>
          <span>AI Assistant</span>
          <span className="ai-chat-panel__badge">Groq</span>
        </div>
        {messages.length > 0 && (
          <button
            className="ai-chat-panel__clear-btn"
            onClick={() => {
              setMessages([]);
              if (documentId) {
                try {
                  localStorage.removeItem(CHAT_STORAGE_PREFIX + documentId);
                } catch {}
              }
            }}
            title="Clear conversation"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </button>
        )}
        <button className="ai-chat-panel__close" onClick={onClose}>
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
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="ai-chat-panel__messages">
        {messages.length === 0 && (
          <div className="ai-chat-panel__empty">
            <p>
              Ask me anything about your{" "}
              {adapter.type === "markdown" ? "document" : "canvas"}, get
              feedback, or brainstorm ideas.
            </p>
            <p className="ai-chat-panel__hint">Powered by Groq</p>
          </div>
        )}
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
                        const text =
                          typeof children === "string" ? children : "";
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
                    onClick={() => {
                      const newRating =
                        msg.rating === "up" ? undefined : ("up" as const);
                      setMessages((prev) =>
                        prev.map((m, j) =>
                          j === i ? { ...m, rating: newRating } : m,
                        ),
                      );
                      fetch("/api/ai/feedback", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          documentId,
                          messageIndex: i,
                          rating: newRating || "none",
                          content: msg.content.slice(0, 200),
                        }),
                      }).catch(() => {});
                    }}
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
                    onClick={() => {
                      const newRating =
                        msg.rating === "down" ? undefined : ("down" as const);
                      setMessages((prev) =>
                        prev.map((m, j) =>
                          j === i ? { ...m, rating: newRating } : m,
                        ),
                      );
                      fetch("/api/ai/feedback", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          documentId,
                          messageIndex: i,
                          rating: newRating || "none",
                          content: msg.content.slice(0, 200),
                        }),
                      }).catch(() => {});
                    }}
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
                  onClick={() => handleApply(i)}
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
            {lastFailedMessages.current && (
              <button
                className="ai-chat-panel__retry-btn"
                onClick={retryLastMessage}
              >
                Retry
              </button>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="ai-chat-panel__context">
        <div
          className="ai-chat-panel__context-header"
          onClick={() => setContextExpanded((v) => !v)}
        >
          <span className="ai-chat-panel__context-label">
            <svg
              width="10"
              height="10"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d={contextExpanded ? "M4 6l4 4 4-4" : "M6 4l4 4-4 4"} />
            </svg>
            Context
          </span>
          <button
            className="ai-chat-panel__context-refresh"
            onClick={(e) => {
              e.stopPropagation();
              refreshContext();
            }}
            title="Refresh context"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M14 8a6 6 0 11-1.5-4" />
              <polyline points="14 2 14 5 11 5" />
            </svg>
          </button>
        </div>
        {contextExpanded && (
          <div className="ai-chat-panel__context-body">
            {contextPreview || "No context available."}
          </div>
        )}
        {!contextExpanded && contextPreview && (
          <div className="ai-chat-panel__context-preview">
            {contextPreview.slice(0, 200)}
            {contextPreview.length > 200 ? "..." : ""}
          </div>
        )}
      </div>

      <div className="ai-chat-panel__input-area">
        <textarea
          ref={inputRef}
          className="ai-chat-panel__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask AI anything..."
          rows={2}
          disabled={loading}
        />
        <button
          className="ai-chat-panel__send"
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
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
    </div>
  );
}
