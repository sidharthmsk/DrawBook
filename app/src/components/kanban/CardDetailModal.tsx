import { useEffect, useRef, useState } from "react";
import { renderWithLinks } from "../DocumentLink";
import {
  type KanbanCard,
  type KanbanColumn,
  type CardPriority,
  type ChecklistItem,
  PRIORITY_CONFIG,
  labelColor,
} from "./types";

export function CardDetailModal({
  card,
  onUpdate,
  onClose,
  columns,
  currentColumnId,
  onMoveToColumn,
}: {
  card: KanbanCard;
  onUpdate: (id: string, updates: Partial<KanbanCard>) => void;
  onClose: () => void;
  columns?: KanbanColumn[];
  currentColumnId?: string;
  onMoveToColumn?: (cardId: string, targetColumnId: string) => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [labels, setLabels] = useState<string[]>(card.labels || []);
  const [labelInput, setLabelInput] = useState("");
  const [dueDate, setDueDate] = useState(card.dueDate || "");
  const [priority, setPriority] = useState<CardPriority>(
    card.priority || "none",
  );
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    card.checklist || [],
  );
  const [newCheckItem, setNewCheckItem] = useState("");
  const [comments, setComments] = useState<
    Array<{ id: string; text: string; createdAt: string }>
  >(card.comments || []);
  const [newComment, setNewComment] = useState("");
  const descRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const save = () => {
    const updates: Partial<KanbanCard> = {};
    if (title.trim() && title !== card.title) updates.title = title.trim();
    if (description !== card.description) updates.description = description;
    const origLabels = card.labels || [];
    if (JSON.stringify(labels) !== JSON.stringify(origLabels))
      updates.labels = labels;
    if (dueDate !== (card.dueDate || ""))
      updates.dueDate = dueDate || undefined;
    if (priority !== (card.priority || "none")) updates.priority = priority;
    if (JSON.stringify(checklist) !== JSON.stringify(card.checklist || []))
      updates.checklist = checklist;
    if (JSON.stringify(comments) !== JSON.stringify(card.comments || []))
      updates.comments = comments;
    if (Object.keys(updates).length > 0) onUpdate(card.id, updates);
  };

  const addLabel = () => {
    const val = labelInput.trim();
    if (val && !labels.includes(val)) {
      const next = [...labels, val];
      setLabels(next);
      onUpdate(card.id, { labels: next });
    }
    setLabelInput("");
  };

  const removeLabel = (l: string) => {
    const next = labels.filter((x) => x !== l);
    setLabels(next);
    onUpdate(card.id, { labels: next });
  };

  return (
    <div
      className="kanban-detail-overlay"
      onClick={() => {
        save();
        onClose();
      }}
    >
      <div className="kanban-detail" onClick={(e) => e.stopPropagation()}>
        <button
          className="kanban-detail__close"
          onClick={() => {
            save();
            onClose();
          }}
        >
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
        <input
          className="kanban-detail__title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          placeholder="Card title"
        />
        <label className="kanban-detail__label">Labels</label>
        <div className="kanban-detail__labels">
          {labels.map((l) => (
            <span
              key={l}
              className="kanban-label-chip"
              style={{ background: labelColor(l) }}
            >
              {l}
              <button onClick={() => removeLabel(l)}>&times;</button>
            </span>
          ))}
          <input
            className="kanban-detail__label-input"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLabel();
              }
            }}
            placeholder="Add label..."
          />
        </div>
        <label className="kanban-detail__label">Due Date</label>
        <input
          type="date"
          className="kanban-detail__date-input"
          value={dueDate}
          onChange={(e) => {
            setDueDate(e.target.value);
            onUpdate(card.id, { dueDate: e.target.value || undefined });
          }}
        />
        <label className="kanban-detail__label">Priority</label>
        <div className="kanban-detail__priority-row">
          {(Object.keys(PRIORITY_CONFIG) as CardPriority[]).map((p) => (
            <button
              key={p}
              className={`kanban-priority-btn${priority === p ? " kanban-priority-btn--active" : ""}`}
              style={
                priority === p
                  ? { background: PRIORITY_CONFIG[p].color, color: "#fff" }
                  : {}
              }
              onClick={() => {
                setPriority(p);
                onUpdate(card.id, { priority: p });
              }}
            >
              {PRIORITY_CONFIG[p].icon} {PRIORITY_CONFIG[p].label}
            </button>
          ))}
        </div>

        {columns && columns.length > 1 && onMoveToColumn && (
          <>
            <label className="kanban-detail__label">Column</label>
            <select
              className="kanban-detail__move-select"
              value={currentColumnId || ""}
              onChange={(e) => {
                if (e.target.value && e.target.value !== currentColumnId) {
                  onMoveToColumn(card.id, e.target.value);
                }
              }}
            >
              {columns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.title}
                </option>
              ))}
            </select>
          </>
        )}

        <label className="kanban-detail__label">Description</label>
        <textarea
          ref={descRef}
          className="kanban-detail__desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={save}
          placeholder="Add a description..."
          rows={4}
        />
        {description && /\[\[.+?\]\]/.test(description) && (
          <div className="kanban-detail__link-preview">
            {renderWithLinks(description)}
          </div>
        )}

        <label className="kanban-detail__label">
          Checklist ({checklist.filter((c) => c.done).length}/{checklist.length}
          )
        </label>
        {checklist.length > 0 && (
          <div className="kanban-checklist__bar">
            <div
              className="kanban-checklist__fill"
              style={{
                width: `${checklist.length > 0 ? (checklist.filter((c) => c.done).length / checklist.length) * 100 : 0}%`,
              }}
            />
          </div>
        )}
        <div className="kanban-checklist">
          {checklist.map((item) => (
            <div key={item.id} className="kanban-checklist__item">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => {
                  const next = checklist.map((c) =>
                    c.id === item.id ? { ...c, done: !c.done } : c,
                  );
                  setChecklist(next);
                  onUpdate(card.id, { checklist: next });
                }}
              />
              <span className={item.done ? "kanban-checklist__done" : ""}>
                {item.text}
              </span>
              <button
                className="kanban-checklist__remove"
                onClick={() => {
                  const next = checklist.filter((c) => c.id !== item.id);
                  setChecklist(next);
                  onUpdate(card.id, { checklist: next });
                }}
              >
                ×
              </button>
            </div>
          ))}
          <form
            className="kanban-checklist__add"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newCheckItem.trim()) return;
              const next = [
                ...checklist,
                {
                  id: `chk-${Date.now()}`,
                  text: newCheckItem.trim(),
                  done: false,
                },
              ];
              setChecklist(next);
              onUpdate(card.id, { checklist: next });
              setNewCheckItem("");
            }}
          >
            <input
              value={newCheckItem}
              onChange={(e) => setNewCheckItem(e.target.value)}
              placeholder="Add item..."
            />
          </form>
        </div>

        <label className="kanban-detail__label">Comments</label>
        <div className="kanban-comments">
          {comments.map((c) => (
            <div key={c.id} className="kanban-comment">
              <span className="kanban-comment__text">{c.text}</span>
              <span className="kanban-comment__date">
                {new Date(c.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
          <form
            className="kanban-comment__add"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newComment.trim()) return;
              const next = [
                ...comments,
                {
                  id: `cmt-${Date.now()}`,
                  text: newComment.trim(),
                  createdAt: new Date().toISOString(),
                },
              ];
              setComments(next);
              onUpdate(card.id, { comments: next });
              setNewComment("");
            }}
          >
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
            />
          </form>
        </div>
      </div>
    </div>
  );
}
