import { useCallback, useEffect, useRef, useState } from "react";
import { EditorShell } from "./EditorShell";
import {
  createKanbanAdapter,
  type KanbanSnapshot as KanbanSnapshotType,
  type EditorAdapter,
} from "./ai/EditorAdapter";
import { renderWithLinks } from "./DocumentLink";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useIsMobile } from "../hooks/useIsMobile";

interface KanbanEditorProps {
  documentId: string;
}

interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

type CardPriority = "none" | "low" | "medium" | "high" | "urgent";

const PRIORITY_CONFIG: Record<
  CardPriority,
  { label: string; color: string; icon: string }
> = {
  none: { label: "None", color: "transparent", icon: "" },
  low: { label: "Low", color: "#00b894", icon: "▽" },
  medium: { label: "Medium", color: "#fdcb6e", icon: "◇" },
  high: { label: "High", color: "#e17055", icon: "△" },
  urgent: { label: "Urgent", color: "#d63031", icon: "⬆" },
};

interface KanbanCard {
  id: string;
  title: string;
  description: string;
  labels?: string[];
  dueDate?: string;
  priority?: CardPriority;
  checklist?: ChecklistItem[];
  comments?: Array<{ id: string; text: string; createdAt: string }>;
}

const LABEL_COLORS = [
  "#e17055",
  "#00b894",
  "#0984e3",
  "#6c5ce7",
  "#fdcb6e",
  "#e84393",
  "#00cec9",
  "#d63031",
];
function labelColor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++)
    hash = (hash * 31 + label.charCodeAt(i)) | 0;
  return LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length];
}

interface KanbanColumn {
  id: string;
  title: string;
  cardIds: string[];
  wipLimit?: number;
}

interface KanbanSnapshot {
  columns: KanbanColumn[];
  cards: KanbanCard[];
}

const DEFAULT_SNAPSHOT: KanbanSnapshot = {
  columns: [
    { id: "col-todo", title: "To Do", cardIds: [] },
    { id: "col-progress", title: "In Progress", cardIds: [] },
    { id: "col-done", title: "Done", cardIds: [] },
  ],
  cards: [],
};

function CardDetailModal({
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

function SortableCard({
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

function CardOverlay({ card }: { card: KanbanCard }) {
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

function SortableColumn({
  column,
  cards,
  onUpdateCard,
  onDeleteCard,
  onAddCard,
  onUpdateColumn,
  onDeleteColumn,
  onOpenDetail,
  onSetWipLimit,
  lastCreatedCardId,
  onAutoEditDone,
}: {
  column: KanbanColumn;
  cards: KanbanCard[];
  onUpdateCard: (id: string, updates: Partial<KanbanCard>) => void;
  onDeleteCard: (id: string) => void;
  onAddCard: (columnId: string) => void;
  onUpdateColumn: (id: string, title: string) => void;
  onDeleteColumn: (id: string) => void;
  onOpenDetail: (card: KanbanCard) => void;
  onSetWipLimit: (id: string, limit: number | undefined) => void;
  lastCreatedCardId?: string | null;
  onAutoEditDone?: () => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(column.title);
  const [editingWip, setEditingWip] = useState(false);
  const [wipInput, setWipInput] = useState(column.wipLimit?.toString() || "");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id, data: { type: "column" } });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const finishEdit = () => {
    setEditingTitle(false);
    if (title.trim() && title !== column.title) {
      onUpdateColumn(column.id, title.trim());
    } else {
      setTitle(column.title);
    }
  };

  const columnCards = column.cardIds
    .map((id) => cards.find((c) => c.id === id))
    .filter(Boolean) as KanbanCard[];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="kanban-column"
      {...attributes}
    >
      <div className="kanban-column__header" {...listeners}>
        {editingTitle ? (
          <input
            className="kanban-inline-input kanban-inline-input--header"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={finishEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") finishEdit();
              if (e.key === "Escape") {
                setTitle(column.title);
                setEditingTitle(false);
              }
            }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="kanban-column__title"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingTitle(true);
            }}
          >
            {column.title}
          </span>
        )}
        {editingWip ? (
          <input
            className="kanban-wip-input"
            type="number"
            min="0"
            value={wipInput}
            onChange={(e) => setWipInput(e.target.value)}
            onBlur={() => {
              setEditingWip(false);
              const val = parseInt(wipInput, 10);
              onSetWipLimit(column.id, val > 0 ? val : undefined);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditingWip(false);
            }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={`kanban-column__count${column.wipLimit && columnCards.length > column.wipLimit ? " kanban-column__count--over" : ""}`}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setWipInput(column.wipLimit?.toString() || "");
              setEditingWip(true);
            }}
            title="Double-click to set WIP limit"
          >
            {columnCards.length}
            {column.wipLimit ? ` / ${column.wipLimit}` : ""}
          </span>
        )}
        <button
          className="kanban-column__delete"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteColumn(column.id);
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
      <div className="kanban-column__cards">
        <SortableContext
          items={column.cardIds}
          strategy={verticalListSortingStrategy}
        >
          {columnCards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              onUpdate={onUpdateCard}
              onDelete={onDeleteCard}
              onOpenDetail={onOpenDetail}
              autoEdit={card.id === lastCreatedCardId}
              onAutoEditDone={onAutoEditDone}
            />
          ))}
        </SortableContext>
      </div>
      <button className="kanban-add-card" onClick={() => onAddCard(column.id)}>
        + Add card
      </button>
    </div>
  );
}

