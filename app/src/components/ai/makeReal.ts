import { Editor, createShapeId } from "tldraw";
import { getSvgAsImage } from "tldraw";
import type { PreviewShape } from "./PreviewShape";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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

  // Create a placeholder preview shape to the right of the selection
  const newShapeId = createShapeId();
  editor.createShape<PreviewShape>({
    id: newShapeId,
    type: "preview",
    x: selectionBounds.maxX + 60,
    y: selectionBounds.midY - 220,
    props: { html: "", w: 540, h: 440 },
  });

  try {
    // Export selection as SVG, then convert to JPEG
    const svgResult = await editor.getSvgString(selectedShapes);
    if (!svgResult) {
      throw new Error("Could not export selection as SVG.");
    }

    const IS_SAFARI = /^((?!chrome|android).)*safari/i.test(
      navigator.userAgent,
    );
    const scale = Math.min(1, 1000 / svgResult.width, 1000 / svgResult.height);

    const blob = await getSvgAsImage(editor, svgResult.svg, {
      type: IS_SAFARI ? "png" : "jpeg",
      quality: 0.9,
      scale,
      width: svgResult.width,
      height: svgResult.height,
    });

    if (!blob) {
      throw new Error("Could not convert SVG to image.");
    }

    const dataUrl = await blobToBase64(blob);

    // Gather text from selected shapes
    const text = getTextFromShapes(editor);

    // Check if any selected shapes are previous previews
    const previousPreviews = selectedShapes.filter(
      (s) => s.type === "preview",
    ) as PreviewShape[];
    const previousHtml = previousPreviews[0]?.props.html || undefined;

    // Determine theme
    const theme = editor.user.getIsDarkMode() ? "dark" : "light";

    // Call the backend API
    const response = await fetch("/api/ai/generate-ui", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: dataUrl,
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

    // Update the preview shape with the generated HTML
    editor.updateShape<PreviewShape>({
      id: newShapeId,
      type: "preview",
      props: { html },
    });
  } catch (e) {
    // Clean up the placeholder shape on failure
    editor.deleteShape(newShapeId);
    throw e;
  }
}
