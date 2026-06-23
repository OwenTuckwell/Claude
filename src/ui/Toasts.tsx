import { useEffect, useRef, useState } from "react";
import type { LogEntry } from "../sim/types";

// Transient pop-up notifications. The sim already records events to state.log (build/train
// complete, sieges, conquests, raids); this surfaces *new* ones briefly so the player
// notices them without opening the Chronicle. Attacks (bad/war) are emphasised.
interface Toast { id: number; text: string; kind: LogEntry["kind"]; }

const ICON: Record<LogEntry["kind"], string> = { good: "✅", bad: "⚔️", war: "🚩", info: "ℹ️" };

export function Toasts({ log }: { log: LogEntry[] }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef<{ tick: number; text: string } | null>(null);
  const initialised = useRef(false);
  const nextId = useRef(0);

  useEffect(() => {
    if (log.length === 0) return;
    const front = log[0];
    // On first mount, remember the current head but don't toast the loaded backlog.
    if (!initialised.current) {
      initialised.current = true;
      seen.current = { tick: front.tick, text: front.text };
      return;
    }
    // New entries are those ahead of the previously-seen head (log is newest-first).
    let newCount = log.length;
    if (seen.current) {
      const idx = log.findIndex((e) => e.tick === seen.current!.tick && e.text === seen.current!.text);
      newCount = idx === -1 ? Math.min(log.length, 4) : idx;
    }
    seen.current = { tick: front.tick, text: front.text };
    if (newCount <= 0) return;

    // Toast the meaningful new events (skip low-priority "info" chatter), cap the burst.
    const fresh = log.slice(0, newCount)
      .filter((e) => e.kind !== "info")
      .slice(0, 3)
      .map((e) => ({ id: nextId.current++, text: e.text, kind: e.kind }));
    if (fresh.length === 0) return;

    setToasts((t) => [...fresh, ...t].slice(0, 4));
    for (const f of fresh) {
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== f.id)), 5000);
    }
  }, [log]);

  if (toasts.length === 0) return null;
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={"toast " + t.kind} role="status">
          <span className="toast-ic">{ICON[t.kind] ?? "•"}</span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
