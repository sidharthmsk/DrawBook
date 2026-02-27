import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { EditorAdapter } from "../EditorAdapter";

export function createExcalidrawAdapter(
  getElements: () => any[],
  updateScene: (scene: { elements: any[]; files?: any }) => void,
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
    async applyContent(content: string) {
      try {
        const { elements: skeletonElements, files } =
          await parseMermaidToExcalidraw(content, {
            themeVariables: { fontSize: "14px" },
          });

        const excalidrawElements =
          convertToExcalidrawElements(skeletonElements);

        const existing = getElements().filter((el: any) => !el.isDeleted);

        let offsetX = 100;
        if (existing.length > 0) {
          let maxX = -Infinity;
          for (const el of existing) {
            const right = el.x + (el.width || 0);
            if (right > maxX) maxX = right;
          }
          offsetX = maxX + 100;
        }

        const offsetElements = excalidrawElements.map((el: any) => ({
          ...el,
          x: (el.x || 0) + offsetX,
          y: (el.y || 0) + 100,
        }));

        updateScene({
          elements: [...existing, ...offsetElements],
          ...(files ? { files } : {}),
        });
      } catch (e) {
        console.error("[AI] Failed to convert Mermaid to Excalidraw:", e);
      }
    },
  };
}
