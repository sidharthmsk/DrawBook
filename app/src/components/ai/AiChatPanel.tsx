import { useState, useCallback, useRef, useEffect } from "react";
import type { EditorAdapter } from "./EditorAdapter";
import {
  DocumentContextPicker,
  type AttachedContext,
} from "./DocumentContextPicker";
import { loadStoredMessages, saveStoredMessages } from "./chatStorage";
import {
  type ChatMessage,
  type AiChatPanelProps,
  CHAT_STORAGE_PREFIX,
  AI_PANEL_WIDTH_KEY,
  MIN_PANEL_WIDTH,
  MAX_PANEL_WIDTH,
  DEFAULT_PANEL_WIDTH,
} from "./types";
import { AiChatMessageList } from "./AiChatMessageList";
import { AiChatInput } from "./AiChatInput";

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
  const [attachedDocs, setAttachedDocs] = useState<AttachedContext[]>([]);
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
        const extraContext =
          attachedDocs.length > 0
            ? attachedDocs.map((d) => d.context).join("\n\n---\n\n")
            : undefined;

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
            extraContext,
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
            } catch (parseErr: unknown) {
              const err = parseErr as { message?: string };
              if (err.message && err.message !== "No response body") {
                throw parseErr;
              }
            }
          }
        }
      } catch (e: unknown) {
        const err = e as { message?: string };
        setError(err?.message || "Failed to get response");
        lastFailedMessages.current = updatedMessages;
      } finally {
        setLoading(false);
      }
    },
    [input, messages, loading, adapter, attachedDocs],
  );

  const retryLastMessage = useCallback(async () => {
    const failedMsgs = lastFailedMessages.current;
    if (!failedMsgs || loading) return;
    lastFailedMessages.current = null;
    setError(null);
    setLoading(true);

    try {
      const canvasContext = adapter.getContext();
      const extraContext =
        attachedDocs.length > 0
          ? attachedDocs.map((d) => d.context).join("\n\n---\n\n")
          : undefined;
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
          extraContext,
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
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err?.message || "Failed to get response");
      lastFailedMessages.current = failedMsgs;
    } finally {
      setLoading(false);
    }
  }, [loading, adapter, attachedDocs]);

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
    async (index: number) => {
      const msg = messages[index];
      if (!msg?.aiContent) return;

      await adapter.applyContent(msg.aiContent);
      setMessages((prev) =>
        prev.map((m, i) => (i === index ? { ...m, applied: true } : m)),
      );
    },
    [messages, adapter],
  );

  const handleRateUp = useCallback(
    (index: number) => {
      const msg = messages[index];
      if (!msg) return;
      const newRating = msg.rating === "up" ? undefined : ("up" as const);
      setMessages((prev) =>
        prev.map((m, j) => (j === index ? { ...m, rating: newRating } : m)),
      );
      fetch("/api/ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          messageIndex: index,
          rating: newRating || "none",
          content: msg.content.slice(0, 200),
        }),
      }).catch(() => {});
    },
    [messages, documentId],
  );

  const handleRateDown = useCallback(
    (index: number) => {
      const msg = messages[index];
      if (!msg) return;
      const newRating = msg.rating === "down" ? undefined : ("down" as const);
      setMessages((prev) =>
        prev.map((m, j) => (j === index ? { ...m, rating: newRating } : m)),
      );
      fetch("/api/ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          messageIndex: index,
          rating: newRating || "none",
          content: msg.content.slice(0, 200),
        }),
      }).catch(() => {});
    },
    [messages, documentId],
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
        <AiChatMessageList
          messages={messages}
          applyLabel={applyLabel}
          loading={loading}
          error={error}
          hasRetry={!!lastFailedMessages.current}
          messagesEndRef={messagesEndRef}
          onApply={handleApply}
          onRateUp={handleRateUp}
          onRateDown={handleRateDown}
          onRetry={retryLastMessage}
        />
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

      <DocumentContextPicker
        currentDocumentId={documentId}
        attachedDocs={attachedDocs}
        onAttach={(doc) => setAttachedDocs((prev) => [...prev, doc])}
        onDetach={(id) =>
          setAttachedDocs((prev) => prev.filter((d) => d.id !== id))
        }
      />

      <AiChatInput
        value={input}
        loading={loading}
        inputRef={inputRef}
        onChange={setInput}
        onKeyDown={handleKeyDown}
        onSend={() => sendMessage()}
      />
    </div>
  );
}
