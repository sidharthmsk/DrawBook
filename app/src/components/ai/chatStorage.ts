import type { ChatMessage } from "./types";
import { CHAT_STORAGE_PREFIX, MAX_STORED_MESSAGES } from "./types";

export function loadStoredMessages(docId?: string): ChatMessage[] {
  if (!docId) return [];
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_PREFIX + docId);
    if (raw) return JSON.parse(raw) as ChatMessage[];
  } catch {}
  return [];
}

export function saveStoredMessages(
  docId: string | undefined,
  msgs: ChatMessage[],
) {
  if (!docId) return;
  try {
    const trimmed = msgs.slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(CHAT_STORAGE_PREFIX + docId, JSON.stringify(trimmed));
  } catch {}
}
