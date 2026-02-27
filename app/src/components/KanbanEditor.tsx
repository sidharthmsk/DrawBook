import { useCallback, useEffect, useRef, useState } from "react";
import { EditorShell } from "./EditorShell";
import {
  createKanbanAdapter,
  type KanbanSnapshot as KanbanSnapshotType,
  type EditorAdapter,
} from "./ai/EditorAdapter";
import { useConfirm } from "./ConfirmDialog";
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
  arrayMove,
} from "@dnd-kit/sortable";
import { useIsMobile } from "../hooks/useIsMobile";

import {
  type KanbanCard,
  type KanbanColumn,
  type KanbanSnapshot,
  DEFAULT_SNAPSHOT,
  type KanbanEditorProps,
} from "./kanban/types";
import { CardDetailModal } from "./kanban/CardDetailModal";
import { SortableCard, CardOverlay } from "./kanban/SortableCard";
import { SortableColumn } from "./kanban/SortableColumn";

export function KanbanEditor({ documentId }: KanbanEditorProps) {
  const isMobile = useIsMobile();
  const confirm = useConfirm();
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
    async (id: string) => {
      if (!(await confirm({ message: "Delete this card?", danger: true })))
        return;
      updateData((prev) => ({
        ...prev,
        cards: prev.cards.filter((c) => c.id !== id),
        columns: prev.columns.map((col) => ({
          ...col,
          cardIds: col.cardIds.filter((cid) => cid !== id),
        })),
      }));
    },
    [updateData, confirm],
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
    async (id: string) => {
      if (
        !(await confirm({
          message: "Delete this column and all its cards?",
          danger: true,
        }))
      )
        return;
      updateData((prev) => {
        const col = prev.columns.find((c) => c.id === id);
        return {
          ...prev,
          columns: prev.columns.filter((c) => c.id !== id),
          cards: prev.cards.filter((c) => !col?.cardIds.includes(c.id)),
        };
      });
    },
    [updateData, confirm],
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
