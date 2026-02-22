import { useCallback, useEffect, useRef, useState } from "react";
import { EditableTitle } from "./EditableTitle";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
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

interface KanbanEditorProps {
  documentId: string;
}

interface KanbanCard {
  id: string;
  title: string;
  description: string;
}

interface KanbanColumn {
  id: string;
  title: string;
  cardIds: string[];
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

function SortableCard({
  card,
  onUpdate,
  onDelete,
}: {
  card: KanbanCard;
  onUpdate: (id: string, updates: Partial<KanbanCard>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
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

  return (
    <div ref={setNodeRef} style={style} className="kanban-card" {...attributes}>
      <div className="kanban-card__drag" {...listeners}>
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
            autoFocus
          />
        ) : (
          <span
            className="kanban-card__title"
            onDoubleClick={() => setEditing(true)}
          >
            {card.title}
          </span>
        )}
      </div>
      <button className="kanban-card__delete" onClick={() => onDelete(card.id)}>
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
}: {
  column: KanbanColumn;
  cards: KanbanCard[];
  onUpdateCard: (id: string, updates: Partial<KanbanCard>) => void;
  onDeleteCard: (id: string) => void;
  onAddCard: (columnId: string) => void;
  onUpdateColumn: (id: string, title: string) => void;
  onDeleteColumn: (id: string) => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(column.title);
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
        <span className="kanban-column__count">{columnCards.length}</span>
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
  const [data, setData] = useState<KanbanSnapshot | undefined>(undefined);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const isNew = useRef(false);
  const dataRef = useRef<KanbanSnapshot | undefined>(undefined);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  useEffect(() => {
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

  return (
    <div className="editor-wrapper">
      <div className="editor-topbar">
        <button
          className="editor-back-btn"
          onClick={() => (window.location.href = "/")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 12L6 8l4-4" />
          </svg>
          Back
        </button>
        <EditableTitle documentId={documentId} />
        <div className="editor-topbar__status">
          <span
            className={`editor-status-dot editor-status-dot--${saveStatus === "error" ? "error" : saveStatus === "saved" ? "saved" : "saving"}`}
          />
          <span>
            {saveStatus === "saved"
              ? "Saved"
              : saveStatus === "saving"
                ? "Saving..."
                : "Error"}
          </span>
        </div>
      </div>
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
    </div>
  );
}
