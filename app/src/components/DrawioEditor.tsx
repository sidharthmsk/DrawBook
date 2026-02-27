import { useCallback, useEffect, useRef, useState } from "react";

interface DrawioEditorProps {
  documentId: string;
}

const DRAWIO_URL =
  "https://embed.diagrams.net/?embed=1&proto=json&spin=1&dark=1&ui=dark";

export function DrawioEditor({ documentId }: DrawioEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [loading, setLoading] = useState(true);
  const xmlRef = useRef<string>("");
  const initializedRef = useRef(false);

  useEffect(() => {
    fetch(`/api/load/${documentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.snapshot?.xml) {
          xmlRef.current = data.snapshot.xml;
        }
      })
      .catch(() => {});
  }, [documentId]);

  const saveToServer = useCallback(
    async (xml: string) => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/save/${documentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot: { xml }, type: "drawio" }),
        });
        setSaveStatus(res.ok ? "saved" : "error");
      } catch {
        setSaveStatus("error");
      }
    },
    [documentId],
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "string") return;

      let msg: any;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.event === "init") {
        initializedRef.current = true;
        setLoading(false);
        const iframe = iframeRef.current;
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage(
            JSON.stringify({
              action: "load",
              xml: xmlRef.current || "",
              autosave: 1,
            }),
            "*",
          );
        }
      }

      if (msg.event === "autosave" || msg.event === "save") {
        xmlRef.current = msg.xml;
        saveToServer(msg.xml);
      }

      if (msg.event === "exit") {
        window.location.href = "/";
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [saveToServer]);

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
        <div className="editor-topbar__status">
          <span
            className={`editor-status-dot editor-status-dot--${saveStatus === "error" ? "error" : saveStatus === "saved" ? "saved" : "saving"}`}
          />
          <span>
            {saveStatus === "saved"
              ? "Saved"
              : saveStatus === "saving"
                ? "Saving..."
                : "Error"}
          </span>
        </div>
      </div>
      <div className="editor-canvas">
        {loading && (
          <div
            className="editor-loading"
            style={{ position: "absolute", inset: 0, zIndex: 10 }}
          >
            <div className="editor-loading__spinner" />
            Loading Draw.io...
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={DRAWIO_URL}
          style={{ width: "100%", height: "100%", border: "none" }}
          title="Draw.io Editor"
        />
      </div>
    </div>
  );
}
