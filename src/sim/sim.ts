// The deterministic simulation core: initial state, the per-tick update, command
// application, and pure selectors the UI reads. No I/O, no clock, no React here
// (docs/03-technical-architecture.md §2).
import { balance, buildingById, troopById, aiById, world, researchById, factions as allFactions } from "./content";
import { computeModifiers, emptyModifiers, isBuildingUnlocked, isTroopUnlocked, rpCostFor, type Modifiers } from "./effects";
import { resolveSiege, type SiegeDefender } from "./siege";
import { nextRandom } from "./rng";
import { bannerTier, renownPerks, BANNER_RANKS } from "./renown";
import { aiTurn, maybeSpawnRival, defenderForTile, initOwnership, key as tileKey, tileLoot, nearestOwnedTile, ownedCount } from "./territory";
import type {
  BuildingDef, BuildingInstance, Command, CommandResult, GameState, RationLevel,
  ResourceId, ResourceMap, SiegeReport,
} from "./types";
import { RESOURCE_IDS } from "./types";

export const SCHEMA_VERSION = 15;  // v15: 30 active rivals at start; dormant rivals awaken over time

/** The player's Town Hall level — the progression spine that gates building tiers
 *  (Appendix S/T). 0 if (somehow) absent. */
export function townHallLevel(s: GameState): number {
  let lvl = 0;
  for (const b of s.buildings) if (b.id === "town_hall") lvl = Math.max(lvl, b.level);
  return lvl;
}
/** Concurrent construction slots — grows with your Banner Rank (Renown). */
export function maxBuildSlots(s: GameState): number {
  return renownPerks(bannerTier(s.resources.renown ?? 0)).buildSlots;
}

// ---------- construction helpers ----------

export function buildCost(def: BuildingDef, targetLevel: number): ResourceMap {
  const out: ResourceMap = {};
  for (const r of RESOURCE_IDS) {
    const base = def.costBase[r];
    if (base) out[r] = Math.round(base * Math.pow(def.costGrowth, targetLevel - 1));
  }
  return out;
}

export function buildTimeTicks(def: BuildingDef, targetLevel: number, mods: Modifiers): number {
  const sec = def.timeBaseSec * Math.pow(def.timeGrowth, targetLevel - 1);
  const mult = Math.max(1 - balance.buildTimeReductionCap, 1 + mods.buildTimePct);
  return Math.max(1, Math.ceil((sec * mult) / balance.tickLengthSec));
}

// ---------- selectors (pure; used by sim + UI) ----------

export function housingCap(s: GameState): number {
  let cap = 8;
  for (const b of s.buildings) cap += (buildingById[b.id].housingBonus ?? 0) * b.level;
  return cap;
}

export function storageCaps(s: GameState, mods: Modifiers): Record<ResourceId, number> {
  const caps = { ...balance.baseStorage };
  for (const b of s.buildings) {
    const bonus = buildingById[b.id].storageBonus;
    if (bonus) for (const r of RESOURCE_IDS) if (bonus[r]) caps[r] += bonus[r]! * b.level;
  }
  for (const r of RESOURCE_IDS) caps[r] = Math.round(caps[r] * (1 + (mods.storageCapPct[r] ?? 0)));
  return caps;
}

export function labourDemand(s: GameState): number {
  let d = 0;
  for (const b of s.buildings) d += buildingById[b.id].labour ?? 0;
  return d;
}

export function staffing(s: GameState): number {
  const d = labourDemand(s);
  return d > 0 ? Math.min(1, s.population / d) : 1;
}

/** Bonus fraction to research-per-level from civic buildings (Scholar's Hall, University). */
export function researchBonus(s: GameState): number {
  let b = 0;
  for (const inst of s.buildings) b += (buildingById[inst.id].researchBonus ?? 0) * inst.level;
  return b;
}

// ---- Village layout grid (drag/arrange your home village) ----
export const villageGrid = () => balance.villageGrid;
/** Buildings shown on the village grid (fortifications live in the Castle). */
export function isVillageBuilding(id: string): boolean {
  return buildingById[id].category !== "fortification";
}
/** Square side length (in tiles) of a building's footprint. 1×1 unless the def says bigger. */
export function footprint(id: string): number {
  return buildingById[id]?.footprint ?? 1;
}
/** The grid cells ("x,y" keys) a building covers when its top (back) corner is at (gx,gy). */
export function buildingCells(id: string, gx: number, gy: number): string[] {
  const n = footprint(id);
  const out: string[] = [];
  for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) out.push(`${gx + dx},${gy + dy}`);
  return out;
}
/** Per-building placement rules for the VILLAGE grid: the whole footprint must fit on the
 *  grid, and the Quarry's footprint must sit entirely in the southmost 1/5 (screen-bottom)
 *  and middle 1/3 (screen-centre). Everything else goes anywhere it fits. */
