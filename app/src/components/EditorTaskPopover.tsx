import { useState, useRef, useEffect } from "react";
import { useConfirm } from "./ConfirmDialog";

interface DocTask {
  id: string;
  text: string;
  done: boolean;
  documentId: string;
  createdAt: string;
}

interface EditorTaskPopoverProps {
  documentId: string;
}

export function EditorTaskPopover({ documentId }: EditorTaskPopoverProps) {
  const confirm = useConfirm();
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskInput, setTaskInput] = useState("");
  const [docTasks, setDocTasks] = useState<DocTask[]>([]);
  const taskPopoverRef = useRef<HTMLDivElement>(null);

  const loadDocTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setDocTasks(
        (data.tasks || []).filter(
          (t: { documentId: string }) => t.documentId === documentId,
        ),
      );
    } catch (err) {
      console.error("Failed to load tasks:", err);
    }
  };

  const addDocTask = async () => {
    if (!taskInput.trim()) return;
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: taskInput.trim(), documentId }),
      });
      if (!res.ok) throw new Error("Create failed");
      const data = await res.json();
      setDocTasks((prev) => [data.task, ...prev]);
      setTaskInput("");
    } catch (err) {
      console.error("Failed to add task:", err);
    }
  };

  const toggleDocTask = async (taskId: string, done: boolean) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done }),
      });
      setDocTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, done } : t)),
      );
    } catch (err) {
      console.error("Failed to toggle task:", err);
    }
  };

  const deleteDocTask = async (taskId: string) => {
    if (!(await confirm({ message: "Delete this task?", danger: true })))
      return;
    try {
      await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      setDocTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  useEffect(() => {
    if (!taskOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        taskPopoverRef.current &&
        !taskPopoverRef.current.contains(e.target as Node)
      ) {
        setTaskOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [taskOpen]);

  return (
    <div className="editor-task-popover-wrapper" ref={taskPopoverRef}>
      <button
        className={`editor-export-btn${taskOpen ? " editor-export-btn--active" : ""}`}
        onClick={() => {
          setTaskOpen((v) => {
            if (!v) loadDocTasks();
            return !v;
          });
        }}
        title="Document Tasks"
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
          <rect x="2" y="2" width="12" height="12" rx="2" />
          <path d="M5 8l2 2 4-4" />
        </svg>
        <span>Tasks</span>
      </button>
      {taskOpen && (
        <div className="editor-task-popover">
          <form
            className="editor-task-popover__form"
            onSubmit={(e) => {
              e.preventDefault();
              addDocTask();
            }}
          >
            <input
              className="editor-task-popover__input"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              placeholder="Add a task..."
              autoFocus
            />
            <button className="editor-task-popover__add" type="submit">
              Add
            </button>
          </form>
          <div className="editor-task-popover__list">
            {docTasks.length === 0 && (
              <p className="editor-task-popover__empty">
                No tasks for this document yet.
              </p>
            )}
            {docTasks.map((task) => (
              <div
                key={task.id}
                className={`editor-task-popover__item${task.done ? " editor-task-popover__item--done" : ""}`}
              >
                <button
                  className={`editor-task-popover__check${task.done ? " editor-task-popover__check--checked" : ""}`}
                  onClick={() => toggleDocTask(task.id, !task.done)}
                >
                  {task.done && (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 6l3 3 5-5" />
                    </svg>
                  )}
                </button>
                <span className="editor-task-popover__text">{task.text}</span>
                <button
                  className="editor-task-popover__delete"
                  onClick={() => deleteDocTask(task.id)}
                  title="Delete task"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <path d="M3 3l6 6M9 3l-6 6" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
