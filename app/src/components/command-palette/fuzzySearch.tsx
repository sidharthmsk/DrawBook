import type { ReactNode } from "react";
import type { FuzzyResult } from "./types";

export function fuzzyMatch(query: string, target: string): FuzzyResult {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  const noMatch: FuzzyResult = { match: false, score: -1, indices: [] };

  if (!q) return { match: true, score: 0, indices: [] };

  const subIdx = t.indexOf(q);
  if (subIdx !== -1) {
    const indices = Array.from({ length: q.length }, (_, i) => subIdx + i);
    if (subIdx === 0) return { match: true, score: 100, indices };
    return { match: true, score: 80, indices };
  }

  let qi = 0;
  const indices: number[] = [];
  let gaps = 0;
  let lastMatchIdx = -1;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (lastMatchIdx >= 0 && ti - lastMatchIdx > 1) {
        gaps += ti - lastMatchIdx - 1;
      }
      indices.push(ti);
      lastMatchIdx = ti;
      qi++;
    }
  }

  if (qi < q.length) return noMatch;

  const score = Math.max(10, 60 - gaps * 3);
  return { match: true, score, indices };
}

export function HighlightedText({
  text,
  indices,
}: {
  text: string;
  indices: number[];
}) {
  if (!indices.length) return <>{text}</>;

  const set = new Set(indices);
  const parts: ReactNode[] = [];
  let buf = "";
  let inMatch = false;

  for (let i = 0; i < text.length; i++) {
    const isMatch = set.has(i);
    if (isMatch !== inMatch) {
      if (buf) {
        parts.push(
          inMatch ? (
            <span key={i} className="command-palette__match-hl">
              {buf}
            </span>
          ) : (
            buf
          ),
        );
      }
      buf = "";
      inMatch = isMatch;
    }
    buf += text[i];
  }
  if (buf) {
    parts.push(
      inMatch ? (
        <span key="end" className="command-palette__match-hl">
          {buf}
        </span>
      ) : (
        buf
      ),
    );
  }
  return <>{parts}</>;
}
