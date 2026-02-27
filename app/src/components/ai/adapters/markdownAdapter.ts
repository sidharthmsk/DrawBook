import type { BlockNoteEditor } from "@blocknote/core";
import type { EditorAdapter } from "../EditorAdapter";

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
