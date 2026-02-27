import { createShapeId, type Editor, type TLShapePartial } from "tldraw";
import type { BlockNoteEditor } from "@blocknote/core";

export type EditorType =
  | "excalidraw"
  | "markdown"
  | "tldraw"
  | "drawio"
  | "kanban"
  | "spreadsheet"
  | "grid"
  | "code";

export interface EditorAdapter {
  type: EditorType;
  getContext(): string;
  applyContent(content: string): void | Promise<void>;
}

export function createTldrawAdapter(editor: Editor): EditorAdapter {
  return {
    type: "tldraw",
    getContext() {
      const shapes = editor.getCurrentPageShapes();
      if (shapes.length === 0) return "The canvas is empty.";

      const descriptions: string[] = [];
      for (const shape of shapes.slice(0, 50)) {
        const props = shape.props as Record<string, unknown>;
        const bounds = editor.getShapePageBounds(shape.id);
        const parts: string[] = [`${shape.type}`];

        if (bounds) {
          parts.push(`at (${Math.round(bounds.x)},${Math.round(bounds.y)})`);
          parts.push(
            `${Math.round(bounds.width)}x${Math.round(bounds.height)}`,
          );
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
    },
    applyContent(content: string) {
      try {
        const shapeDescriptions = JSON.parse(content) as Array<{
          type: string;
          x?: number;
          y?: number;
          w?: number;
          h?: number;
          text?: string;
          color?: string;
          geo?: string;
          start?: { x: number; y: number };
          end?: { x: number; y: number };
        }>;
        if (!Array.isArray(shapeDescriptions)) return;

        // Offset new shapes to the right of existing content
        let offsetX = 100;
        const existingShapes = editor.getCurrentPageShapes();
        if (existingShapes.length > 0) {
          let maxRight = -Infinity;
          for (const shape of existingShapes) {
            const bounds = editor.getShapePageBounds(shape.id);
            if (bounds) {
              const right = bounds.x + bounds.width;
              if (right > maxRight) maxRight = right;
            }
          }
          offsetX = maxRight + 100;
        }

        const shapes: TLShapePartial[] = shapeDescriptions.map((desc, i) => {
          const id = createShapeId(`ai-${Date.now()}-${i}`);
          const x = (desc.x || 0) + offsetX;
          const y = (desc.y || 0) + 100;

          if (desc.type === "arrow") {
            return {
              id,
              type: "arrow",
              x,
              y,
              props: {
                ...(desc.color ? { color: desc.color } : {}),
                start: desc.start
                  ? { x: desc.start.x, y: desc.start.y }
                  : { x: 0, y: 0 },
                end: desc.end
                  ? { x: desc.end.x, y: desc.end.y }
                  : { x: desc.w || 100, y: desc.h || 0 },
              },
            } as TLShapePartial;
          }

          if (desc.type === "text") {
            return {
              id,
              type: "text",
              x,
              y,
              props: {
                text: desc.text || "",
                ...(desc.color ? { color: desc.color } : {}),
                ...(desc.w ? { w: desc.w } : {}),
              },
            } as TLShapePartial;
          }

          if (desc.type === "note") {
            return {
              id,
              type: "note",
              x,
              y,
              props: {
                text: desc.text || "",
                ...(desc.color ? { color: desc.color } : {}),
                ...(desc.w ? { w: desc.w } : {}),
                ...(desc.h ? { h: desc.h } : {}),
              },
            } as TLShapePartial;
          }

          // Default: geo shape (rectangle, ellipse, etc.)
          return {
            id,
            type: "geo",
            x,
            y,
            props: {
              w: desc.w || 200,
              h: desc.h || 100,
              text: desc.text || "",
              geo: desc.geo || "rectangle",
              ...(desc.color ? { color: desc.color } : {}),
            },
          } as TLShapePartial;
        });

        editor.createShapes(shapes);
      } catch (e) {
        console.error("[AI] Failed to apply tldraw content:", e);
      }
    },
  };
}

export function createExcalidrawAdapter(
  getElements: () => any[],
  updateScene: (scene: { elements: any[] }) => void,
): EditorAdapter {
  return {
    type: "excalidraw",
    getContext() {
      const elements = getElements().filter((el: any) => !el.isDeleted);
      if (elements.length === 0) return "The canvas is empty.";

      const descriptions: string[] = [];
      for (const el of elements.slice(0, 50)) {
        const parts: string[] = [el.type];
        parts.push(`at (${Math.round(el.x)},${Math.round(el.y)})`);
        if (el.width && el.height) {
          parts.push(`${Math.round(el.width)}x${Math.round(el.height)}`);
        }
        if (el.type === "text" && el.text) {
          parts.push(`"${el.text.trim().slice(0, 100)}"`);
        }
        if (el.label) {
          parts.push(`label: "${el.label.trim().slice(0, 100)}"`);
        }
        descriptions.push(parts.join(" "));
      }

      const summary = `${elements.length} element(s) on canvas:\n${descriptions.join("\n")}`;
      if (elements.length > 50) {
        return `${summary}\n... and ${elements.length - 50} more elements`;
      }
      return summary;
    },
    applyContent(content: string) {
      try {
        const newElements = JSON.parse(content) as any[];
        if (!Array.isArray(newElements)) return;

        const existing = getElements().filter((el: any) => !el.isDeleted);

        let offsetX = 100;
        let offsetY = 100;
        if (existing.length > 0) {
          let maxX = -Infinity;
          for (const el of existing) {
            const right = el.x + (el.width || 0);
            if (right > maxX) maxX = right;
          }
          offsetX = maxX + 100;
          offsetY = 100;
        }

        const prepared = newElements.map((el: any, i: number) => {
          const base: Record<string, any> = {
            angle: 0,
            strokeColor: "#e8e5e0",
            backgroundColor: "transparent",
            fillStyle: "solid",
            strokeWidth: 2,
            roughness: 1,
            opacity: 100,
            groupIds: [],
            roundness: { type: 3 },
            boundElements: null,
            updated: Date.now(),
            link: null,
            locked: false,
            isDeleted: false,
            ...el,
            id: el.id || `ai-${Date.now()}-${i}`,
            x: (el.x || 0) + offsetX,
            y: (el.y || 0) + offsetY,
            version: 1,
            versionNonce: Math.floor(Math.random() * 1e9),
            seed: Math.floor(Math.random() * 1e9),
          };

          if (base.type === "text") {
            base.fontSize = base.fontSize || 20;
            base.fontFamily = base.fontFamily || 1;
            base.textAlign = base.textAlign || "left";
            base.verticalAlign = base.verticalAlign || "top";
            base.originalText = base.originalText || base.text || "";
            base.text = base.text || "";
            base.containerId = base.containerId || null;
            base.lineHeight = base.lineHeight || 1.25;
          }

          if (base.type === "arrow" || base.type === "line") {
            if (!base.points || !Array.isArray(base.points)) {
              base.points = [
                [0, 0],
                [base.width || 100, base.height || 0],
              ];
            }
            base.lastCommittedPoint = null;
            base.startBinding = base.startBinding || null;
            base.endBinding = base.endBinding || null;
            base.startArrowhead =
              base.type === "arrow" ? base.startArrowhead || null : null;
            base.endArrowhead =
              base.type === "arrow" ? (base.endArrowhead ?? "arrow") : null;
          }

          return base;
        });

        updateScene({ elements: [...existing, ...prepared] });
      } catch (e) {
        console.error("[AI] Failed to apply Excalidraw content:", e);
      }
    },
  };
}

export function createMarkdownAdapter(editorRef: {
  current: BlockNoteEditor | null;
}): EditorAdapter {
  return {
    type: "markdown",
    getContext() {
      const editor = editorRef.current;
      if (!editor) return "Editor not loaded.";

      const blocks = editor.document;
      if (!blocks || blocks.length === 0) return "The document is empty.";

      const texts: string[] = [];
      for (const block of blocks.slice(0, 100)) {
        const content = (block as any).content;
        if (Array.isArray(content)) {
          const text = content
            .map((c: any) => (typeof c === "string" ? c : c.text || ""))
            .join("");
          if (text.trim()) texts.push(text.trim());
        }
      }

      if (texts.length === 0) return "The document is empty.";
      return `Document content:\n${texts.join("\n")}`;
    },
    async applyContent(content: string) {
      const editor = editorRef.current;
      if (!editor) return;

      try {
        const newBlocks = await editor.tryParseMarkdownToBlocks(content);
        if (newBlocks.length > 0) {
          const lastBlock = editor.document[editor.document.length - 1];
          editor.insertBlocks(newBlocks, lastBlock, "after");
        }
      } catch (e) {
        console.error("[AI] Failed to apply markdown content:", e);
      }
    },
  };
}

function mergeDrawioXml(existingXml: string, newCells: string): string {
  if (!existingXml) {
    return `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${newCells}</root></mxGraphModel>`;
  }

  const closingRoot = "</root>";
  const idx = existingXml.lastIndexOf(closingRoot);
  if (idx === -1) {
    return `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${newCells}</root></mxGraphModel>`;
  }

  return existingXml.slice(0, idx) + newCells + existingXml.slice(idx);
}

export function createDrawioAdapter(
  xmlRef: { current: string },
  iframeRef: { current: HTMLIFrameElement | null },
): EditorAdapter {
  return {
    type: "drawio",
    getContext() {
      const xml = xmlRef.current;
      if (!xml) return "The diagram is empty.";

      try {
        const cells: string[] = [];
        const connections: string[] = [];

        const cellRegex =
          /<mxCell\s+([^>]*?)\/?>|<mxCell\s+([^>]*?)>[\s\S]*?<\/mxCell>/g;
        let match;

        while ((match = cellRegex.exec(xml)) !== null) {
          const attrs = match[1] || match[2] || "";

          const getId = (s: string) => {
            const m = s.match(/\bid=["']([^"']*)["']/);
            return m ? m[1] : null;
          };
          const getValue = (s: string) => {
            const m = s.match(/\bvalue=["']([^"']*)["']/);
            return m ? m[1] : null;
          };
          const getStyle = (s: string) => {
            const m = s.match(/\bstyle=["']([^"']*)["']/);
            return m ? m[1] : null;
          };
          const getSource = (s: string) => {
            const m = s.match(/\bsource=["']([^"']*)["']/);
            return m ? m[1] : null;
          };
          const getTarget = (s: string) => {
            const m = s.match(/\btarget=["']([^"']*)["']/);
            return m ? m[1] : null;
          };

          const id = getId(attrs);
          const value = getValue(attrs);
          const style = getStyle(attrs);
          const source = getSource(attrs);
          const target = getTarget(attrs);

          if (id === "0" || id === "1") continue;

          if (source && target) {
            const label = value ? ` labeled "${value}"` : "";
            connections.push(`${source} -> ${target}${label}`);
          } else if (value) {
            let shapeType = "shape";
            if (style) {
              if (style.includes("ellipse")) shapeType = "ellipse";
              else if (style.includes("rhombus")) shapeType = "diamond";
              else if (style.includes("rounded=1")) shapeType = "rounded rect";
              else if (style.includes("shape=")) {
                const sm = style.match(/shape=(\w+)/);
                if (sm) shapeType = sm[1];
              }
            }
            cells.push(`[${id}] ${shapeType}: "${value}"`);
          }
        }

        if (cells.length === 0 && connections.length === 0) {
          return "The diagram is empty.";
        }

        const parts: string[] = [];
        if (cells.length > 0) {
          parts.push(`${cells.length} shape(s):\n${cells.join("\n")}`);
        }
        if (connections.length > 0) {
          parts.push(
            `${connections.length} connection(s):\n${connections.join("\n")}`,
          );
        }
        return parts.join("\n\n");
      } catch (e) {
        console.error("[AI] Failed to parse draw.io XML:", e);
        return "Unable to read diagram content.";
      }
    },
    applyContent(content: string) {
      try {
        const iframe = iframeRef.current;
        if (!iframe?.contentWindow) return;

        const merged = mergeDrawioXml(xmlRef.current, content);
        xmlRef.current = merged;
        iframe.contentWindow.postMessage(
          JSON.stringify({ action: "load", xml: merged, autosave: 1 }),
          "https://embed.diagrams.net",
        );
      } catch (e) {
        console.error("[AI] Failed to apply draw.io content:", e);
      }
    },
  };
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

export function createSpreadsheetAdapter(
  univerRef: { current: { univerAPI: any } | null },
  setCells?: (
    cells: Array<{ row: number; col: number; value: string | number }>,
  ) => void,
): EditorAdapter {
  return {
    type: "spreadsheet",
    getContext() {
      const api = univerRef.current?.univerAPI;
      if (!api) return "Spreadsheet not loaded.";

      const wb = api.getActiveWorkbook();
      if (!wb) return "No active workbook.";

      try {
        const data = wb.save();
        const sheets = data?.sheets;
        if (!sheets || typeof sheets !== "object")
          return "The spreadsheet is empty.";

        const parts: string[] = [];
        let cellCount = 0;
        const maxCells = 50;

        for (const [sheetId, sheet] of Object.entries(sheets) as [
          string,
          any,
        ][]) {
          const name = sheet.name || sheetId;
          const cellData = sheet.cellData;
          if (!cellData || typeof cellData !== "object") {
            parts.push(`Sheet "${name}": empty`);
            continue;
          }

          const cells: string[] = [];
          for (const [rowIdx, row] of Object.entries(cellData) as [
            string,
            any,
          ][]) {
            if (cellCount >= maxCells) break;
            if (!row || typeof row !== "object") continue;
            for (const [colIdx, cell] of Object.entries(row) as [
              string,
              any,
            ][]) {
              if (cellCount >= maxCells) break;
              const val = cell?.v;
              if (val !== undefined && val !== null && val !== "") {
                cells.push(
                  `  [${rowIdx},${colIdx}]: ${String(val).slice(0, 100)}`,
                );
                cellCount++;
              }
            }
          }

          if (cells.length > 0) {
            parts.push(
              `Sheet "${name}" (${cells.length} cells):\n${cells.join("\n")}`,
            );
          } else {
            parts.push(`Sheet "${name}": empty`);
          }
        }

        if (parts.length === 0) return "The spreadsheet is empty.";
        const summary = parts.join("\n\n");
        if (cellCount >= maxCells) {
          return `${summary}\n... (showing first ${maxCells} cells)`;
        }
        return summary;
      } catch (e) {
        console.error("[AI] Failed to read spreadsheet:", e);
        return "Unable to read spreadsheet content.";
      }
    },
    applyContent(content: string) {
      if (!setCells) return;
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          setCells(parsed);
        }
      } catch {
        // ignore invalid JSON
      }
    },
  };
}

interface GridTableSnapshot {
  columns: Array<{ id: string; name: string; type: string }>;
  rows: Array<{ id: string; cells: Record<string, unknown> }>;
}

export function createGridAdapter(
  dataRef: { current: GridTableSnapshot | undefined },
  addRows?: (rows: Array<Record<string, unknown>>) => void,
): EditorAdapter {
  return {
    type: "grid",
    getContext() {
      const data = dataRef.current;
      if (!data || data.columns.length === 0) return "The table is empty.";

      const header = data.columns.map((c) => c.name).join(" | ");
      const separator = data.columns.map(() => "---").join(" | ");
      const bodyRows = data.rows.slice(0, 50).map((row) =>
        data.columns
          .map((col) => {
            const val = row.cells[col.id];
            if (val === null || val === undefined) return "";
            if (Array.isArray(val)) return val.join(", ");
            return String(val);
          })
          .join(" | "),
      );

      const table = [header, separator, ...bodyRows].join("\n");
      const summary = `Table with ${data.columns.length} column(s) and ${data.rows.length} row(s):\n\n${table}`;
      if (data.rows.length > 50) {
        return `${summary}\n... and ${data.rows.length - 50} more rows`;
      }
      return summary;
    },
    applyContent(content: string) {
      if (!addRows) return;
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          addRows(parsed);
        }
      } catch {
        console.warn("Failed to parse grid AI content");
      }
    },
  };
}

export function createCodeAdapter(
  contentRef: { current: string },
  languageRef: { current: string },
  setContent: (code: string) => void,
): EditorAdapter {
  return {
    type: "code",
    getContext() {
      const code = contentRef.current;
      const lang = languageRef.current;
      if (!code.trim()) return `Empty ${lang} file.`;
      const lines = code.split("\n");
      const preview = lines.slice(0, 100).join("\n");
      const summary = `${lang} file (${lines.length} lines):\n\`\`\`${lang}\n${preview}\n\`\`\``;
      if (lines.length > 100) {
        return `${summary}\n... and ${lines.length - 100} more lines`;
      }
      return summary;
    },
    applyContent(content: string) {
      const fenced = content.match(/```[\w]*\n([\s\S]*?)```/);
      const code = fenced ? fenced[1] : content;
      const current = contentRef.current;
      if (current.trim()) {
        setContent(current + "\n\n" + code);
      } else {
        setContent(code);
      }
    },
  };
}
