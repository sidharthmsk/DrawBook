import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorShell } from "./EditorShell";
import CodeMirror from "@uiw/react-codemirror";
import { createTheme } from "@uiw/codemirror-themes";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { tags as t } from "@lezer/highlight";

type CodeLanguage = "javascript" | "typescript" | "python" | "java";

const LANGUAGES: { id: CodeLanguage; label: string }[] = [
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
];

function getLanguageExtension(lang: CodeLanguage) {
  switch (lang) {
    case "javascript":
      return javascript();
    case "typescript":
      return javascript({ typescript: true });
    case "python":
      return python();
    case "java":
      return java();
  }
}

const drawbookTheme = createTheme({
  theme: "dark",
  settings: {
    background: "#111111",
    foreground: "#E8E5E0",
    caret: "#E07A5F",
    selection: "rgba(224, 122, 95, 0.15)",
    selectionMatch: "rgba(224, 122, 95, 0.08)",
    gutterBackground: "#0A0A0A",
    gutterForeground: "#5A5754",
    gutterActiveForeground: "#8A8680",
    gutterBorder: "transparent",
    lineHighlight: "rgba(255, 255, 255, 0.03)",
    fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
  },
  styles: [
    { tag: [t.keyword, t.controlKeyword, t.moduleKeyword], color: "#E07A5F" },
    { tag: [t.string, t.special(t.string), t.regexp], color: "#6EE7B7" },
    { tag: [t.number, t.bool], color: "#60A5FA" },
    {
      tag: [t.comment, t.lineComment, t.blockComment],
      color: "#5A5754",
      fontStyle: "italic",
    },
    {
      tag: [t.function(t.variableName), t.function(t.propertyName)],
      color: "#A78BFA",
    },
    { tag: [t.typeName, t.className, t.namespace], color: "#F472B6" },
    { tag: [t.variableName, t.local(t.variableName)], color: "#E8E5E0" },
    { tag: [t.operator, t.punctuation], color: "#8A8680" },
    { tag: [t.propertyName], color: "#FCD34D" },
    { tag: [t.definition(t.variableName)], color: "#E8E5E0" },
    { tag: [t.definition(t.function(t.variableName))], color: "#A78BFA" },
    { tag: [t.tagName], color: "#E07A5F" },
    { tag: [t.attributeName], color: "#FCD34D" },
    { tag: [t.meta], color: "#8A8680" },
    { tag: [t.self], color: "#E07A5F", fontStyle: "italic" },
  ],
});

interface CodeEditorProps {
  documentId: string;
}

export function CodeEditor({ documentId }: CodeEditorProps) {
  const [content, setContent] = useState("");
  const [language, setLanguage] = useState<CodeLanguage>("javascript");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [loaded, setLoaded] = useState(false);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef(content);
  const languageRef = useRef(language);

  contentRef.current = content;
  languageRef.current = language;

  const saveToServer = useCallback(
    async (code: string, lang: CodeLanguage) => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/save/${documentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            snapshot: { content: code, language: lang },
            type: "code",
          }),
        });
        setSaveStatus(res.ok ? "saved" : "error");
      } catch {
        setSaveStatus("error");
      }
    },
    [documentId],
  );

  const debouncedSave = useCallback(
    (code: string, lang: CodeLanguage) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => saveToServer(code, lang), 1500);
    },
    [saveToServer],
  );

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/load/${documentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.snapshot) {
          setContent(data.snapshot.content || "");
          if (data.snapshot.language) {
            setLanguage(data.snapshot.language as CodeLanguage);
          }
        }
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded(true);
        saveToServer("", "javascript");
      });

    return () => {
      cancelled = true;
    };
  }, [documentId, saveToServer]);

  const handleChange = useCallback(
    (value: string) => {
      setContent(value);
      debouncedSave(value, languageRef.current);
    },
    [debouncedSave],
  );

  const handleLanguageChange = useCallback(
    (newLang: CodeLanguage) => {
      setLanguage(newLang);
      debouncedSave(contentRef.current, newLang);
    },
    [debouncedSave],
  );

  const langExtension = useMemo(
    () => getLanguageExtension(language),
    [language],
  );

  if (!loaded) {
    return (
      <div className="editor-loading">
        <div className="editor-loading__spinner" />
      </div>
    );
  }

  return (
    <EditorShell documentId={documentId} adapter={null} saveStatus={saveStatus}>
      <div className="code-editor">
        <div className="code-editor__toolbar">
          <select
            className="code-editor__lang-select"
            value={language}
            onChange={(e) =>
              handleLanguageChange(e.target.value as CodeLanguage)
            }
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>
        <div className="code-editor__body">
          <CodeMirror
            value={content}
            onChange={handleChange}
            theme={drawbookTheme}
            extensions={[langExtension]}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: false,
              highlightActiveLine: true,
              indentOnInput: true,
              tabSize: 2,
            }}
            height="100%"
            style={{ height: "100%" }}
          />
        </div>
      </div>
    </EditorShell>
  );
}
