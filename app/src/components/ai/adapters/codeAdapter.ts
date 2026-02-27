import type { EditorAdapter } from "../EditorAdapter";

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
