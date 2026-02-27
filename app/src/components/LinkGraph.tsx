import { useEffect, useRef, useState, useCallback } from "react";

interface GraphNode {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

const TYPE_COLORS: Record<string, string> = {
  markdown: "#4fc3f7",
  kanban: "#81c784",
  excalidraw: "#ffb74d",
  tldraw: "#ce93d8",
  spreadsheet: "#a5d6a7",
  drawio: "#ef9a9a",
};

export function LinkGraph({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasW, setCanvasW] = useState(800);
  const [canvasH, setCanvasH] = useState(600);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [dragNode, setDragNode] = useState<GraphNode | null>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<GraphNode[]>([]);
  const sizeRef = useRef({ w: 800, h: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) {
        const w = Math.floor(rect.width);
        const h = Math.floor(rect.height);
        sizeRef.current = { w, h };
        setCanvasW(w);
        setCanvasH(h);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    fetch("/api/link-graph")
      .then((r) => r.json())
      .then((data) => {
        const rawNodes = data.nodes || [];
        const cx = sizeRef.current.w / 2;
        const cy = sizeRef.current.h / 2;
        const initialized: GraphNode[] = rawNodes.map(
          (n: { id: string; name: string; type: string }, i: number) => {
            const angle = (2 * Math.PI * i) / rawNodes.length;
            const r = Math.min(cx, cy) * 0.5 + Math.random() * 80;
            return {
              ...n,
              x: cx + r * Math.cos(angle),
              y: cy + r * Math.sin(angle),
              vx: 0,
              vy: 0,
            };
          },
        );
        setNodes(initialized);
        nodesRef.current = initialized;
        setEdges(data.edges || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const simulate = useCallback(() => {
    const ns = nodesRef.current;
    if (ns.length === 0) return;

    const cx = sizeRef.current.w / 2;
    const cy = sizeRef.current.h / 2;

    for (const node of ns) {
      node.vx *= 0.9;
      node.vy *= 0.9;

      const dx = cx - node.x;
      const dy = cy - node.y;
      node.vx += dx * 0.0005;
      node.vy += dy * 0.0005;
    }

    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const dx = ns[j].x - ns[i].x;
        const dy = ns[j].y - ns[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 800 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        ns[i].vx -= fx;
        ns[i].vy -= fy;
        ns[j].vx += fx;
        ns[j].vy += fy;
      }
    }

    const nodeMap = new Map(ns.map((n) => [n.id, n]));
    for (const edge of edges) {
      const s = nodeMap.get(edge.source);
      const t = nodeMap.get(edge.target);
      if (!s || !t) continue;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 120) * 0.01;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      s.vx += fx;
      s.vy += fy;
      t.vx -= fx;
      t.vy -= fy;
    }

    for (const node of ns) {
      if (node === dragNode) continue;
      node.x += node.vx;
      node.y += node.vy;
      node.x = Math.max(30, Math.min(sizeRef.current.w - 30, node.x));
      node.y = Math.max(30, Math.min(sizeRef.current.h - 30, node.y));
    }

    setNodes([...ns]);
  }, [edges, dragNode]);

  useEffect(() => {
    if (loading) return;
    let running = true;
    const loop = () => {
      if (!running) return;
      simulate();
      animRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [loading, simulate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvasW;
    const h = canvasH;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#0A0A0A";
    ctx.fillRect(0, 0, w, h);

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    for (const edge of edges) {
      const s = nodeMap.get(edge.source);
      const t = nodeMap.get(edge.target);
      if (!s || !t) continue;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const angle = Math.atan2(t.y - s.y, t.x - s.x);
      const arrowLen = 8;
      const ax = t.x - 14 * Math.cos(angle);
      const ay = t.y - 14 * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(
        ax - arrowLen * Math.cos(angle - 0.4),
        ay - arrowLen * Math.sin(angle - 0.4),
      );
      ctx.lineTo(
        ax - arrowLen * Math.cos(angle + 0.4),
        ay - arrowLen * Math.sin(angle + 0.4),
      );
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fill();
    }

    for (const node of nodes) {
      const color = TYPE_COLORS[node.type] || "#90a4ae";
      const isHovered = hoveredNode?.id === node.id;
      const radius = isHovered ? 10 : 7;

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 3, 0, Math.PI * 2);
      ctx.fillStyle = `${color}33`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.font = isHovered ? "bold 12px system-ui" : "10px system-ui";
      ctx.textAlign = "center";
      const label = isHovered
        ? node.name
        : node.name.length > 20
          ? node.name.slice(0, 18) + "..."
          : node.name;
      ctx.fillText(label, node.x, node.y - radius - 6);
    }
  }, [nodes, edges, hoveredNode, canvasW, canvasH]);

  const findNodeAt = useCallback(
    (x: number, y: number) => {
      for (const node of nodes) {
        const dx = node.x - x;
        const dy = node.y - y;
        if (dx * dx + dy * dy < 144) return node;
      }
      return null;
    },
    [nodes],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (dragNode) {
        dragNode.x = x;
        dragNode.y = y;
        return;
      }

      const node = findNodeAt(x, y);
      setHoveredNode(node);
      if (canvasRef.current) {
        canvasRef.current.style.cursor = node ? "pointer" : "default";
      }
    },
    [dragNode, findNodeAt],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const node = findNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (node) setDragNode(node);
    },
    [findNodeAt],
  );

  const handleMouseUp = useCallback(() => {
    setDragNode(null);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (dragNode) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const node = findNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (node) {
        window.location.href = `/?doc=${node.id}&type=${node.type}`;
      }
    },
    [findNodeAt, dragNode],
  );

  return (
    <div className="link-graph">
      <div className="link-graph__header">
        <h3>Document Link Graph</h3>
        <span className="link-graph__hint">
          Click a node to open. Drag to rearrange.
        </span>
        <button className="link-graph__close" onClick={onClose}>
          Close
        </button>
      </div>
      {loading ? (
        <div className="link-graph__loading">Loading graph...</div>
      ) : nodes.length === 0 ? (
        <div className="link-graph__empty">
          No documents yet. Create some and use [[Document Name]] to link them!
        </div>
      ) : (
        <div className="link-graph__body" ref={containerRef}>
          <canvas
            ref={canvasRef}
            className="link-graph__canvas"
            width={canvasW}
            height={canvasH}
            style={{ width: canvasW, height: canvasH }}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleClick}
          />
        </div>
      )}
    </div>
  );
}
