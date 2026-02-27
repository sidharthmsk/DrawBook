import { useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type KanbanCard, PRIORITY_CONFIG, labelColor } from "./types";

export function SortableCard({
  card,
  onUpdate,
  onDelete,
  onOpenDetail,
  autoEdit,
  onAutoEditDone,
}: {
  card: KanbanCard;
  onUpdate: (id: string, updates: Partial<KanbanCard>) => void;
  onDelete: (id: string) => void;
  onOpenDetail: (card: KanbanCard) => void;
  autoEdit?: boolean;
  onAutoEditDone?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
    };
  }, []);

  useEffect(() => {
    if (autoEdit) {
      setEditing(true);
      setTitle("");
      onAutoEditDone?.();
    }
  }, [autoEdit, onAutoEditDone]);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const finishEdit = () => {
    setEditing(false);
    if (title.trim() && title !== card.title) {
      onUpdate(card.id, { title: title.trim() });
    } else {
      setTitle(card.title);
    }
  };

  const handleCardClick = () => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      onOpenDetail(card);
    }, 250);
  };

  const handleTitleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    setEditing(true);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="kanban-card"
      {...attributes}
      {...listeners}
      onClick={handleCardClick}
    >
      <div className="kanban-card__drag">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="4" r="1.5" />
          <circle cx="11" cy="4" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="11" cy="12" r="1.5" />
        </svg>
      </div>
      <div className="kanban-card__body">
        {editing ? (
          <input
            className="kanban-inline-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={finishEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") finishEdit();
              if (e.key === "Escape") {
                setTitle(card.title);
                setEditing(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <span
            className="kanban-card__title"
            onDoubleClick={handleTitleDoubleClick}
          >
            {card.title}
          </span>
        )}
        {card.labels && card.labels.length > 0 && (
          <div className="kanban-card__labels">
            {card.labels.map((l) => (
              <span
                key={l}
                className="kanban-label-chip kanban-label-chip--small"
                style={{ background: labelColor(l) }}
              >
                {l}
              </span>
            ))}
          </div>
        )}
        {card.dueDate && (
          <span
            className={`kanban-card__due${new Date(card.dueDate + "T23:59:59") < new Date() ? " kanban-card__due--overdue" : ""}`}
          >
            📅 {card.dueDate}
          </span>
        )}
        <div className="kanban-card__meta">
          {card.priority && card.priority !== "none" && (
            <span
              className="kanban-card__priority"
              style={{ color: PRIORITY_CONFIG[card.priority].color }}
            >
              {PRIORITY_CONFIG[card.priority].icon}{" "}
              {PRIORITY_CONFIG[card.priority].label}
            </span>
          )}
          {card.checklist && card.checklist.length > 0 && (
            <span
              className={`kanban-card__checklist-count${card.checklist.every((c) => c.done) ? " kanban-card__checklist-count--done" : ""}`}
            >
              ☑ {card.checklist.filter((c) => c.done).length}/
              {card.checklist.length}
            </span>
          )}
          {card.comments && card.comments.length > 0 && (
            <span className="kanban-card__comment-count">
              💬 {card.comments.length}
            </span>
          )}
        </div>
      </div>
      <button
        className="kanban-card__delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(card.id);
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );
}

export function CardOverlay({ card }: { card: KanbanCard }) {
  return (
    <div className="kanban-card kanban-card--overlay">
      <div className="kanban-card__drag">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="4" r="1.5" />
          <circle cx="11" cy="4" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="11" cy="12" r="1.5" />
        </svg>
      </div>
      <div className="kanban-card__body">
        <span className="kanban-card__title">{card.title}</span>
      </div>
    </div>
  );
}
