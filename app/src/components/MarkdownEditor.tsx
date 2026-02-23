import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { EditorShell } from "./EditorShell";
import { Block, BlockNoteEditor } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { createMarkdownAdapter } from "./ai/EditorAdapter";
import type { EditorAdapter } from "./ai/EditorAdapter";

interface MarkdownEditorProps {
  documentId: string;
}

export function MarkdownEditor({ documentId }: MarkdownEditorProps) {
  const [initialBlocks, setInitialBlocks] = useState<Block[] | undefined>(
    undefined,
  );
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const isNew = useRef(false);
  const editorRef = useRef<BlockNoteEditor | null>(null);

  const adapter = useMemo<EditorAdapter>(
    () => createMarkdownAdapter(editorRef),
    [],
  );

  const saveToServer = useCallback(
    async (editor: BlockNoteEditor) => {
      setSaveStatus("saving");
      try {
        const markdown = await editor.blocksToMarkdownLossy(editor.document);
        const res = await fetch(`/api/save/${documentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            snapshot: { content: markdown },
            type: "markdown",
          }),
        });
        setSaveStatus(res.ok ? "saved" : "error");
      } catch {
        setSaveStatus("error");
      }
    },
    [documentId],
  );

  useEffect(() => {
    let cancelled = false;

    const tempEditor = BlockNoteEditor.create();

    fetch(`/api/load/${documentId}`)
      .then((r) => r.json())
      .then(async (data) => {
        if (cancelled) return;
        if (data.snapshot?.content !== undefined && data.snapshot.content) {
          const blocks = await tempEditor.tryParseMarkdownToBlocks(
            data.snapshot.content,
          );
          setInitialBlocks(blocks);
        } else {
          isNew.current = true;
          setInitialBlocks([]);
        }
      })
      .catch(() => {
        if (cancelled) return;
        isNew.current = true;
        setInitialBlocks([]);
      });

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const editor = useCreateBlockNote(
    {
      initialContent: initialBlocks?.length ? initialBlocks : undefined,
    },
    [initialBlocks],
  );

  useEffect(() => {
    if (!editor || initialBlocks === undefined) return;
    editorRef.current = editor;

    if (isNew.current) {
      isNew.current = false;
      saveToServer(editor);
    }
  }, [editor, initialBlocks, saveToServer]);

  const handleChange = useCallback(() => {
    if (!editorRef.current) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      if (editorRef.current) saveToServer(editorRef.current);
    }, 1500);
  }, [saveToServer]);

  if (initialBlocks === undefined) {
    return (
      <div className="editor-loading">
        <div className="editor-loading__spinner" />
        Loading Markdown editor...
      </div>
    );
  }

  return (
    <EditorShell
      documentId={documentId}
      adapter={adapter}
      saveStatus={saveStatus}
      contentClassName="markdown-container"
    >
      <BlockNoteView editor={editor} theme="dark" onChange={handleChange} />
    </EditorShell>
  );
}