export function placementAllowed(id: string, gx: number, gy: number): boolean {
  const { cols, rows } = balance.villageGrid;
  const n = footprint(id);
  if (gx < 0 || gy < 0 || gx + n > cols || gy + n > rows) return false;
  if (id !== "quarry") return true;
  const maxSum = (cols - 1) + (rows - 1);
  for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) {
    const sum = (gx + dx) + (gy + dy);   // screen Y (south = larger)
    const diff = (gx + dx) - (gy + dy);  // screen X (centre = ~0)
    if (!(sum >= maxSum * 0.8 && Math.abs(diff) <= maxSum / 6)) return false;
  }
  return true;
}
/** Occupied-cell set for one zone (village or castle), spanning every building's footprint. */
function occupiedCells(buildings: BuildingInstance[], village: boolean, skipIndex = -1): Set<string> {
  const taken = new Set<string>();
  buildings.forEach((b, i) => {
    if (i === skipIndex || isVillageBuilding(b.id) !== village || b.gx === undefined || b.gy === undefined) return;
    for (const c of buildingCells(b.id, b.gx, b.gy)) taken.add(c);
  });
  return taken;
}
/** Scan a grid for a free spot where id's whole footprint fits (no overlap, rules pass).
 *  Tries a coarse lattice first so big sprites get breathing room, then a dense fallback. */
function findFreeSpot(
  id: string, taken: Set<string>, grid: { cols: number; rows: number },
  allowed: (id: string, x: number, y: number) => boolean,
): { gx: number; gy: number } {
  const fits = (x: number, y: number) => allowed(id, x, y) && buildingCells(id, x, y).every((c) => !taken.has(c));
  for (const step of [2, 1]) {
    for (let y = 0; y < grid.rows; y += step) for (let x = 0; x < grid.cols; x += step)
      if (fits(x, y)) return { gx: x, gy: y };
  }
  return { gx: 0, gy: 0 };
}
const inGrid = (grid: { cols: number; rows: number }) => (id: string, x: number, y: number) => {
  const n = footprint(id);
  return x >= 0 && y >= 0 && x + n <= grid.cols && y + n <= grid.rows;
};
/** Can building `id` sit with its footprint anchored at (gx,gy)? Checks grid bounds, the
 *  per-building zone rule (village), and no overlap with other buildings (movingIndex is
 *  excluded so a building can stay put). Shared by the move command and the UI preview. */
export function canPlaceAt(buildings: BuildingInstance[], movingIndex: number, id: string, gx: number, gy: number): boolean {
  const village = isVillageBuilding(id);
  const grid = village ? balance.villageGrid : balance.castleGrid;
  if (village ? !placementAllowed(id, gx, gy) : !inGrid(grid)(id, gx, gy)) return false;
  const taken = occupiedCells(buildings, village, movingIndex);
  return buildingCells(id, gx, gy).every((c) => !taken.has(c));
}
export function firstFreeVillageCell(buildings: BuildingInstance[], id = ""): { gx: number; gy: number } {
  return findFreeSpot(id, occupiedCells(buildings, true), balance.villageGrid, placementAllowed);
}
/** Assign grid cells to village buildings that lack one (init & save migration). Largest
 *  footprints first, so the big centrepieces claim room before the cottages fill in. */
export function placeVillageBuildings(buildings: BuildingInstance[]): BuildingInstance[] {
  return placeZone(buildings, true, balance.villageGrid, placementAllowed);
}

// ---- Castle layout grid (design your fortress) — fortifications reuse gx/gy here. ----
export const castleGrid = () => balance.castleGrid;
export function firstFreeCastleCell(buildings: BuildingInstance[]): { gx: number; gy: number } {
  return findFreeSpot("", occupiedCells(buildings, false), balance.castleGrid, inGrid(balance.castleGrid));
}
export function placeCastleBuildings(buildings: BuildingInstance[]): BuildingInstance[] {
  return placeZone(buildings, false, balance.castleGrid, inGrid(balance.castleGrid));
}

