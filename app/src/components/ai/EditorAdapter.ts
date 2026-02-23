import type { Editor } from "tldraw";
import type { BlockNoteEditor } from "@blocknote/core";

export type EditorType = "excalidraw" | "markdown" | "tldraw";

export interface EditorAdapter {
  type: EditorType;
  getContext(): string;
  applyContent(content: string): void;
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
    applyContent() {
      // tldraw write-back not implemented yet
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

        const prepared = newElements.map((el: any, i: number) => ({
          ...el,
          id: el.id || `ai-${Date.now()}-${i}`,
          x: (el.x || 0) + offsetX,
          y: (el.y || 0) + offsetY,
          version: 1,
          versionNonce: Math.floor(Math.random() * 1e9),
          seed: Math.floor(Math.random() * 1e9),
        }));

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
