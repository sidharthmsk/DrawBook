import type { RecentDoc } from "./types";

export const RECENT_KEY = "drawbook_recent_docs";
export const MAX_RECENT = 20;

export function pushRecentDoc(doc: { id: string; name: string; type: string }) {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list: RecentDoc[] = raw ? JSON.parse(raw) : [];
    const entry: RecentDoc = { ...doc, timestamp: Date.now() };
    const updated = [entry, ...list.filter((d) => d.id !== doc.id)].slice(
      0,
      MAX_RECENT,
    );
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    /* ignore */
  }
}

export function getRecentDocs(): RecentDoc[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