/** Shared placer: assign footprint-fitting cells to buildings of one zone that lack them. */
function placeZone(
  buildings: BuildingInstance[], village: boolean, grid: { cols: number; rows: number },
  allowed: (id: string, x: number, y: number) => boolean,
): BuildingInstance[] {
  const inZone = (b: BuildingInstance) => isVillageBuilding(b.id) === village;
  const taken = occupiedCells(buildings, village);
  const pending = buildings
    .filter((b) => inZone(b) && b.gx === undefined)
    .sort((a, b) => footprint(b.id) - footprint(a.id));   // biggest first
  for (const b of pending) {
    const c = findFreeSpot(b.id, taken, grid, allowed);
    b.gx = c.gx; b.gy = c.gy;
    for (const cell of buildingCells(b.id, c.gx, c.gy)) taken.add(cell);
  }
  return buildings;
}

function taxHappiness(rate: number): number {
  let best = balance.taxHappiness[0];
  for (const e of balance.taxHappiness) if (e.rate <= rate + 1e-9) best = e;
  return best.happiness;
}

export function happiness(s: GameState, mods: Modifiers): number {
  let h = balance.rationHappiness[s.rationLevel] + taxHappiness(s.taxRate) + mods.happinessFlat;
  for (const b of s.buildings) h += buildingById[b.id].happiness ?? 0;
  const cap = housingCap(s);
  if (s.population > cap * 0.9) h -= (s.population / cap - 0.9) * balance.crowdingPenaltyPerPctOver;
  // Sprawl: a larger realm is harder to keep content.
  const tiles = ownedCount(s.tileOwner, "player");
  h -= Math.floor(Math.max(0, tiles - balance.conquest.freeTiles) / 10) * balance.conquest.sprawlHappinessPer10;
  return Math.round(h * 10) / 10;
}

/** Net resource change per tick at current settings (for the HUD). */
export function netProduction(s: GameState, mods: Modifiers): Record<ResourceId, number> {
  const net: Record<ResourceId, number> = { food: 0, wood: 0, stone: 0, iron: 0, gold: 0, rp: 0, token: 0, renown: 0 };
  const st = staffing(s);
  for (const b of s.buildings) {
    const def = buildingById[b.id];
    if (def.produces) for (const r of RESOURCE_IDS) if (def.produces[r]) {
      // passive output is gated by Idle Income research (mods.idleIncomePct, 10%→50%)
      net[r] += def.produces[r]! * b.level * st * (1 + (mods.productionPct[def.id] ?? 0)) * mods.idleIncomePct;
    }
    if (def.consumes) for (const r of RESOURCE_IDS) if (def.consumes[r]) net[r] -= def.consumes[r]! * b.level;
  }
  net.food -= s.population * balance.foodPerCapitaPerTick * balance.rationTable[s.rationLevel];
  net.gold += s.population * balance.baseTaxYieldPerCapita * s.taxRate * (1 + mods.taxYieldPct);
  // Realm upkeep: holding many lands drains the treasury (late-game slowdown).
  const tiles = ownedCount(s.tileOwner, "player");
  net.gold -= Math.max(0, tiles - balance.conquest.freeTiles) * balance.conquest.tileUpkeepGold;
  for (const r of RESOURCE_IDS) net[r] = Math.round(net[r] * 100) / 100;
  return net;
}

// ---------- initial state ----------

export function createInitialState(seed = 12345): GameState {
  // A bare founding: just the Town Hall. The early economy is driven by the tap-market
  // (tokens → buy materials → build), and passive income is unlocked via Idle Income research.
  const starting: { id: string; level: number }[] = [
    { id: "town_hall", level: 1 },
  ];
  placeVillageBuildings(starting);
  placeCastleBuildings(starting);
  const aiState: GameState["aiState"] = {};
  for (const v of world.aiVillages) aiState[v.id] = { lootedUntilTick: 0 };
  return {
    schemaVersion: SCHEMA_VERSION,
    tick: 0,
    rngState: seed,
    resources: { ...balance.startingResources },
    population: balance.startingPopulation,
    rationLevel: "normal",
    taxRate: 0.1,
    buildings: starting,
    buildQueue: [],
    research: {},
    troops: {},
    trainQueue: [],
    marches: [],
    aiState,
    tileOwner: initOwnership(),
    intel: {},
    factionStrength: Object.fromEntries(allFactions.filter((f) => !f.isPlayer).map((f) => [f.id, f.difficulty * 8])),
    reports: [],
    log: [{ tick: 0, text: "Your village is founded. Long may it stand.", kind: "info" }],
    nextId: 1,
    lastAiTurn: 0,
    lastSpawnTick: 0,
  };
}

// ---------- the tick ----------

