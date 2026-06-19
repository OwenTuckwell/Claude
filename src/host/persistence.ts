// Host layer: persistence + the wall-clock → ticks bridge. This is the ONLY place that
// reads real time; the sim core stays clock-free (docs/03 §3). Versioned JSON save so
// the same format loads in the future Unity build.
import { balance } from "../sim/content";
import { SCHEMA_VERSION, advance, createInitialState, placeVillageBuildings, placeCastleBuildings, isVillageBuilding } from "../sim/sim";
import type { GameState } from "../sim/types";
import { RESOURCE_IDS } from "../sim/types";

const KEY = "bannerfall.save.v1";
const REALTIME_KEY = "bannerfall.lastWallClock";

// How many game ticks elapse per real second of play. With tickLengthSec = 60, a value
// of 0.15 means ~9x real time — deliberately slow (a check-in game), leaning on offline
// catch-up and the active tap-market for forward progress.
export const TICKS_PER_REAL_SECOND = 0.15;

export interface SaveEnvelope { state: GameState; wallClock: number; }

/** Bring any older/partial save up to the current shape WITHOUT wiping progress.
 *  Your village (buildings/research/troops/resources) is preserved; only world-coupled
 *  fields (territory/intel/marches), which may reference a changed map, reset to fresh.
 *  (docs/05 Appendix O — save & migration.) */
export function migrate(old: unknown): GameState {
  const base = createInitialState();
  if (!old || typeof old !== "object") return base;
  const o = old as Record<string, any>;
  if (o.schemaVersion === SCHEMA_VERSION && o.tileOwner && o.intel) return o as GameState;

  const resources = { ...base.resources };
  if (o.resources && typeof o.resources === "object")
    for (const r of RESOURCE_IDS) if (typeof o.resources[r] === "number") resources[r] = o.resources[r];

  // Ensure the Town Hall exists (progression spine added in schema v8). Older saves get
  // one at a level scaled to their build-out so they aren't locked out of construction.
  let buildings = Array.isArray(o.buildings) ? o.buildings : base.buildings;
  if (!buildings.some((b: { id: string }) => b.id === "town_hall")) {
    const level = Math.max(1, Math.min(8, Math.ceil(buildings.length / 3)));
    buildings = [{ id: "town_hall", level }, ...buildings];
  }
  // re-place village buildings on the (now larger, spaced) grid
  for (const b of buildings) if (isVillageBuilding(b.id)) { b.gx = undefined; b.gy = undefined; }
  placeVillageBuildings(buildings); // assign village plots to any building missing one
  placeCastleBuildings(buildings);  // assign castle plots to fortifications

  return {
    ...base,
    resources,
    population: typeof o.population === "number" ? o.population : base.population,
    rationLevel: o.rationLevel ?? base.rationLevel,
    taxRate: typeof o.taxRate === "number" ? o.taxRate : base.taxRate,
    buildings,
    buildQueue: Array.isArray(o.buildQueue) ? o.buildQueue : [],
    research: o.research && typeof o.research === "object" ? o.research : {},
    troops: o.troops && typeof o.troops === "object" ? o.troops : {},
    trainQueue: Array.isArray(o.trainQueue) ? o.trainQueue : [],
    reports: Array.isArray(o.reports) ? o.reports.slice(0, 30) : [],
    log: Array.isArray(o.log) ? o.log.slice(0, 60) : base.log,
    nextId: typeof o.nextId === "number" ? o.nextId : base.nextId,
    tick: typeof o.tick === "number" ? o.tick : 0,
    rngState: typeof o.rngState === "number" ? o.rngState : base.rngState,
    // world-coupled fields reset to fresh (the map may have changed between versions)
    tileOwner: base.tileOwner, intel: {}, marches: [], aiState: base.aiState, lastAiTurn: 0,
    schemaVersion: SCHEMA_VERSION,
  };
}

export function save(state: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    localStorage.setItem(REALTIME_KEY, String(Date.now()));
  } catch { /* storage unavailable (private mode); ignore */ }
}

/** Load the save (migrating if needed) and credit offline progress (capped). */
export function loadOrNew(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createInitialState();
    const state = migrate(JSON.parse(raw));
    const last = Number(localStorage.getItem(REALTIME_KEY) ?? Date.now());
    const elapsedSec = Math.max(0, (Date.now() - last) / 1000);
    const offlineTicks = Math.min(
      balance.maxCatchUpTicks,
      Math.floor(elapsedSec * TICKS_PER_REAL_SECOND),
    );
    return offlineTicks > 0 ? advance(state, offlineTicks) : state;
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
    if (env.state) return migrate(env.state);
  } catch { /* ignore */ }
  return null;
}
