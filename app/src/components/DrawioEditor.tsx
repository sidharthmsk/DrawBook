import { useCallback, useEffect, useRef, useState } from "react";
import { EditorShell } from "./EditorShell";
import { createDrawioAdapter } from "./ai/EditorAdapter";
import type { EditorAdapter } from "./ai/EditorAdapter";

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
  const [docName, setDocName] = useState("diagram");
  const xmlRef = useRef<string>("");
  const initializedRef = useRef(false);
  const [adapter, setAdapter] = useState<EditorAdapter | null>(null);

  useEffect(() => {
    setAdapter(createDrawioAdapter(xmlRef, iframeRef));
  }, []);

  useEffect(() => {
    fetch(`/api/meta/${documentId}`)
      .then((r) => r.json())
      .then((meta) => {
        if (meta.name) setDocName(meta.name);
      })
      .catch(() => {});
  }, [documentId]);

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
    <EditorShell
      documentId={documentId}
      adapter={adapter}
      saveStatus={saveStatus}
      onExport={() => {
        const xml = xmlRef.current;
        if (!xml) return;
        const blob = new Blob([xml], { type: "application/xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${docName}.drawio`;
        a.click();
        URL.revokeObjectURL(url);
      }}
      exportLabel="Export .drawio"
    >
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
    </EditorShell>
  );
}