function clampResources(s: GameState, caps: Record<ResourceId, number>) {
  for (const r of RESOURCE_IDS) s.resources[r] = Math.max(0, Math.min(caps[r], s.resources[r]));
}

function log(s: GameState, text: string, kind: GameState["log"][number]["kind"]) {
  s.log.unshift({ tick: s.tick, text, kind });
  if (s.log.length > 60) s.log.length = 60;
}

/** Deterministic randomised loot from a scouting expedition, scaled by the Scouting
 *  Parties research rank (via mods.scoutYieldPct). Advances the RNG stream. */
function rollScoutLoot(s: GameState, mods: Modifiers): ResourceMap {
  const out: ResourceMap = {};
  const mult = 1 + mods.scoutYieldPct;
  for (const r of RESOURCE_IDS) {
    const base = balance.scouting.baseLoot[r];
    if (!base) continue;
    const rnd = nextRandom(s.rngState); s.rngState = rnd.state;
    const amt = Math.round(base * mult * (0.5 + rnd.value)); // 0.5x–1.5x of scaled base
    if (amt > 0) out[r] = amt;
  }
  return out;
}

export function scoutTravelTicks(state: GameState, mods: Modifiers): number {
  const rank = state.research["scouting"] ?? 0;
  const speed = 1 + mods.marchSpeedPct;
  const base = balance.scouting.baseTravelTicks - rank * balance.scouting.travelTicksPerRankReduction;
  return Math.max(30, Math.round(base / speed));
}

