// Host layer: persistence + the wall-clock → ticks bridge. This is the ONLY place that
// reads real time; the sim core stays clock-free (docs/03 §3). Versioned JSON save so
// the same format loads in the future Unity build.
import { balance } from "../sim/content";
import { SCHEMA_VERSION, advance, createInitialState } from "../sim/sim";
import type { GameState } from "../sim/types";

const KEY = "bannerfall.save.v1";
const REALTIME_KEY = "bannerfall.lastWallClock";

// How many game ticks elapse per real second of play. With tickLengthSec = 60, a value
// of 0.15 means ~9x real time — deliberately slow (a check-in game), leaning on offline
// catch-up and the active tap-market for forward progress.
export const TICKS_PER_REAL_SECOND = 0.15;

export interface SaveEnvelope { state: GameState; wallClock: number; }

export function save(state: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    localStorage.setItem(REALTIME_KEY, String(Date.now()));
  } catch { /* storage unavailable (private mode); ignore */ }
}

/** Load the save and credit offline progress (capped), or start a new game. */
export function loadOrNew(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.schemaVersion !== SCHEMA_VERSION) return createInitialState();
    const last = Number(localStorage.getItem(REALTIME_KEY) ?? Date.now());
    const elapsedSec = Math.max(0, (Date.now() - last) / 1000);
    const offlineTicks = Math.min(
      balance.maxCatchUpTicks,
      Math.floor(elapsedSec * TICKS_PER_REAL_SECOND),
    );
    return offlineTicks > 0 ? advance(parsed, offlineTicks) : parsed;
  } catch {
    return createInitialState();
  }
}

export function resetSave(): void {
  try { localStorage.removeItem(KEY); localStorage.removeItem(REALTIME_KEY); } catch { /* ignore */ }
}

export function exportSave(state: GameState): string {
  return JSON.stringify({ state, wallClock: Date.now() } satisfies SaveEnvelope, null, 2);
}

export function importSave(json: string): GameState | null {
  try {
    const env = JSON.parse(json) as SaveEnvelope;
    if (env.state?.schemaVersion === SCHEMA_VERSION) return env.state;
  } catch { /* ignore */ }
  return null;
}
