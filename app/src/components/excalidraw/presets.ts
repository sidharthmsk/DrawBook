function makeElement(overrides: Record<string, any>) {
  return {
    id: `lib-${Math.random().toString(36).slice(2, 10)}`,
    type: "rectangle",
    x: 0,
    y: 0,
    width: 120,
    height: 60,
    angle: 0,
    strokeColor: "#1e1e1e",
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
    ...overrides,
  };
}

export const LIBRARY_PRESETS = [
  {
    id: "lib-flowchart-start",
    status: "published" as const,
    name: "Start / End",
    elements: [
      makeElement({
        type: "ellipse",
        width: 140,
        height: 60,
        backgroundColor: "#a5d8ff",
      }),
    ],
  },
  {
    id: "lib-flowchart-process",
    status: "published" as const,
    name: "Process",
    elements: [
      makeElement({
        width: 140,
        height: 60,
        backgroundColor: "#b2f2bb",
      }),
    ],
  },
  {
    id: "lib-flowchart-decision",
    status: "published" as const,
    name: "Decision",
    elements: [
      makeElement({
        type: "diamond",
        width: 100,
        height: 100,
        backgroundColor: "#ffec99",
      }),
    ],
  },
  {
    id: "lib-ux-button",
    status: "published" as const,
    name: "Button",
    elements: [
      makeElement({
        width: 120,
        height: 40,
        backgroundColor: "#4c6ef5",
        strokeColor: "#4c6ef5",
        roundness: { type: 3 },
      }),
    ],
  },
  {
    id: "lib-ux-input",
    status: "published" as const,
    name: "Input Field",
    elements: [
      makeElement({
        width: 200,
        height: 36,
        backgroundColor: "#f8f9fa",
        strokeColor: "#ced4da",
      }),
    ],
  },
  {
    id: "lib-ux-card",
    status: "published" as const,
    name: "Card",
    elements: [
      makeElement({
        width: 240,
        height: 160,
        backgroundColor: "#f8f9fa",
        strokeColor: "#dee2e6",
        roundness: { type: 3 },
      }),
    ],
  },
  {
    id: "lib-ux-header",
    status: "published" as const,
    name: "Header Bar",
    elements: [
      makeElement({
        width: 400,
        height: 48,
        backgroundColor: "#343a40",
        strokeColor: "#343a40",
      }),
    ],
  },
];