function tickOnce(s: GameState, mods: Modifiers, caps: Record<ResourceId, number>): void {
  const net = netProduction(s, mods);

  // Resources (food handled specially for starvation).
  const foodBefore = s.resources.food;
  for (const r of RESOURCE_IDS) s.resources[r] += net[r];
  let starving = false;
  if (s.resources.food < 0) { starving = true; s.resources.food = 0; }
  clampResources(s, caps);

  // Population dynamics.
  const h = happiness(s, mods);
  const cap = housingCap(s);
  if (starving && foodBefore <= 0) {
    s.population = Math.max(0, s.population - s.population * balance.starvationDeclinePerTick);
  } else if (h > 0 && s.population < cap) {
    s.population = Math.min(cap, s.population + h * balance.popGrowthPerHappyPointPerTick);
  } else if (h < 0) {
    s.population = Math.max(0, s.population - balance.popDeclinePerTick * Math.min(3, -h));
  }

  // Build queue (sequential, MAX_BUILD_SLOTS run concurrently).
  for (let i = 0; i < Math.min(maxBuildSlots(s), s.buildQueue.length); i++) {
    const o = s.buildQueue[i];
    if (o.startedTick === null) o.startedTick = s.tick;
  }
  s.buildQueue = s.buildQueue.filter((o) => {
    if (o.startedTick !== null && s.tick - o.startedTick >= o.durationTicks) {
      if (o.instanceIndex === null) {
        // Completed but UNPLACED — the player taps an empty plot to set it down.
        s.buildings.push({ id: o.building, level: 1 });
      } else s.buildings[o.instanceIndex].level = o.targetLevel;
      // Research is earned by DEVELOPING: each building level gained grants RP,
      // amplified by civic buildings (scholars' hall, university).
      const rp = Math.round(balance.researchPerLevel * o.targetLevel * (1 + researchBonus(s)));
      s.resources.rp += rp;
      log(s, `${buildingById[o.building].name} reaches level ${o.targetLevel}. +${rp} research.`, "good");
      return false;
    }
    return true;
  });

  // Training (incremental, one unit at a time on the front order).
  if (s.trainQueue.length > 0) {
    const o = s.trainQueue[0];
    if (o.startedTick === null) o.startedTick = s.tick;
    if (s.tick - o.startedTick >= o.perUnitTicks) {
      s.troops[o.troop] = (s.troops[o.troop] ?? 0) + 1;
      o.count -= 1;
      o.startedTick = s.tick;
      if (o.count <= 0) {
        log(s, `${troopById[o.troop].name} training complete.`, "good");
        s.trainQueue.shift();
      }
    }
  }

  // Marches (assaults and scouting expeditions).
  s.marches = s.marches.filter((mch) => {
    if (s.tick < mch.arriveTick) return true;

    if (mch.phase === "outbound" && mch.kind === "scout") {
      let loot: ResourceMap = {};
      let lines: string[];
      if (mch.targetTile) {
        // recon: raise this tile's intel level (surveilled if Scouting is high)
        const level = (s.research["scouting"] ?? 0) >= 3 ? 3 : 2;
        s.intel[tileKey(mch.targetTile.x, mch.targetTile.y)] = Math.max(s.intel[tileKey(mch.targetTile.x, mch.targetTile.y)] ?? 0, level);
        lines = [`Your scouts surveil (${mch.targetTile.x},${mch.targetTile.y}).`,
          level >= 3 ? "Full intel gathered — exact garrison and walls revealed." : "Garrison strength estimated."];
      } else {
        loot = rollScoutLoot(s, mods);
        lines = ["Your scouts comb the wilds beyond the borders.",
          Object.keys(loot).length ? "They return with a cache of supplies." : "They find little of value this time."];
      }
      const report: SiegeReport = {
        id: `r${s.nextId++}`, kind: "scout", tick: s.tick, targetName: mch.targetName,
        victory: true, breached: false, attackerLosses: {}, defenderLosses: {},
        loot, lines,
      };
      s.reports.unshift(report);
      if (s.reports.length > 30) s.reports.length = 30;
      mch.phase = "returning"; mch.loot = loot; mch.reportId = report.id;
      mch.arriveTick = s.tick + mch.travelTicks;
      return true;
    }

    if (mch.phase === "outbound" && mch.kind === "conquer" && mch.targetTile) {
      const { x, y } = mch.targetTile;
      const def = defenderForTile(s.tileOwner, x, y);
      const outcome = resolveSiege(mch.army, { garrison: def.garrison, fortifications: def.fortifications }, mods, s.rngState, emptyModifiers());
      s.rngState = outcome.rngState;
      let loot: ResourceMap = {};
      if (outcome.victory) {
        const diff = aiById[def.ownerId]?.difficulty ?? 1;
        if (def.isCapital) {
          // capital falls: faction is broken, its lands revert to neutral
          const fallenId = def.ownerId;
          for (const k of Object.keys(s.tileOwner)) if (s.tileOwner[k] === fallenId) s.tileOwner[k] = "neutral";
          s.tileOwner[tileKey(x, y)] = "player";
          loot = { ...(aiById[fallenId]?.loot ?? {}) };
          const r = 200 + diff * 40;
          s.resources.renown += r;
          log(s, `${aiById[fallenId]?.name ?? "A rival"} has fallen! Their capital is yours. +${r} renown.`, "war");
        } else {
          s.tileOwner[tileKey(x, y)] = "player";
          loot = tileLoot(s, def.ownerId);
          const r = 10 + diff * 5;
          s.resources.renown += r;
          log(s, `You claimed the land at (${x},${y}). +${r} renown.`, "war");
        }
      } else {
        log(s, `Your conquest at (${x},${y}) was thrown back.`, "bad");
      }
      const report: SiegeReport = {
        id: `r${s.nextId++}`, kind: "conquer", tick: s.tick, targetName: `(${x},${y})`,
        victory: outcome.victory, breached: outcome.breached,
        attackerLosses: outcome.attackerLosses, defenderLosses: outcome.defenderLosses,
        loot, lines: outcome.lines,
      };
      s.reports.unshift(report);
      if (s.reports.length > 30) s.reports.length = 30;
      const survivors = outcome.attackerSurvivors;
      if (!Object.values(survivors).some((c) => c > 0)) return false;
      mch.phase = "returning"; mch.army = survivors; mch.loot = loot;
      mch.reportId = report.id; mch.arriveTick = s.tick + mch.travelTicks;
      return true;
    }

    if (mch.phase === "outbound") {
      const ai = aiById[mch.targetId];
      const defender: SiegeDefender = {
        garrison: Object.fromEntries(ai.garrison.map((g) => [g.troop, g.count])),
        fortifications: ai.fortifications,
      };
      const outcome = resolveSiege(mch.army, defender, mods, s.rngState, emptyModifiers());
      s.rngState = outcome.rngState;
      const canLoot = outcome.victory && s.tick >= s.aiState[ai.id].lootedUntilTick;
      const loot: ResourceMap = canLoot ? { ...ai.loot } : {};
      if (canLoot) s.aiState[ai.id].lootedUntilTick = s.tick + ai.regrowTicks;
      const report: SiegeReport = {
        id: `r${s.nextId++}`, kind: "assault", tick: s.tick, targetName: ai.name,
        victory: outcome.victory, breached: outcome.breached,
        attackerLosses: outcome.attackerLosses, defenderLosses: outcome.defenderLosses,
        loot, lines: outcome.lines,
      };
      s.reports.unshift(report);
      if (s.reports.length > 30) s.reports.length = 30;
      if (outcome.victory) s.resources.renown += 8 + ai.difficulty * 4;
      log(s, outcome.victory ? `Victory at ${ai.name}! +${8 + ai.difficulty * 4} renown.` : `Assault on ${ai.name} repelled.`,
        outcome.victory ? "war" : "bad");
      const survivors = outcome.attackerSurvivors;
      const anyLeft = Object.values(survivors).some((c) => c > 0);
      if (!anyLeft) return false; // army wiped out, no return
      mch.phase = "returning"; mch.army = survivors; mch.loot = loot;
      mch.reportId = report.id; mch.arriveTick = s.tick + mch.travelTicks;
      return true;
    }

    // returning
    for (const [id, c] of Object.entries(mch.army)) s.troops[id] = (s.troops[id] ?? 0) + c;
    if (mch.loot && Object.keys(mch.loot).length > 0) {
      for (const r of RESOURCE_IDS) if (mch.loot[r]) s.resources[r] += mch.loot[r]!;
      clampResources(s, caps);
      log(s, mch.kind === "scout" ? `Scouts return with supplies.` : `Army returns home with the spoils.`, "good");
    } else {
      log(s, mch.kind === "scout" ? `Scouts return empty-handed.` : `Survivors return home.`, "info");
    }
    return false;
  });

  // Rival factions expand, skirmish each other, and raid the player's borders on an interval.
  aiTurn(s);
  // New rivals rise onto the map over time (rising difficulty, scaled to player progress).
  maybeSpawnRival(s);

  s.tick += 1;
}

