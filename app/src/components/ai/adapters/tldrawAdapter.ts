import { createShapeId, type Editor, type TLShapePartial } from "tldraw";
import type { EditorAdapter } from "../EditorAdapter";

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
