import { useState } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SortableCard } from "./SortableCard";
import type { KanbanCard, KanbanColumn } from "./types";

export function SortableColumn({
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
