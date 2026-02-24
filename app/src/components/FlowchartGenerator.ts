interface StructNode {
  label: string;
  children?: string[];
}

interface DocStructure {
  id: string;
  name: string;
  type: string;
  nodes: StructNode[];
}

interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  roughness: number;
  opacity: number;
  groupIds: string[];
  roundness: { type: number } | null;
  boundElements: Array<{ id: string; type: string }> | null;
  updated: number;
  link: null;
  locked: boolean;
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: string;
  verticalAlign?: string;
  containerId?: string | null;
  originalText?: string;
  autoResize?: boolean;
  points?: number[][];
  startBinding?: { elementId: string; focus: number; gap: number } | null;
  endBinding?: { elementId: string; focus: number; gap: number } | null;
  startArrowhead?: string | null;
  endArrowhead?: string;
  [key: string]: unknown;
}

const TYPE_COLORS: Record<string, string> = {
  markdown: "#a5d8ff",
  kanban: "#b2f2bb",
  excalidraw: "#ffec99",
  tldraw: "#d0bfff",
  spreadsheet: "#c3fae8",
  drawio: "#ffc9c9",
};

let idCounter = 0;
function uid() {
  return `fc-${Date.now()}-${idCounter++}`;
}

function makeRect(
  x: number,
  y: number,
  w: number,
  h: number,
  bg: string,
  id?: string,
): ExcalidrawElement {
  const eid = id || uid();
  return {
    id: eid,
    type: "rectangle",
    x,
    y,
    width: w,
    height: h,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: bg,
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
  };
}

function makeText(
  x: number,
  y: number,
  text: string,
  fontSize: number = 16,
  containerId?: string,
): ExcalidrawElement {
  const w = text.length * fontSize * 0.55;
  return {
    id: uid(),
    type: "text",
    x,
    y,
    width: w,
    height: fontSize * 1.4,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    roughness: 0,
    opacity: 100,
    groupIds: [],
    roundness: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    text,
    fontSize,
    fontFamily: 1,
    textAlign: containerId ? "center" : "left",
    verticalAlign: containerId ? "middle" : "top",
    containerId: containerId || null,
    originalText: text,
    autoResize: true,
  };
}

function makeArrow(
  fromId: string,
  toId: string,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): ExcalidrawElement {
  return {
    id: uid(),
    type: "arrow",
    x: fromX,
    y: fromY,
    width: toX - fromX,
    height: toY - fromY,
    angle: 0,
    strokeColor: "#495057",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    roughness: 1,
    opacity: 100,
    groupIds: [],
    roundness: { type: 2 },
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    points: [
      [0, 0],
      [toX - fromX, toY - fromY],
    ],
    startBinding: { elementId: fromId, focus: 0, gap: 4 },
    endBinding: { elementId: toId, focus: 0, gap: 4 },
    startArrowhead: null,
    endArrowhead: "arrow",
  };
}

export async function generateFlowchart(
  documentIds: string[],
): Promise<ExcalidrawElement[]> {
  const res = await fetch("/api/extract-structure", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentIds }),
  });
  const data = await res.json();
  const docs: DocStructure[] = data.documents || [];

  if (docs.length === 0) return [];

  const elements: ExcalidrawElement[] = [];
  const BOX_W = 220;
  const BOX_H = 50;
  const CHILD_W = 180;
  const CHILD_H = 36;
  const H_GAP = 80;
  const V_GAP = 30;
  const SECTION_GAP = 40;

  let globalX = 40;

  for (const doc of docs) {
    const color = TYPE_COLORS[doc.type] || "#e9ecef";
    let colX = globalX;
    let curY = 40;

    // Document title box
    const titleId = uid();
    const titleBox = makeRect(colX, curY, BOX_W, BOX_H + 10, color, titleId);
    titleBox.boundElements = [];
    elements.push(titleBox);
    const titleText = makeText(colX + 10, curY + 10, doc.name, 18, titleId);
    elements.push(titleText);
    titleBox.boundElements.push({ id: titleText.id, type: "text" });
    curY += BOX_H + 10 + V_GAP;

    let prevNodeId = titleId;
    let prevNodeBottom = 40 + BOX_H + 10;

    for (const node of doc.nodes) {
      // Section header box
      const nodeId = uid();
      const nodeBox = makeRect(colX, curY, BOX_W, BOX_H, "#e9ecef", nodeId);
      nodeBox.boundElements = [];
      elements.push(nodeBox);
      const nodeText = makeText(
        colX + 10,
        curY + 10,
        node.label.length > 25 ? node.label.slice(0, 23) + "..." : node.label,
        14,
        nodeId,
      );
      elements.push(nodeText);
      nodeBox.boundElements.push({ id: nodeText.id, type: "text" });

      // Arrow from previous
      const arrow = makeArrow(
        prevNodeId,
        nodeId,
        colX + BOX_W / 2,
        prevNodeBottom,
        colX + BOX_W / 2,
        curY,
      );
      elements.push(arrow);

      prevNodeId = nodeId;
      prevNodeBottom = curY + BOX_H;
      curY += BOX_H + V_GAP;

      // Children as smaller boxes to the right
      if (node.children && node.children.length > 0) {
        const childX = colX + BOX_W + H_GAP;
        let childY = curY - BOX_H - V_GAP;

        for (const child of node.children.slice(0, 6)) {
          const childId = uid();
          const childBox = makeRect(
            childX,
            childY,
            CHILD_W,
            CHILD_H,
            "#f8f9fa",
            childId,
          );
          childBox.boundElements = [];
          elements.push(childBox);
          const childText = makeText(
            childX + 6,
            childY + 6,
            child.length > 22 ? child.slice(0, 20) + "..." : child,
            12,
            childId,
          );
          elements.push(childText);
          childBox.boundElements.push({ id: childText.id, type: "text" });

          // Dashed connector from parent node to child
          const connector = makeArrow(
            nodeId,
            childId,
            colX + BOX_W,
            curY - BOX_H - V_GAP + BOX_H / 2,
            childX,
            childY + CHILD_H / 2,
          );
          connector.strokeColor = "#adb5bd";
          connector.strokeWidth = 1;
          elements.push(connector);

          childY += CHILD_H + 8;
        }

        if (node.children.length > 6) {
          const moreText = makeText(
            childX + 6,
            childY,
            `+ ${node.children.length - 6} more...`,
            11,
          );
          moreText.strokeColor = "#868e96";
          elements.push(moreText);
        }

        curY = Math.max(curY, childY + SECTION_GAP);
      }
    }

    globalX += BOX_W + CHILD_W + H_GAP + 120;
  }

  // If multiple documents, add arrows between document title boxes
  if (docs.length > 1) {
    const titleBoxes = elements.filter(
      (e) => e.type === "rectangle" && e.height === BOX_H + 10 && e.y === 40,
    );
    for (let i = 0; i < titleBoxes.length - 1; i++) {
      const from = titleBoxes[i];
      const to = titleBoxes[i + 1];
      const arrow = makeArrow(
        from.id,
        to.id,
        from.x + from.width,
        from.y + from.height / 2,
        to.x,
        to.y + to.height / 2,
      );
      arrow.strokeColor = "#4c6ef5";
      arrow.strokeWidth = 3;
      elements.push(arrow);
    }
  }

  return elements;
}
