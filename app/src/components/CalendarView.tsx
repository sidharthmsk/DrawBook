import { useCallback, useEffect, useMemo, useState } from "react";

type DocumentType =
  | "tldraw"
  | "excalidraw"
  | "drawio"
  | "markdown"
  | "pdf"
  | "spreadsheet"
  | "kanban"
  | "code";

interface DocumentItem {
  id: string;
  name: string;
  folderId: string | null;
  type: DocumentType;
  modifiedAt: string;
  starred?: boolean;
  tags?: string[];
}

interface DailyNote {
  id: string;
  date: string;
  name: string;
  modifiedAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  tldraw: "var(--accent)",
  excalidraw: "var(--type-excalidraw)",
  drawio: "var(--type-drawio)",
  markdown: "var(--type-markdown)",
  pdf: "var(--type-pdf)",
  spreadsheet: "var(--type-spreadsheet)",
  kanban: "var(--type-kanban)",
};

const DAILY_NOTE_COLOR = "var(--type-daily-note, #f0a030)";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CalendarView({
  docs,
  onOpenDocument,
}: {
  docs: DocumentItem[];
  onOpenDocument: (doc: DocumentItem) => void;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [dailyNotes, setDailyNotes] = useState<DailyNote[]>([]);

  useEffect(() => {
    fetch("/api/daily-notes")
      .then((r) => r.json())
      .then((data) => setDailyNotes(data.notes || []))
      .catch(() => {});
  }, []);

  const dailyNotesByDate = useMemo(() => {
    const map = new Map<string, DailyNote>();
    for (const note of dailyNotes) {
      map.set(note.date, note);
    }
    return map;
  }, [dailyNotes]);

  const docsByDate = useMemo(() => {
    const map = new Map<string, DocumentItem[]>();
    for (const doc of docs) {
      const d = new Date(doc.modifiedAt);
      const key = dateKey(d);
      const list = map.get(key) || [];
      list.push(doc);
      map.set(key, list);
    }
    return map;
  }, [docs]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();

    const cells: Array<{ date: Date; inMonth: boolean }> = [];

    for (let i = startOffset - 1; i >= 0; i--) {
      cells.push({
        date: new Date(year, month - 1, daysInPrev - i),
        inMonth: false,
      });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(year, month, d), inMonth: true });
    }
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        cells.push({ date: new Date(year, month + 1, d), inMonth: false });
      }
    }

    return cells;
  }, [year, month]);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  const openDailyNote = useCallback(async (date: string) => {
    try {
      const res = await fetch(`/api/daily-note/${date}`);
      if (!res.ok) throw new Error("Failed to get daily note");
      const data = await res.json();
      window.location.href = `/?doc=${data.documentId}&type=markdown`;
    } catch (err) {
      console.error("Failed to open daily note:", err);
    }
  }, []);

  const createTodayNote = useCallback(async () => {
    const date = todayDateStr();
    try {
      const res = await fetch(`/api/daily-note/${date}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setDailyNotes((prev) => {
        if (prev.some((n) => n.date === date)) return prev;
        return [
          {
            id: data.documentId,
            date,
            name: `Daily Note — ${date}`,
            modifiedAt: new Date().toISOString(),
          },
          ...prev,
        ];
      });
      window.location.href = `/?doc=${data.documentId}&type=markdown`;
    } catch (err) {
      console.error("Failed to create daily note:", err);
    }
  }, []);

  const todayKey = dateKey(today);

  return (
    <div className="calendar-view">
      <div className="calendar-view__header">
        <button className="calendar-view__nav" onClick={prevMonth}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 4l-4 4 4 4" />
          </svg>
        </button>
        <h3 className="calendar-view__title">
          {MONTH_NAMES[month]} {year}
        </h3>
        <button className="calendar-view__nav" onClick={nextMonth}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 4l4 4-4 4" />
          </svg>
        </button>
        <button className="calendar-view__today" onClick={goToday}>
          Today
        </button>
        <button className="calendar-view__daily-btn" onClick={createTodayNote}>
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
            <path d="M8 3v10M3 8h10" />
          </svg>
          Today's Note
        </button>
      </div>

      <div className="calendar-view__grid">
        {DAY_LABELS.map((label) => (
          <div key={label} className="calendar-view__day-label">
            {label}
          </div>
        ))}

        {calendarDays.map((cell, i) => {
          const key = dateKey(cell.date);
          const isToday = key === todayKey;
          const cellDocs = docsByDate.get(key) || [];
          const dailyNote = dailyNotesByDate.get(key);

          const totalItems = (dailyNote ? 1 : 0) + cellDocs.length;
          const maxShow = 3;
          const docsToShow = dailyNote
            ? cellDocs.slice(0, maxShow - 1)
            : cellDocs.slice(0, maxShow);
          const overflow = totalItems - maxShow;

          return (
            <div
              key={i}
              className={`calendar-view__cell${!cell.inMonth ? " calendar-view__cell--outside" : ""}${isToday ? " calendar-view__cell--today" : ""}`}
            >
              <span
                className={`calendar-view__date-num${isToday ? " calendar-view__date-num--today" : ""}`}
              >
                {cell.date.getDate()}
              </span>
              <div className="calendar-view__docs">
                {dailyNote && (
                  <button
                    className="calendar-view__doc calendar-view__doc--daily"
                    style={{ borderLeftColor: DAILY_NOTE_COLOR }}
                    onClick={() => openDailyNote(dailyNote.date)}
                    title={`Daily Note — ${dailyNote.date}`}
                  >
                    <svg
                      className="calendar-view__daily-icon"
                      width="10"
                      height="10"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="2" y="3" width="12" height="11" rx="1" />
                      <path d="M2 6.5h12" />
                    </svg>
                    <span className="calendar-view__doc-name">Daily Note</span>
                  </button>
                )}
                {docsToShow.map((doc) => (
                  <button
                    key={doc.id}
                    className="calendar-view__doc"
                    style={{
                      borderLeftColor: TYPE_COLORS[doc.type] || "var(--accent)",
                    }}
                    onClick={() => onOpenDocument(doc)}
                    title={`${doc.name} (${doc.type})`}
                  >
                    <span className="calendar-view__doc-name">{doc.name}</span>
                  </button>
                ))}
                {overflow > 0 && (
                  <span className="calendar-view__more">+{overflow} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
