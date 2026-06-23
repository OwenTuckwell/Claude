import { useEffect, useState } from "react";
import type { GameState } from "../sim/types";
import { townHallLevel } from "../sim/sim";

// Ambient onboarding (Appendix P): a small, skippable "Getting started" checklist that
// guides a new player through the real core loop. Steps auto-complete by reading sim
// state — no scripted tutorial, no sim/save changes. Progress persists in localStorage.
interface Step { id: string; title: string; hint: string; done: (s: GameState) => boolean; }

const STEPS: Step[] = [
  { id: "market",  title: "Visit the Market",       hint: "Open 🎟️ Market and tap to gather resources — your early income.", done: (s) => (s.resources.token ?? 0) >= 8 },
  { id: "build",   title: "Grow your village",      hint: "Drag-place a new building, or tap one to upgrade it.",            done: (s) => s.buildQueue.length > 0 || s.buildings.length > 10 || s.buildings.some((b) => b.level >= 2) },
  { id: "townhall",title: "Upgrade the Town Hall",  hint: "Tap the 🏛️ Town Hall in the centre — each level unlocks more buildings.", done: (s) => townHallLevel(s) >= 2 },
  { id: "research",title: "Research a technology",  hint: "Open 📜 Tech and spend research points to improve your realm.",  done: (s) => Object.values(s.research).some((r) => r > 0) },
  { id: "train",   title: "Raise an army",          hint: "Open ⚔️ Army and train some troops to defend and expand.",       done: (s) => Object.values(s.troops).some((c) => c > 0) || s.trainQueue.length > 0 },
  { id: "scout",   title: "Scout the wilds",        hint: "On the 🗺️ Map, send scouts to reveal a rival's strength.",       done: (s) => Object.values(s.intel).some((v) => v >= 1) || s.marches.some((m) => m.kind === "scout") },
  { id: "battle",  title: "Win your first battle",  hint: "March on a neutral tile or a rival and claim a victory.",         done: (s) => s.reports.some((r) => r.victory) },
];

const KEY = "bannerfall.onboarding";
interface Saved { done: string[]; dismissed: boolean; collapsed: boolean; }
function load(): Saved {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r) as Saved; } catch { /* ignore */ }
  return { done: [], dismissed: false, collapsed: false };
}

export function Onboarding({ state }: { state: GameState }) {
  const [saved, setSaved] = useState<Saved>(load);

  const update = (patch: Partial<Saved>) => {
    setSaved((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Mark newly-satisfied steps complete as the player plays.
  useEffect(() => {
    const newly = STEPS.filter((st) => !saved.done.includes(st.id) && st.done(state)).map((st) => st.id);
    if (newly.length) update({ done: [...saved.done, ...newly] });
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  if (saved.dismissed) return null;
  const doneCount = STEPS.filter((st) => saved.done.includes(st.id)).length;
  const allDone = doneCount >= STEPS.length;
  const nextId = STEPS.find((st) => !saved.done.includes(st.id))?.id;

  if (saved.collapsed) {
    return (
      <button className="onboard-pill" onClick={() => update({ collapsed: false })}>
        📜 Quests {doneCount}/{STEPS.length}
      </button>
    );
  }

  return (
    <div className="onboard">
      <div className="onboard-head">
        <strong>📜 Getting started · {doneCount}/{STEPS.length}</strong>
        <span>
          <button onClick={() => update({ collapsed: true })} title="Collapse">–</button>
          <button onClick={() => update({ dismissed: true })} title="Hide for good">✕</button>
        </span>
      </div>
      {allDone ? (
        <div className="onboard-done">
          Well done — you've learned the ropes. Your realm awaits. 🏰
          <button className="act" onClick={() => update({ dismissed: true })}>Dismiss</button>
        </div>
      ) : (
        <ul className="onboard-steps">
          {STEPS.map((st) => {
            const done = saved.done.includes(st.id);
            const isNext = st.id === nextId;
            return (
              <li key={st.id} className={done ? "done" : isNext ? "next" : ""}>
                <span className="ob-check">{done ? "✅" : isNext ? "▶️" : "⬜"}</span>
                <span>
                  <strong>{st.title}</strong>
                  {isNext && <div className="ob-hint">{st.hint}</div>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