export function KanbanEditor({ documentId }: KanbanEditorProps) {
  const isMobile = useIsMobile();
  const [data, setData] = useState<KanbanSnapshot | undefined>(undefined);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [detailCard, setDetailCard] = useState<KanbanCard | null>(null);
  const [lastCreatedCardId, setLastCreatedCardId] = useState<string | null>(
    null,
  );
  const [docName, setDocName] = useState("board");
  const [mobileActiveColIdx, setMobileActiveColIdx] = useState(0);
  const [colContextMenu, setColContextMenu] = useState<{
    colId: string;
    x: number;
    y: number;
  } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const isNew = useRef(false);
  const dataRef = useRef<KanbanSnapshot | undefined>(undefined);
  const [adapter, setAdapter] = useState<EditorAdapter | null>(null);

  const desktopSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const mobileSensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const sensors = isMobile ? mobileSensors : desktopSensors;

  useEffect(() => {
    fetch(`/api/meta/${documentId}`)
      .then((r) => r.json())
      .then((meta) => {
        if (meta.name) setDocName(meta.name);
      })
      .catch(() => {});
    fetch(`/api/load/${documentId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.snapshot?.columns) {
          setData(res.snapshot as KanbanSnapshot);
        } else {
          isNew.current = true;
          setData(DEFAULT_SNAPSHOT);
        }
      })
      .catch(() => {
        isNew.current = true;
        setData(DEFAULT_SNAPSHOT);
      });
  }, [documentId]);

  const saveToServer = useCallback(
    async (snapshot: KanbanSnapshot) => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/save/${documentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot, type: "kanban" }),
        });
        setSaveStatus(res.ok ? "saved" : "error");
      } catch {
        setSaveStatus("error");
      }
    },
    [documentId],
  );

  const scheduleSave = useCallback(
    (newData: KanbanSnapshot) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => saveToServer(newData), 1500);
    },
    [saveToServer],
  );

  const updateData = useCallback(
    (updater: (prev: KanbanSnapshot) => KanbanSnapshot) => {
      setData((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        dataRef.current = next;
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  const addCardsFromAI = useCallback(
    (
      cards: Array<{ title: string; description?: string; column?: string }>,
    ) => {
      updateData((prev) => {
        const newCards = [...prev.cards];
        const newColumns = prev.columns.map((col) => ({
          ...col,
          cardIds: [...col.cardIds],
        }));
        for (const c of cards) {
          const cardId = `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          newCards.push({
            id: cardId,
            title: c.title,
            description: c.description || "",
          });
          const targetCol = c.column
            ? newColumns.find(
                (col) => col.title.toLowerCase() === c.column!.toLowerCase(),
              )
            : newColumns[0];
          (targetCol || newColumns[0])?.cardIds.push(cardId);
        }
        return { ...prev, cards: newCards, columns: newColumns };
      });
    },
    [updateData],
  );

  useEffect(() => {
    setAdapter(
      createKanbanAdapter(
        dataRef as { current: KanbanSnapshotType | undefined },
        addCardsFromAI,
      ),
    );
  }, [addCardsFromAI]);

  useEffect(() => {
    if (data && isNew.current) {
      isNew.current = false;
      saveToServer(data);
    }
    dataRef.current = data;
  }, [data, saveToServer]);

  const addCard = useCallback(
    (columnId: string) => {
      const cardId = `card-${Date.now()}`;
      setLastCreatedCardId(cardId);
      updateData((prev) => ({
        ...prev,
        cards: [
          ...prev.cards,
          { id: cardId, title: "New card", description: "" },
        ],
        columns: prev.columns.map((col) =>
          col.id === columnId
            ? { ...col, cardIds: [...col.cardIds, cardId] }
            : col,
        ),
      }));
    },
    [updateData],
  );

  const clearLastCreatedCard = useCallback(() => {
    setLastCreatedCardId(null);
  }, []);

  const updateCard = useCallback(
    (id: string, updates: Partial<KanbanCard>) => {
      updateData((prev) => ({
        ...prev,
        cards: prev.cards.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      }));
    },
    [updateData],
  );

  const deleteCard = useCallback(
    (id: string) => {
      updateData((prev) => ({
        ...prev,
        cards: prev.cards.filter((c) => c.id !== id),
        columns: prev.columns.map((col) => ({
          ...col,
          cardIds: col.cardIds.filter((cid) => cid !== id),
        })),
      }));
    },
    [updateData],
  );

  const addColumn = useCallback(() => {
    const colId = `col-${Date.now()}`;
    updateData((prev) => ({
      ...prev,
      columns: [
        ...prev.columns,
        { id: colId, title: "New Column", cardIds: [] },
      ],
    }));
  }, [updateData]);

  const updateColumn = useCallback(
    (id: string, title: string) => {
      updateData((prev) => ({
        ...prev,
        columns: prev.columns.map((col) =>
          col.id === id ? { ...col, title } : col,
        ),
      }));
    },
    [updateData],
  );

  const setWipLimit = useCallback(
    (id: string, limit: number | undefined) => {
      updateData((prev) => ({
        ...prev,
        columns: prev.columns.map((col) =>
          col.id === id ? { ...col, wipLimit: limit } : col,
        ),
      }));
    },
    [updateData],
  );

  const deleteColumn = useCallback(
    (id: string) => {
      updateData((prev) => {
        const col = prev.columns.find((c) => c.id === id);
        return {
          ...prev,
          columns: prev.columns.filter((c) => c.id !== id),
          cards: prev.cards.filter((c) => !col?.cardIds.includes(c.id)),
        };
      });
    },
    [updateData],
  );

  const moveCardToColumn = useCallback(
    (cardId: string, targetColumnId: string) => {
      updateData((prev) => ({
        ...prev,
        columns: prev.columns.map((col) => {
          if (col.cardIds.includes(cardId) && col.id !== targetColumnId) {
            return {
              ...col,
              cardIds: col.cardIds.filter((id) => id !== cardId),
            };
          }
          if (col.id === targetColumnId && !col.cardIds.includes(cardId)) {
            return { ...col, cardIds: [...col.cardIds, cardId] };
          }
          return col;
        }),
      }));
    },
    [updateData],
  );

  const findColumnOfCard = (cardId: string): string | undefined => {
    return dataRef.current?.columns.find((col) => col.cardIds.includes(cardId))
      ?.id;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (!active.data.current || active.data.current.type !== "column") {
      setActiveCardId(active.id as string);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !data) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (active.data.current?.type === "column") return;

    const activeCol = findColumnOfCard(activeId);
    let overCol = findColumnOfCard(overId);

    if (!overCol) {
      if (data.columns.some((c) => c.id === overId)) {
        overCol = overId;
      }
    }

    if (!activeCol || !overCol || activeCol === overCol) return;

    setData((prev) => {
      if (!prev) return prev;
      const overColData = prev.columns.find((c) => c.id === overCol);
      const overIndex = overColData?.cardIds.indexOf(overId) ?? -1;
      const insertIndex =
        overIndex >= 0 ? overIndex : (overColData?.cardIds.length ?? 0);

      return {
        ...prev,
        columns: prev.columns.map((col) => {
          if (col.id === activeCol) {
            return {
              ...col,
              cardIds: col.cardIds.filter((id) => id !== activeId),
            };
          }
          if (col.id === overCol) {
            const newIds = col.cardIds.filter((id) => id !== activeId);
            newIds.splice(insertIndex, 0, activeId);
            return { ...col, cardIds: newIds };
          }
          return col;
        }),
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);
    if (!over || !data) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (active.data.current?.type === "column") {
      if (activeId !== overId) {
        updateData((prev) => {
          const oldIndex = prev.columns.findIndex((c) => c.id === activeId);
          const newIndex = prev.columns.findIndex((c) => c.id === overId);
          if (oldIndex === -1 || newIndex === -1) return prev;
          return {
            ...prev,
            columns: arrayMove(prev.columns, oldIndex, newIndex),
          };
        });
      }
      return;
    }

    const activeCol = findColumnOfCard(activeId);
    const overCol =
      findColumnOfCard(overId) ||
      (data.columns.some((c) => c.id === overId) ? overId : undefined);

    if (activeCol && activeCol === overCol) {
      updateData((prev) => ({
        ...prev,
        columns: prev.columns.map((col) => {
          if (col.id !== activeCol) return col;
          const oldIndex = col.cardIds.indexOf(activeId);
          const newIndex = col.cardIds.indexOf(overId);
          if (oldIndex === -1 || newIndex === -1) return col;
          return {
            ...col,
            cardIds: arrayMove(col.cardIds, oldIndex, newIndex),
          };
        }),
      }));
    } else if (data) {
      scheduleSave(dataRef.current || data);
    }
  };

  const handleExport = useCallback(() => {
    if (!data) return;
    const lines: string[] = [`# ${docName}`, ""];
    data.columns.forEach((col) => {
      lines.push(`## ${col.title}`, "");
      col.cardIds.forEach((cid) => {
        const card = data.cards.find((c) => c.id === cid);
        if (card) {
          lines.push(`- ${card.title}`);
          if (card.description) lines.push(`  ${card.description}`);
        }
      });
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${docName}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, docName]);

  if (!data) {
    return (
      <div className="editor-loading">
        <div className="editor-loading__spinner" />
        Loading Kanban board...
      </div>
    );
  }

  const activeCard = activeCardId
    ? data.cards.find((c) => c.id === activeCardId)
    : null;

  const detailColumnId = detailCard
    ? data.columns.find((col) => col.cardIds.includes(detailCard.id))?.id
    : undefined;

  const handleColLongPress = (
    colId: string,
    e: React.TouchEvent | React.MouseEvent,
  ) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setColContextMenu({ colId, x: rect.left, y: rect.bottom + 4 });
  };

  const mobileColumn = data.columns[mobileActiveColIdx];
  const mobileColumnCards = mobileColumn
    ? (mobileColumn.cardIds
        .map((id) => data.cards.find((c) => c.id === id))
        .filter(Boolean) as KanbanCard[])
    : [];

  return (
    <EditorShell
      documentId={documentId}
      adapter={adapter}
      saveStatus={saveStatus}
      contentClassName="kanban-board-wrapper"
      onExport={handleExport}
      exportLabel="Export .md"
    >
      {isMobile ? (
        <div className="kanban-mobile">
          <div className="kanban-mobile__tabs">
            {data.columns.map((col, idx) => (
              <button
                key={col.id}
                className={`kanban-mobile__tab${idx === mobileActiveColIdx ? " kanban-mobile__tab--active" : ""}`}
                onClick={() => setMobileActiveColIdx(idx)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleColLongPress(col.id, e);
                }}
                onTouchStart={() => {
                  longPressTimer.current = setTimeout(() => {
                    const el = document.querySelector(
                      `[data-col-tab="${col.id}"]`,
                    );
                    if (el) {
                      const rect = el.getBoundingClientRect();
                      setColContextMenu({
                        colId: col.id,
                        x: rect.left,
                        y: rect.bottom + 4,
                      });
                    }
                  }, 500);
                }}
                onTouchEnd={() => {
                  if (longPressTimer.current)
                    clearTimeout(longPressTimer.current);
                }}
                onTouchMove={() => {
                  if (longPressTimer.current)
                    clearTimeout(longPressTimer.current);
                }}
                data-col-tab={col.id}
              >
                {col.title}
                <span className="kanban-mobile__tab-count">
                  {col.cardIds.length}
                </span>
              </button>
            ))}
            <button
              className="kanban-mobile__tab kanban-mobile__tab--add"
              onClick={addColumn}
            >
              +
            </button>
          </div>
          {colContextMenu && (
            <>
              <div
                className="kanban-mobile__ctx-backdrop"
                onClick={() => setColContextMenu(null)}
              />
              <div
                className="kanban-mobile__ctx-menu"
                style={{ left: colContextMenu.x, top: colContextMenu.y }}
              >
                <button
                  onClick={() => {
                    const col = data.columns.find(
                      (c) => c.id === colContextMenu.colId,
                    );
                    if (!col) return;
                    const name = window.prompt("Column name:", col.title);
                    if (name?.trim()) updateColumn(col.id, name.trim());
                    setColContextMenu(null);
                  }}
                >
                  Rename
                </button>
                <button
                  onClick={() => {
                    const col = data.columns.find(
                      (c) => c.id === colContextMenu.colId,
                    );
                    if (!col) return;
                    const val = window.prompt(
                      "WIP limit (0 = none):",
                      col.wipLimit?.toString() || "0",
                    );
                    if (val !== null) {
                      const n = parseInt(val, 10);
                      setWipLimit(col.id, n > 0 ? n : undefined);
                    }
                    setColContextMenu(null);
                  }}
                >
                  Set WIP Limit
                </button>
                <button
                  className="kanban-mobile__ctx-menu--danger"
                  onClick={() => {
                    deleteColumn(colContextMenu.colId);
                    setColContextMenu(null);
                    if (mobileActiveColIdx >= data.columns.length - 1) {
                      setMobileActiveColIdx(
                        Math.max(0, data.columns.length - 2),
                      );
                    }
                  }}
                >
                  Delete Column
                </button>
              </div>
            </>
          )}
          {mobileColumn && (
            <div className="kanban-mobile__column">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={mobileColumn.cardIds}
                  strategy={verticalListSortingStrategy}
                >
                  {mobileColumnCards.map((card) => (
                    <SortableCard
                      key={card.id}
                      card={card}
                      onUpdate={updateCard}
                      onDelete={deleteCard}
                      onOpenDetail={setDetailCard}
                      autoEdit={card.id === lastCreatedCardId}
                      onAutoEditDone={clearLastCreatedCard}
                    />
                  ))}
                </SortableContext>
                <DragOverlay>
                  {activeCard ? <CardOverlay card={activeCard} /> : null}
                </DragOverlay>
              </DndContext>
              <button
                className="kanban-add-card"
                onClick={() => addCard(mobileColumn.id)}
              >
                + Add card
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="kanban-board">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={data.columns.map((c) => c.id)}
              strategy={horizontalListSortingStrategy}
            >
              {data.columns.map((column) => (
                <SortableColumn
                  key={column.id}
                  column={column}
                  cards={data.cards}
                  onUpdateCard={updateCard}
                  onDeleteCard={deleteCard}
                  onAddCard={addCard}
                  onUpdateColumn={updateColumn}
                  onDeleteColumn={deleteColumn}
                  onOpenDetail={setDetailCard}
                  onSetWipLimit={setWipLimit}
                  lastCreatedCardId={lastCreatedCardId}
                  onAutoEditDone={clearLastCreatedCard}
                />
              ))}
            </SortableContext>
            <DragOverlay>
              {activeCard ? <CardOverlay card={activeCard} /> : null}
            </DragOverlay>
          </DndContext>
          <button className="kanban-add-column" onClick={addColumn}>
            + Add column
          </button>
        </div>
      )}
      {detailCard && (
        <CardDetailModal
          card={detailCard}
          onUpdate={updateCard}
          onClose={() => setDetailCard(null)}
          columns={data.columns}
          currentColumnId={detailColumnId}
          onMoveToColumn={moveCardToColumn}
        />
      )}
    </EditorShell>
  );
}
