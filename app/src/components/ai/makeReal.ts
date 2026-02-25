import { Editor, createShapeId } from "tldraw";
import type { PreviewShape } from "./PreviewShape";

function describeShapes(editor: Editor): string {
  const selectedShapes = editor.getSelectedShapes();
  const descriptions: string[] = [];

  for (const shape of selectedShapes) {
    const props = shape.props as Record<string, unknown>;
    const bounds = editor.getShapePageBounds(shape.id);
    const parts: string[] = [];

    parts.push(`Type: ${shape.type}`);

    if (bounds) {
      parts.push(
        `Position: (${Math.round(bounds.x)}, ${Math.round(bounds.y)})`,
      );
      parts.push(
        `Size: ${Math.round(bounds.width)}x${Math.round(bounds.height)}`,
      );
    }

    if (typeof props.text === "string" && props.text.trim()) {
      parts.push(`Text: "${props.text.trim()}"`);
    }

    if (typeof props.geo === "string") {
      parts.push(`Shape: ${props.geo}`);
    }

    if (typeof props.color === "string") {
      parts.push(`Color: ${props.color}`);
    }

    if (typeof props.size === "string") {
      parts.push(`Size style: ${props.size}`);
    }

    if (typeof props.font === "string") {
      parts.push(`Font: ${props.font}`);
    }

    if (typeof props.align === "string") {
      parts.push(`Align: ${props.align}`);
    }

    if (typeof props.url === "string" && props.url.trim()) {
      parts.push(`URL: ${props.url.trim()}`);
    }

    if (shape.type === "arrow") {
      parts.push("(Arrow connecting elements)");
    }

    if (shape.type === "preview" && typeof props.html === "string") {
      parts.push(`Previous HTML prototype (${props.html.length} chars)`);
    }

    descriptions.push(`- ${parts.join(", ")}`);
  }

  return descriptions.join("\n");
}

function getTextFromShapes(editor: Editor): string {
  const selectedShapes = editor.getSelectedShapes();
  const texts: string[] = [];

  for (const shape of selectedShapes) {
    const props = shape.props as Record<string, unknown>;
    if (typeof props.text === "string" && props.text.trim()) {
      texts.push(props.text.trim());
    }
  }

  return texts.join("\n");
}

export async function makeReal(editor: Editor) {
  const selectedShapes = editor.getSelectedShapes();
  if (selectedShapes.length === 0) {
    throw new Error("First select something to make real.");
  }

  const selectionBounds = editor.getSelectionPageBounds();
  if (!selectionBounds) {
    throw new Error("Could not get bounds of selection.");
  }

  const newShapeId = createShapeId();
  editor.createShape<PreviewShape>({
    id: newShapeId,
    type: "preview",
    x: selectionBounds.maxX + 60,
    y: selectionBounds.midY - 220,
    props: { html: "", w: 540, h: 440 },
  });

  try {
    const shapeDescriptions = describeShapes(editor);
    const text = getTextFromShapes(editor);

    const previousPreviews = selectedShapes.filter(
      (s) => s.type === "preview",
    ) as PreviewShape[];
    const previousHtml = previousPreviews[0]?.props.html || undefined;

    const theme = editor.user.getIsDarkMode() ? "dark" : "light";

    const response = await fetch("/api/ai/generate-ui", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shapeDescriptions,
        text: text || undefined,
        previousHtml,
        theme,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(
        (err as { error?: string }).error ||
          `Server returned ${response.status}`,
      );
    }

    const { html } = (await response.json()) as { html: string };

    if (!html || html.length < 50) {
      throw new Error("Could not generate a design from those wireframes.");
    }

    editor.updateShape<PreviewShape>({
      id: newShapeId,
      type: "preview",
      props: { html },
    });
  } catch (e) {
    editor.deleteShape(newShapeId);
    throw e;
  }
}
