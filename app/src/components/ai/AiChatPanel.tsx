import { useState, useCallback, useRef, useEffect } from "react";
import { Editor } from "tldraw";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function getCanvasContext(editor: Editor): string {
  const shapes = editor.getCurrentPageShapes();
  if (shapes.length === 0) return "The canvas is empty.";

  const descriptions: string[] = [];
  for (const shape of shapes.slice(0, 50)) {
    const props = shape.props as Record<string, unknown>;
    const bounds = editor.getShapePageBounds(shape.id);
    const parts: string[] = [`${shape.type}`];

    if (bounds) {
      parts.push(`at (${Math.round(bounds.x)},${Math.round(bounds.y)})`);
      parts.push(`${Math.round(bounds.width)}x${Math.round(bounds.height)}`);
    }

    if (typeof props.text === "string" && props.text.trim()) {
      parts.push(`"${props.text.trim().slice(0, 100)}"`);
    }

    if (typeof props.geo === "string") {
      parts.push(props.geo);
    }

    descriptions.push(parts.join(" "));
  }

  const summary = `${shapes.length} shape(s) on canvas:\n${descriptions.join("\n")}`;
  if (shapes.length > 50) {
    return `${summary}\n... and ${shapes.length - 50} more shapes`;
  }
  return summary;
}

interface AiChatPanelProps {
  editor: Editor;
  onClose: () => void;
}

export function AiChatPanel({ editor, onClose }: AiChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const canvasContext = getCanvasContext(editor);

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          canvasContext,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ||
            `Server returned ${response.status}`,
        );
      }

      const { message } = (await response.json()) as { message: string };
      setMessages((prev) => [...prev, { role: "assistant", content: message }]);
    } catch (e: any) {
      setError(e?.message || "Failed to get response");
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading, editor]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  const handleDescribe = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const shapes = editor.getCurrentPageShapes();
      if (shapes.length === 0) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "The canvas is empty. Add some shapes and try again!",
          },
        ]);
        return;
      }

      const canvasContext = getCanvasContext(editor);

      const response = await fetch("/api/ai/describe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shapes: canvasContext }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const { description } = (await response.json()) as {
        description: string;
      };
      setMessages((prev) => [
        ...prev,
        { role: "user", content: "Describe what's on the canvas" },
        { role: "assistant", content: description },
      ]);
    } catch (e: any) {
      setError(e?.message || "Failed to describe canvas");
    } finally {
      setLoading(false);
    }
  }, [editor]);

  const handleSuggest = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const canvasContext = getCanvasContext(editor);

      const response = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvasContext }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const { suggestions } = (await response.json()) as {
        suggestions: string;
      };
      setMessages((prev) => [
        ...prev,
        { role: "user", content: "Suggest improvements for my canvas" },
        { role: "assistant", content: suggestions },
      ]);
    } catch (e: any) {
      setError(e?.message || "Failed to get suggestions");
    } finally {
      setLoading(false);
    }
  }, [editor]);

  return (
    <div className="ai-chat-panel">
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
          <span className="ai-chat-panel__badge">Kimi K2</span>
        </div>
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

      <div className="ai-chat-panel__quick-actions">
        <button
          className="ai-chat-panel__action-btn"
          onClick={handleDescribe}
          disabled={loading}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Describe Canvas
        </button>
        <button
          className="ai-chat-panel__action-btn"
          onClick={handleSuggest}
          disabled={loading}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          Get Suggestions
        </button>
      </div>

      <div className="ai-chat-panel__messages">
        {messages.length === 0 && (
          <div className="ai-chat-panel__empty">
            <p>
              Ask me anything about your canvas, get design feedback, or
              brainstorm ideas.
            </p>
            <p className="ai-chat-panel__hint">
              Powered by Groq &middot; Kimi K2
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`ai-chat-panel__message ai-chat-panel__message--${msg.role}`}
          >
            <div className="ai-chat-panel__message-content">{msg.content}</div>
          </div>
        ))}
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
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
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
          onClick={sendMessage}
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