export function advance(state: GameState, ticks: number): GameState {
  const s: GameState = structuredClone(state);
  const n = Math.max(0, Math.min(ticks, balance.maxCatchUpTicks));
  if (n === 0) return s;
  const mods = computeModifiers(s);
  const caps = storageCaps(s, mods);
  for (let i = 0; i < n; i++) tickOnce(s, mods, caps);
  return s;
}

// ---------- commands ----------

function canAfford(res: Record<ResourceId, number>, cost: ResourceMap): boolean {
  for (const r of RESOURCE_IDS) if (cost[r] && res[r] < cost[r]!) return false;
  return true;
}
function spend(res: Record<ResourceId, number>, cost: ResourceMap): void {
  for (const r of RESOURCE_IDS) if (cost[r]) res[r] -= cost[r]!;
}
function refund(res: Record<ResourceId, number>, cost: ResourceMap): void {
  for (const r of RESOURCE_IDS) if (cost[r]) res[r] += cost[r]!;
}

export function applyCommand(state: GameState, cmd: Command): { state: GameState; result: CommandResult } {
  const s: GameState = structuredClone(state);
  const mods = computeModifiers(s);
  const fail = (error: string) => ({ state, result: { ok: false, error } });
  const ok = () => ({ state: s, result: { ok: true } });

  switch (cmd.type) {
    case "setRation": s.rationLevel = cmd.level as RationLevel; return ok();
    case "setTax": s.taxRate = Math.max(0, Math.min(0.6, cmd.rate)); return ok();

    case "build": {
      const def = buildingById[cmd.building];
      if (!def) return fail("Unknown building.");
      if (!isBuildingUnlocked(def.id, mods)) return fail("Not yet researched.");
      if (s.buildQueue.length >= maxBuildSlots(s) + 2) return fail("Build queue full.");
      const idx = cmd.instanceIndex ?? null;
      let targetLevel = 1;
      if (idx !== null) {
        const inst = s.buildings[idx];
        if (!inst || inst.id !== def.id) return fail("Invalid building to upgrade.");
        if (inst.level >= def.maxLevel) return fail("Already at max level.");
        // account for queued upgrades of the same instance
        const queued = s.buildQueue.filter((o) => o.instanceIndex === idx).length;
        targetLevel = inst.level + 1 + queued;
        if (targetLevel > def.maxLevel) return fail("Already at max level.");
      } else {
        // New construction is gated by Town Hall level (the progression spine)…
        const tier = def.tier ?? 1;
        if (townHallLevel(s) < tier) return fail(`Requires Town Hall L${tier}.`);
        // …and prestige buildings are gated by Banner Rank (Renown).
        const needRank = def.requires?.bannerTier ?? 0;
        if (needRank > 0 && bannerTier(s.resources.renown ?? 0) < needRank) return fail(`Requires Banner Rank: ${BANNER_RANKS[needRank].title}.`);
      }
      for (const reqB of def.requires?.buildings ?? [])
        if (!s.buildings.some((b) => b.id === reqB)) return fail(`Requires ${buildingById[reqB]?.name ?? reqB}.`);
      for (const reqR of def.requires?.research ?? [])
        if ((s.research[reqR.id] ?? 0) < reqR.rank) return fail("Missing research.");
      const cost = buildCost(def, targetLevel);
      if (!canAfford(s.resources, cost)) return fail("Not enough resources.");
      spend(s.resources, cost);
      s.buildQueue.push({
        building: def.id, instanceIndex: idx, targetLevel,
        durationTicks: buildTimeTicks(def, targetLevel, mods), cost, startedTick: null,
      });
      return ok();
    }

    case "cancelBuild": {
      const o = s.buildQueue[cmd.queueIndex];
      if (!o) return fail("No such order.");
      refund(s.resources, o.cost);
      s.buildQueue.splice(cmd.queueIndex, 1);
      return ok();
    }

    case "research": {
      const rank = s.research[cmd.research] ?? 0;
      const rdef = researchById[cmd.research];
      if (!rdef) return fail("Unknown research.");
      if (rank >= rdef.maxRank) return fail("Already maxed.");
      for (const reqR of rdef.requires?.research ?? [])
        if ((s.research[reqR.id] ?? 0) < reqR.rank) return fail("Missing prerequisite research.");
      for (const [bid, lvl] of Object.entries(rdef.requires?.buildingLevels ?? {}))
        if (!s.buildings.some((b) => b.id === bid && b.level >= lvl)) return fail(`Requires ${buildingById[bid]?.name ?? bid} L${lvl}.`);
      const cost = rpCostFor(cmd.research, rank);
      if (s.resources.rp < cost) return fail(`Need ${cost} research points.`);
      s.resources.rp -= cost;
      s.research[cmd.research] = rank + 1;
      log(s, `Researched ${rdef.name} (rank ${rank + 1}).`, "good");
      return ok();
    }

    case "train": {
      const def = troopById[cmd.troop];
      if (!def) return fail("Unknown troop.");
      if (!isTroopUnlocked(def.id, mods)) return fail("Not yet researched.");
      if (cmd.count <= 0) return fail("Choose a count.");
      for (const [bid, lvl] of Object.entries(def.requires?.buildings ?? {}))
        if (!s.buildings.some((b) => b.id === bid && b.level >= lvl)) return fail(`Requires ${buildingById[bid]?.name ?? bid} L${lvl}.`);
      const cost: ResourceMap = {};
      for (const r of RESOURCE_IDS) if (def.cost[r]) cost[r] = def.cost[r]! * cmd.count;
      if (!canAfford(s.resources, cost)) return fail("Not enough resources.");
      spend(s.resources, cost);
      s.trainQueue.push({
        troop: def.id, count: cmd.count,
        perUnitTicks: Math.max(1, Math.ceil(def.trainTimeSec / balance.tickLengthSec)),
        startedTick: null,
      });
      return ok();
    }

    case "attack": {
      const ai = aiById[cmd.targetId];
      if (!ai) return fail("Unknown target.");
      let total = 0;
      for (const [id, c] of Object.entries(cmd.army)) {
        if (c < 0) return fail("Bad army.");
        if ((s.troops[id] ?? 0) < c) return fail("Not enough troops.");
        total += c;
      }
      if (total <= 0) return fail("Send at least one unit.");
      for (const [id, c] of Object.entries(cmd.army)) if (c > 0) s.troops[id] -= c;
      const dist = nearestOwnedTile(s.tileOwner, ai.tile.x, ai.tile.y).dist;
      const speed = 1 + mods.marchSpeedPct;
      const travelTicks = Math.max(1, Math.round((dist * balance.conquest.tileTravelPerTile) / speed));
      s.marches.push({
        id: `m${s.nextId++}`, kind: "assault", targetId: ai.id, targetName: ai.name,
        army: Object.fromEntries(Object.entries(cmd.army).filter(([, c]) => c > 0)),
        phase: "outbound", arriveTick: s.tick + travelTicks, travelTicks,
      });
      log(s, `Army marches on ${ai.name}.`, "war");
      return ok();
    }

    case "tap": {
      s.resources.token += balance.market.tokensPerTap;
      return ok();
    }

    case "buy": {
      const price = balance.market.buyPriceTokens[cmd.resource];
      if (!price) return fail("Not for sale.");
      const amount = Math.max(0, Math.floor(cmd.amount));
      if (amount <= 0) return fail("Choose an amount.");
      const cost = Math.ceil(price * amount);
      if (s.resources.token < cost) return fail(`Need ${cost} tokens.`);
      const cap = storageCaps(s, mods)[cmd.resource];
      if (s.resources[cmd.resource] + amount > cap) return fail("Not enough storage.");
      s.resources.token -= cost;
      s.resources[cmd.resource] += amount;
      return ok();
    }

    case "sell": {
      const rate = balance.market.sellPriceTokens[cmd.resource];
      if (!rate) return fail("The market won't buy that.");
      const amount = Math.max(0, Math.floor(cmd.amount));
      if (amount <= 0) return fail("Choose an amount.");
      if (s.resources[cmd.resource] < amount) return fail("Not enough to sell.");
      const gain = Math.floor(rate * amount);
      if (gain <= 0) return fail("Too little to be worth selling.");
      s.resources[cmd.resource] -= amount;
      s.resources.token += gain;
      return ok();
    }

    case "scout": {
      if ((s.research["scouting"] ?? 0) <= 0) return fail("Research Scouting Parties first.");
      const cost = balance.scouting.sendCost;
      if (!canAfford(s.resources, cost)) return fail("Not enough supplies to send scouts.");
      spend(s.resources, cost);
      const travelTicks = scoutTravelTicks(s, mods);
      s.marches.push({
        id: `m${s.nextId++}`, kind: "scout", targetId: "wilds", targetName: "The Wilds",
        army: {}, phase: "outbound", arriveTick: s.tick + travelTicks, travelTicks,
      });
      log(s, `Scouting party sets out into the wilds.`, "info");
      return ok();
    }

    case "scoutTile": {
      if ((s.research["scouting"] ?? 0) <= 0) return fail("Research Scouting Parties first.");
      const k = tileKey(cmd.x, cmd.y);
      if (s.tileOwner[k] === undefined) return fail("Nothing to scout there.");
      if (s.tileOwner[k] === "player") return fail("That land is already yours.");
      const cost = balance.scouting.sendCost;
      if (!canAfford(s.resources, cost)) return fail("Not enough supplies to send scouts.");
      spend(s.resources, cost);
      const dist = nearestOwnedTile(s.tileOwner, cmd.x, cmd.y).dist;
      const travelTicks = Math.max(1, Math.round((dist * balance.conquest.tileTravelPerTile) / (1 + mods.marchSpeedPct)));
      s.marches.push({
        id: `m${s.nextId++}`, kind: "scout", targetId: k, targetName: `Scouts → (${cmd.x},${cmd.y})`,
        army: {}, phase: "outbound", arriveTick: s.tick + travelTicks, travelTicks, targetTile: { x: cmd.x, y: cmd.y },
      });
      log(s, `Scouts head out to survey (${cmd.x},${cmd.y}).`, "info");
      return ok();
    }

    case "moveBuilding": {
      const inst = s.buildings[cmd.index];
      if (!inst) return fail("No such building.");
      if (!canPlaceAt(s.buildings, cmd.index, inst.id, cmd.gx, cmd.gy)) return fail("That building can't go there.");
      inst.gx = cmd.gx; inst.gy = cmd.gy;
      return ok();
    }

    case "conquer": {
      const k = tileKey(cmd.x, cmd.y);
      const owner = s.tileOwner[k];
      if (owner === undefined) return fail("That is open sea, not land.");
      if (owner === "player") return fail("You already hold that land.");
      let total = 0;
      for (const [id, c] of Object.entries(cmd.army)) {
        if (c < 0) return fail("Bad army.");
        if ((s.troops[id] ?? 0) < c) return fail("Not enough troops.");
        total += c;
      }
      if (total <= 0) return fail("Send at least one unit.");
      for (const [id, c] of Object.entries(cmd.army)) if (c > 0) s.troops[id] -= c;
      const dist = nearestOwnedTile(s.tileOwner, cmd.x, cmd.y).dist;
      const speed = 1 + mods.marchSpeedPct;
      const travelTicks = Math.max(1, Math.round((dist * balance.conquest.tileTravelPerTile) / speed));
      s.marches.push({
        id: `m${s.nextId++}`, kind: "conquer", targetId: k, targetName: `(${cmd.x},${cmd.y})`,
        army: Object.fromEntries(Object.entries(cmd.army).filter(([, c]) => c > 0)),
        phase: "outbound", arriveTick: s.tick + travelTicks, travelTicks, targetTile: { x: cmd.x, y: cmd.y },
      });
      log(s, `Your army marches to conquer (${cmd.x},${cmd.y}).`, "war");
      return ok();
    }
  }
}
