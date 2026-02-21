import { useEffect, useRef, useState } from "react";

interface PdfViewerProps {
  documentId: string;
}

export function PdfViewer({ documentId }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<any>(null);
  const pdfjsRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPdfJs() {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.mjs",
        import.meta.url,
      ).toString();
      pdfjsRef.current = pdfjs;

      try {
        const loadingTask = pdfjs.getDocument(`/api/file/${documentId}`);
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load PDF:", err);
        setError("Failed to load PDF file.");
        setLoading(false);
      }
    }

    loadPdfJs();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    if (!pdfDocRef.current || !canvasRef.current) return;

    let cancelled = false;

    async function renderPage() {
      const pdf = pdfDocRef.current;
      const page = await pdf.getPage(currentPage);
      if (cancelled) return;

      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current!;
      const context = canvas.getContext("2d")!;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      await page.render({ canvasContext: context, viewport }).promise;
    }

    renderPage();
    return () => {
      cancelled = true;
    };
  }, [currentPage, scale]);

  if (loading) {
    return (
      <div className="editor-loading">
        <div className="editor-loading__spinner" />
        Loading PDF...
      </div>
    );
  }

  if (error) {
    return (
      <div className="editor-wrapper">
        <div className="editor-topbar">
          <button
            className="editor-back-btn"
            onClick={() => (window.location.href = "/")}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 12L6 8l4-4" />
            </svg>
            Back
          </button>
        </div>
        <div className="empty-state" style={{ marginTop: 80 }}>
          <h3>Could not load PDF</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-wrapper">
      <div className="editor-topbar">
        <button
          className="editor-back-btn"
          onClick={() => (window.location.href = "/")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 12L6 8l4-4" />
          </svg>
          Back
        </button>
        <span className="editor-topbar__title">{documentId}</span>
        <div className="pdf-controls">
          <button
            className="pdf-nav-btn"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span className="pdf-page-info">
            {currentPage} / {numPages}
          </span>
          <button
            className="pdf-nav-btn"
            disabled={currentPage >= numPages}
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
          >
            Next
          </button>
          <span className="pdf-separator">|</span>
          <button
            className="pdf-nav-btn"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
          >
            -
          </button>
          <span className="pdf-page-info">{Math.round(scale * 100)}%</span>
          <button
            className="pdf-nav-btn"
            onClick={() => setScale((s) => Math.min(3, s + 0.2))}
          >
            +
          </button>
        </div>
      </div>
      <div className="pdf-container">
        <canvas ref={canvasRef} className="pdf-canvas" />
      </div>
    </div>
  );
}
