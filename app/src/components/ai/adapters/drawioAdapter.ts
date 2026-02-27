import type { EditorAdapter } from "../EditorAdapter";

export function mergeDrawioXml(existingXml: string, newCells: string): string {
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
