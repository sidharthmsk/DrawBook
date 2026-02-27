import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { EditorShell } from "./EditorShell";
import { Block, BlockNoteEditor } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { createMarkdownAdapter } from "./ai/EditorAdapter";
import type { EditorAdapter } from "./ai/EditorAdapter";
import { DocumentPicker, InlineSuggestDropdown } from "./DocumentLink";

interface DocOption {
  id: string;
  name: string;
  type: string;
}

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
  const [docName, setDocName] = useState("document");

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

    fetch(`/api/meta/${documentId}`)
      .then((r) => r.json())
      .then((meta) => {
        if (meta.name) setDocName(meta.name);
      })
      .catch(() => {});

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

  const [wordCount, setWordCount] = useState(0);
  const wordCountTimeout = useRef<NodeJS.Timeout | null>(null);

  const updateWordCount = useCallback(async () => {
    if (!editorRef.current) return;
    const md = await editorRef.current.blocksToMarkdownLossy(
      editorRef.current.document,
    );
    const words = md.trim().split(/\s+/).filter(Boolean).length;
    setWordCount(words);
  }, []);

  useEffect(() => {
    if (!editor || initialBlocks === undefined) return;
    updateWordCount();
  }, [editor, initialBlocks, updateWordCount]);

  const handleChange = useCallback(() => {
    if (!editorRef.current) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      if (editorRef.current) saveToServer(editorRef.current);
    }, 1500);
    if (wordCountTimeout.current) clearTimeout(wordCountTimeout.current);
    wordCountTimeout.current = setTimeout(updateWordCount, 500);
  }, [saveToServer, updateWordCount]);

  const handleExport = useCallback(async () => {
    if (!editorRef.current) return;
    const md = await editorRef.current.blocksToMarkdownLossy(
      editorRef.current.document,
    );
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${docName}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [docName]);

  const [tocOpen, setTocOpen] = useState(false);
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [inlineSuggestOpen, setInlineSuggestOpen] = useState(false);
  const [inlineSuggestQuery, setInlineSuggestQuery] = useState("");
  const [inlineSuggestPos, setInlineSuggestPos] = useState({ top: 0, left: 0 });
  const [headings, setHeadings] = useState<
    Array<{ id: string; text: string; level: number }>
  >([]);

  const refreshHeadings = useCallback(() => {
    if (!editorRef.current) return;
    const doc = editorRef.current.document;
    const h: Array<{ id: string; text: string; level: number }> = [];
    for (const block of doc) {
      if (block.type === "heading" && (block as any).props?.level) {
        const text =
          (block.content as any[])?.map((c: any) => c.text || "").join("") ||
          "";
        if (text.trim()) {
          h.push({
            id: block.id,
            text: text.trim(),
            level: (block as any).props.level,
          });
        }
      }
    }
    setHeadings(h);
  }, []);

  useEffect(() => {
    if (!editor || initialBlocks === undefined) return;
    const timer = setTimeout(refreshHeadings, 300);
    return () => clearTimeout(timer);
  }, [editor, initialBlocks, refreshHeadings]);

  const originalHandleChange = handleChange;
  const handleChangeWithToc = useCallback(() => {
    originalHandleChange();
    setTimeout(refreshHeadings, 600);

    // Detect [[ for inline suggest
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) return;
    const text = textNode.textContent || "";
    const cursorOffset = range.startOffset;
    const before = text.slice(0, cursorOffset);
    const triggerIdx = before.lastIndexOf("[[");
    if (triggerIdx === -1 || before.indexOf("]]", triggerIdx) !== -1) {
      if (inlineSuggestOpen) setInlineSuggestOpen(false);
      return;
    }
    const partial = before.slice(triggerIdx + 2);
    if (partial.includes("\n")) {
      if (inlineSuggestOpen) setInlineSuggestOpen(false);
      return;
    }
    setInlineSuggestQuery(partial);
    setInlineSuggestOpen(true);

    const rect = range.getBoundingClientRect();
    setInlineSuggestPos({ top: rect.bottom + 4, left: rect.left });
  }, [originalHandleChange, refreshHeadings, inlineSuggestOpen]);

  const handleInlineSuggestSelect = useCallback(
    (doc: DocOption) => {
      setInlineSuggestOpen(false);
      const ed = editorRef.current;
      if (!ed) return;

      // We need to remove the "[[partial" text and replace with [[DocName]]
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const textNode = range.startContainer;
      if (textNode.nodeType !== Node.TEXT_NODE) return;
      const text = textNode.textContent || "";
      const cursorOffset = range.startOffset;
      const before = text.slice(0, cursorOffset);
      const triggerIdx = before.lastIndexOf("[[");
      if (triggerIdx === -1) return;

      // Delete from [[ to cursor, then insert the full link
      const deleteRange = document.createRange();
      deleteRange.setStart(textNode, triggerIdx);
      deleteRange.setEnd(textNode, cursorOffset);
      deleteRange.deleteContents();

      // Insert the link text via DOM (BlockNote will pick up the change)
      const linkText = document.createTextNode(`[[${doc.name}]]`);
      deleteRange.insertNode(linkText);

      // Move cursor after the inserted text
      const newRange = document.createRange();
      newRange.setStartAfter(linkText);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);

      // Trigger a save
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        if (editorRef.current) saveToServer(editorRef.current);
      }, 1500);
    },
    [saveToServer],
  );

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
      onExport={handleExport}
      exportLabel="Export .md"
      exportExtra={
        <>
          <button
            className={`md-toc-toggle${tocOpen ? " md-toc-toggle--active" : ""}`}
            onClick={() => setTocOpen((v) => !v)}
            title="Table of contents"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M2 3h12M2 7h8M2 11h10M2 15h6" />
            </svg>
          </button>
          <button
            className="md-toc-toggle"
            onClick={() => setDocPickerOpen(true)}
            title="Insert document link [[...]]"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 4H5a3 3 0 000 6h2M9 4h2a3 3 0 010 6H9M5.5 7h5" />
            </svg>
          </button>
        </>
      }
    >
      <div style={{ display: "flex", height: "100%", position: "relative" }}>
        {tocOpen && (
          <aside className="md-toc-sidebar">
            <h4 className="md-toc-sidebar__title">Contents</h4>
            {headings.length === 0 ? (
              <p className="md-toc-sidebar__empty">No headings found</p>
            ) : (
              <ul className="md-toc-sidebar__list">
                {headings.map((h) => (
                  <li
                    key={h.id}
                    className={`md-toc-sidebar__item md-toc-sidebar__item--h${h.level}`}
                    onClick={() => {
                      editorRef.current?.setTextCursorPosition(h.id, "start");
                      const el = document.querySelector(`[data-id="${h.id}"]`);
                      el?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                    }}
                  >
                    {h.text}
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <BlockNoteView
            editor={editor}
            theme="dark"
            onChange={handleChangeWithToc}
          />
        </div>
      </div>
      <div className="md-status-bar">
        {wordCount} {wordCount === 1 ? "word" : "words"} &middot;{" "}
        {Math.max(1, Math.ceil(wordCount / 200))} min read
      </div>
      {docPickerOpen && (
        <div
          className="doc-picker-overlay"
          onClick={() => setDocPickerOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <DocumentPicker
              onSelect={(doc) => {
                setDocPickerOpen(false);
                if (!editorRef.current) return;
                const ed = editorRef.current;
                const cursor = ed.getTextCursorPosition();
                if (cursor) {
                  ed.insertInlineContent([
                    { type: "text", text: `[[${doc.name}]]`, styles: {} },
                  ]);
                }
              }}
              onClose={() => setDocPickerOpen(false)}
            />
          </div>
        </div>
      )}
      {inlineSuggestOpen && (
        <InlineSuggestDropdown
          query={inlineSuggestQuery}
          position={inlineSuggestPos}
          onSelect={handleInlineSuggestSelect}
          onClose={() => setInlineSuggestOpen(false)}
        />
      )}
    </EditorShell>
  );
}
