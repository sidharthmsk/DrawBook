import type { EditorAdapter } from "../EditorAdapter";

export interface KanbanCard {
  id: string;
  title: string;
  description: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  cardIds: string[];
}

export interface KanbanSnapshot {
  columns: KanbanColumn[];
  cards: KanbanCard[];
}

export function createKanbanAdapter(
  dataRef: { current: KanbanSnapshot | undefined },
  addCards?: (
    cards: Array<{ title: string; description?: string; column?: string }>,
  ) => void,
): EditorAdapter {
  return {
    type: "kanban",
    getContext() {
      const data = dataRef.current;
      if (!data || data.columns.length === 0) return "The board is empty.";

      const cardMap = new Map(data.cards.map((c) => [c.id, c]));
      const parts: string[] = [];

      for (const col of data.columns) {
        const cardTitles = col.cardIds
          .map((id) => cardMap.get(id))
          .filter(Boolean)
          .map((c) => `  - ${c!.title}`);

        if (cardTitles.length > 0) {
          parts.push(
            `${col.title} (${cardTitles.length} cards):\n${cardTitles.join("\n")}`,
          );
        } else {
          parts.push(`${col.title} (empty)`);
        }
      }

      return `Kanban board with ${data.columns.length} column(s):\n\n${parts.join("\n\n")}`;
    },
    applyContent(content: string) {
      if (!addCards) return;
      try {
        const parsed = JSON.parse(content) as Array<{
          title: string;
          description?: string;
          column?: string;
        }>;
        if (Array.isArray(parsed)) addCards(parsed);
      } catch {
        console.warn("Failed to parse kanban AI content");
      }
    },
  };
}
