// Territory, rank progression, the Crown, and the AI factions' turns.
// Deterministic and pure-ish: aiTurn mutates the passed state (called from the tick).
import { world, factions, factionById, aiById, balance, troopById, buildingById } from "./content";
import { nextRandom } from "./rng";
import { archetypeInfoFor, archetypeFor, ARCHETYPE, playerStrengthIndex } from "./rivals";
import { resolveSiege, type SiegeDefender } from "./siege";
import { computeModifiers, emptyModifiers } from "./effects";
import type { SiegeReport, BuildingInstance } from "./types";
import type { GameState, ResourceMap } from "./types";
import { RESOURCE_IDS } from "./types";

export const key = (x: number, y: number) => `${x},${y}`;
export const isLand = (x: number, y: number) => world.land[y]?.[x] === "#";

let _landTiles: { x: number; y: number }[] | null = null;
export function landTiles(): { x: number; y: number }[] {
  if (_landTiles) return _landTiles;
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < world.gridSize.h; y++)
    for (let x = 0; x < world.gridSize.w; x++) if (isLand(x, y)) out.push({ x, y });
  return (_landTiles = out);
}
export const totalLand = () => landTiles().length;

function neighbors(x: number, y: number) {
  return [{ x: x - 1, y }, { x: x + 1, y }, { x, y: y - 1 }, { x, y: y + 1 }].filter((t) => isLand(t.x, t.y));
}

/** Initial ownership: each faction holds its capital + immediate neighbours; the rest of
 *  the land is neutral and there for the taking. You start small — a peasant's holding. */
export function initOwnership(): Record<string, string> {
  const owner: Record<string, string> = {};
  for (const t of landTiles()) owner[key(t.x, t.y)] = "neutral";
  // Only the lowest-difficulty (nearest) rivals start active; the rest stay dormant and
  // awaken over time (maybeSpawnRival) so the world ratchets up as the game progresses.
  const rivals = factions.filter((f) => !f.isPlayer).slice().sort((a, b) => a.difficulty - b.difficulty);
  const active = new Set<string>(rivals.slice(0, balance.conquest.startingActiveRivals).map((f) => f.id));
  for (const f of factions) {
    if (!f.isPlayer && !active.has(f.id)) continue; // dormant rival — not on the map yet
    owner[key(f.capital.x, f.capital.y)] = f.id;
    for (const n of neighbors(f.capital.x, f.capital.y))
      if (owner[key(n.x, n.y)] === "neutral") owner[key(n.x, n.y)] = f.id;
  }
  return owner;
}

export function ownedCount(tileOwner: Record<string, string>, id: string): number {
  let n = 0;
  for (const v of Object.values(tileOwner)) if (v === id) n++;
  return n;
}

/** Distance (and the tile) from the player's nearest holding to a target — travel is
 *  measured from your border, not your capital, so reach grows with your realm. */
export function nearestOwnedTile(tileOwner: Record<string, string>, x: number, y: number, ownerId = "player"): { x: number; y: number; dist: number } {
  let best = { x: world.player.tile.x, y: world.player.tile.y, dist: Infinity };
  for (const t of landTiles()) {
    if (tileOwner[key(t.x, t.y)] !== ownerId) continue;
    const d = Math.max(Math.abs(t.x - x), Math.abs(t.y - y));
    if (d < best.dist) best = { x: t.x, y: t.y, dist: d };
  }
  if (best.dist === Infinity) best = { x: world.player.tile.x, y: world.player.tile.y, dist: Math.max(Math.abs(world.player.tile.x - x), Math.abs(world.player.tile.y - y)) };
  return best;
}

export function crownHolderId(tileOwner: Record<string, string>): string | null {
  const counts: Record<string, number> = {};
  for (const v of Object.values(tileOwner)) if (v !== "neutral") counts[v] = (counts[v] ?? 0) + 1;
  let best: string | null = null, bestN = 0;
  for (const [id, n] of Object.entries(counts)) if (n > bestN) { best = id; bestN = n; }
  if (best && bestN / totalLand() >= balance.conquest.kingThresholdPct) return best;
  return null;
}

export const RANKS = [
  { name: "Peasant", min: 0 }, { name: "Freeman", min: 6 }, { name: "Yeoman", min: 10 },
  { name: "Reeve", min: 16 }, { name: "Squire", min: 24 }, { name: "Knight", min: 34 },
  { name: "Baron", min: 46 }, { name: "Earl", min: 60 }, { name: "Duke", min: 76 },
  { name: "Prince", min: 94 },
];

export function rankName(tiles: number, isCrown: boolean): string {
  if (isCrown) return "King";
  let r = RANKS[0].name;
  for (const rk of RANKS) if (tiles >= rk.min) r = rk.name;
  return r;
}

export interface RealmInfo {
  tiles: number; rank: string; isKing: boolean;
  kingId: string | null; kingName: string;
}
export function realmInfo(state: GameState): RealmInfo {
  const tiles = ownedCount(state.tileOwner, "player");
  const kingId = crownHolderId(state.tileOwner);
  const isKing = kingId === "player";
  return {
    tiles, rank: rankName(tiles, isKing), isKing, kingId,
    kingName: kingId ? factionById[kingId]?.name ?? "—" : "— (no king yet)",
  };
}

export interface TileDefender { garrison: Record<string, number>; fortifications: { building: string; level: number }[]; ownerId: string; isCapital: boolean; enclosure?: number; }

/** How well an AI capital's walls seal its keep, by difficulty — tougher rivals are
 *  better-fortified, so their wall HP counts for more (mirrors the player's castle
 *  enclosure). Scouting reveals this so you can plan which keeps need siege engines. */
export function aiEnclosure(difficulty: number): number {
  return Math.min(1, 0.55 + difficulty * 0.09);   // d1 ≈ 0.64 … d5 = 1.0
}

export function defenderForTile(tileOwner: Record<string, string>, x: number, y: number): TileDefender {
  const ownerId = tileOwner[key(x, y)] ?? "neutral";
  // The world levels up with you: garrisons swell as your realm grows (a slowdown lever).
  const scale = 1 + ownedCount(tileOwner, "player") * balance.conquest.defenderScalePerTile;
  const grow = (g: Record<string, number>) => Object.fromEntries(Object.entries(g).map(([t, c]) => [t, Math.max(1, Math.round(c * scale))]));
  const cap = factions.find((f) => f.capital.x === x && f.capital.y === y && !f.isPlayer);
  if (cap && ownerId === cap.id) {
    const v = aiById[cap.id];
    return { garrison: grow(Object.fromEntries(v.garrison.map((g) => [g.troop, g.count]))), fortifications: v.fortifications, ownerId, isCapital: true, enclosure: aiEnclosure(cap.difficulty) };
  }
  if (ownerId === "neutral") return { garrison: grow({ spearman: 2 }), fortifications: [], ownerId, isCapital: false };
  const diff = factionById[ownerId]?.difficulty ?? 1;
  const p = balance.conquest.patrolPerDifficulty;
  return { garrison: grow({ spearman: p * diff, archer: Math.ceil((p * diff) / 2) }), fortifications: [], ownerId, isCapital: false };
}

/** Home defensive strength = standing army + your own fortifications. */
export function playerDefensePower(state: GameState): number {
  let p = 0;
  for (const [id, c] of Object.entries(state.troops)) {
    const t = troopById[id]; if (t) p += c * (t.defense + t.attack) * 0.5;
  }
  for (const b of state.buildings) {
    const def = buildingById[b.id].defense;
    if (def?.health) p += (def.health * b.level) / 40;
  }
  return p;
}

function roll(state: GameState): number { const r = nextRandom(state.rngState); state.rngState = r.state; return r.value; }

/** How well your castle walls SEAL your keep, 0..1. A keep ringed by walls (or tucked in a
 *  grid corner) counts its wall HP in full; a keep with gaps to the outside — or no keep at
 *  all — leaves the walls mostly wasted. Pure & deterministic; the siege resolver reads it. */
// Grid directions, indexed by an edge piece's `rot`: 0:+x 1:+y 2:-x 3:-y.
const WALL_DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
/** Canonical key for the edge between a cell and its neighbour (order-independent). */
function edgeKey(x: number, y: number, dx: number, dy: number): string {
  const x2 = x + dx, y2 = y + dy;
  return (x < x2 || (x === x2 && y < y2)) ? `${x},${y}|${x2},${y2}` : `${x2},${y2}|${x},${y}`;
}

export function castleEnclosure(buildings: BuildingInstance[]): number {
  const { cols, rows } = balance.castleGrid;
  const fp = (id: string) => buildingById[id]?.footprint ?? 1;
  const blocked = new Set<string>();   // wall EDGES (a wall sits on one tile edge)
  const solid = new Set<string>();     // cells filled by a structure (tower/gate/keep/moat)
  const keepCells = new Set<string>();
  for (const b of buildings) {
    if (buildingById[b.id]?.category !== "fortification" || b.gx === undefined || b.gy === undefined) continue;
    if (b.id === "wall") {
      const [dx, dy] = WALL_DIRS[(((b.rot ?? 0) % 4) + 4) % 4];
      blocked.add(edgeKey(b.gx, b.gy, dx, dy));   // a wall blocks its one rotated edge
    } else if (b.id === "wall_corner") {
      const r = (((b.rot ?? 0) % 4) + 4) % 4;       // a corner blocks the two edges r and r+1
      for (const [dx, dy] of [WALL_DIRS[r], WALL_DIRS[(r + 1) % 4]]) blocked.add(edgeKey(b.gx, b.gy, dx, dy));
    } else {
      const n = fp(b.id);
      for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) {
        const k = `${b.gx + dx},${b.gy + dy}`;
        solid.add(k);
        if (b.id === "keep") keepCells.add(k);
      }
    }
  }
  if (keepCells.size === 0) return (blocked.size + solid.size) > 0 ? 0.4 : 0;   // no stronghold core
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows;
  // flood the "outside" inward from the border; can't enter solid cells or cross wall edges
  const outside = new Set<string>();
  const stack: [number, number][] = [];
  const enter = (x: number, y: number, fx: number, fy: number) => {
    if (!inb(x, y)) return;
    const k = `${x},${y}`;
    if (outside.has(k) || solid.has(k)) return;
    if ((fx !== x || fy !== y) && blocked.has(edgeKey(fx, fy, x - fx, y - fy))) return;  // wall on this edge
    outside.add(k); stack.push([x, y]);
  };
  for (let x = 0; x < cols; x++) { enter(x, 0, x, 0); enter(x, rows - 1, x, rows - 1); }
  for (let y = 0; y < rows; y++) { enter(0, y, 0, y); enter(cols - 1, y, cols - 1, y); }
  while (stack.length) {
    const [x, y] = stack.pop()!;
    for (const [dx, dy] of WALL_DIRS) enter(x + dx, y + dy, x, y);
  }
  // sealed fraction of the keep's perimeter (wall edge, adjacent structure, or walled-off interior)
  let total = 0, sealed = 0;
  for (const kc of keepCells) {
    const [x, y] = kc.split(",").map(Number);
    for (const [dx, dy] of WALL_DIRS) {
      const nx = x + dx, ny = y + dy, nk = `${nx},${ny}`;
      if (keepCells.has(nk)) continue;
      total++;
      if (!inb(nx, ny)) continue;   // open at the grid edge → not sealed
      if (solid.has(nk) || blocked.has(edgeKey(x, y, dx, dy)) || !outside.has(nk)) sealed++;
    }
  }
  return 0.4 + 0.6 * (total > 0 ? sealed / total : 1);   // keep alone = 0.4, fully ringed = 1.0
}

/** The player's home defence as a SiegeDefender: standing army + fortifications + enclosure. */
function playerAsDefender(state: GameState): SiegeDefender {
  const garrison: Record<string, number> = {};
  for (const [id, c] of Object.entries(state.troops)) if (c > 0) garrison[id] = c;
  const fortifications = state.buildings
    .filter((b) => buildingById[b.id].category === "fortification")
    .map((b) => ({ building: b.id, level: b.level }));
  return { garrison, fortifications, enclosure: castleEnclosure(state.buildings) };
}

/** Turn a rival's abstract strength into a concrete attacking army (incl. siege engines
 *  so walled players can actually be threatened). */
function aiArmy(strength: number, diff: number): Record<string, number> {
  const n = Math.max(4, Math.round(strength));
  const army: Record<string, number> = {
    spearman: Math.round(n * 0.4), archer: Math.round(n * 0.3),
    swordsman: Math.round(n * 0.2), horseman: Math.round(n * 0.1),
  };
  if (diff >= 2) army.catapult = Math.max(1, Math.round(n * 0.06));
  return army;
}

/** AI factions act on an interval: seize an undefended player border tile, else grow into
 *  neutral land. The player's capital can never be taken (no total wipeout). */
export function aiTurn(state: GameState): void {
  if (state.tick - state.lastAiTurn < balance.conquest.aiTurnTicks) return;
  state.lastAiTurn = state.tick;
  const playerCap = key(world.player.tile.x, world.player.tile.y);

  const pressure = 1 + Math.min(0.5, playerStrengthIndex(state) * 0.002);
  const mods = computeModifiers(state);
  // Safe heartland: while the player holds only a small realm, rivals expand into the
  // wilds and skirmish each other but won't strip your core (Appendix B — no wipeouts,
  // fairness floor). Your frontier becomes contestable only once you've grown past it.
  const playerProtected = ownedCount(state.tileOwner, "player") <= balance.conquest.protectedTiles;
  // Bucket owned tiles by faction in ONE pass (O(tiles)) instead of filtering all tiles per
  // faction (O(factions×tiles)) — essential on the big 50-rival map. Order preserved
  // (landTiles order) so the RNG sequence — and determinism — is unchanged.
  const ownedTiles: Record<string, { x: number; y: number }[]> = {};
  for (const t of landTiles()) {
    const o = state.tileOwner[key(t.x, t.y)];
    if (o && o !== "neutral") (ownedTiles[o] ??= []).push(t);
  }
  // Anti-runaway: no single rival may expand past this share of the map, and rival capitals
  // can never be taken by AI (only by the player) — so the world churns but never collapses
  // into one mega-faction. Keeps the game player-focused.
  const aiTileCap = Math.max(8, totalLand() * balance.conquest.maxAiTilePct);
  const capitals = new Set(factions.map((f) => key(f.capital.x, f.capital.y)));
  const tileCount = (id: string) => ownedTiles[id]?.length ?? 0;
  for (const f of factions) {
    if (f.isPlayer) continue;
    if (state.tileOwner[key(f.capital.x, f.capital.y)] !== f.id) continue; // defeated
    const info = archetypeInfoFor(f.id);
    // light AI economy: strength snowballs over time per archetype × difficulty
    const grown = (state.factionStrength[f.id] ?? f.difficulty * 8) + ARCHETYPE[archetypeFor(f.id)].economy * f.difficulty * 0.6;
    state.factionStrength[f.id] = Math.min(220, grown);
    const mine = ownedTiles[f.id] ?? [];
    if (mine.length === 0) continue;

    // candidate border tiles: player (never the capital), neutral, and rival-held
    const playerBorder: { x: number; y: number }[] = [];
    const neutralBorder: { x: number; y: number }[] = [];
    const rivalBorder: { x: number; y: number; owner: string }[] = [];
    for (const t of mine) for (const n of neighbors(t.x, t.y)) {
      const nk = key(n.x, n.y);
      const o = state.tileOwner[nk];
      if (o === "player" && nk !== playerCap) playerBorder.push(n);
      else if (o === "neutral") neutralBorder.push(n);
      else if (o && o !== f.id && o !== "player") rivalBorder.push({ ...n, owner: o });
    }

    if (!playerProtected && playerBorder.length > 0 && roll(state) < info.willing) {
      const tgt = playerBorder[Math.floor(roll(state) * playerBorder.length)];
      // real two-way siege: rival army vs the player's actual home defence
      const army = aiArmy(state.factionStrength[f.id] * info.attackMult * pressure, f.difficulty);
      // AI attacker has no research bonuses; the player defender keeps theirs (mods).
      const outcome = resolveSiege(army, playerAsDefender(state), emptyModifiers(), state.rngState, mods);
      state.rngState = outcome.rngState;
      // apply the player's real losses
      for (const [id, c] of Object.entries(outcome.defenderLosses)) state.troops[id] = Math.max(0, (state.troops[id] ?? 0) - c);
      const held = !outcome.victory;
      if (!held) state.tileOwner[key(tgt.x, tgt.y)] = f.id;
      const report: SiegeReport = {
        id: `r${state.nextId++}`, kind: "defense", tick: state.tick, targetName: `${f.name} (${info.label})`,
        victory: held, breached: outcome.breached,
        attackerLosses: outcome.defenderLosses, defenderLosses: outcome.attackerLosses,
        loot: {}, lines: [`${f.name} (${info.label}) assaults your border at (${tgt.x},${tgt.y}).`, ...outcome.lines],
      };
      state.reports.unshift(report);
      if (state.reports.length > 30) state.reports.length = 30;
      state.log.unshift({ tick: state.tick, text: held ? `You repelled ${f.name} at (${tgt.x},${tgt.y}).` : `${f.name} seized your land at (${tgt.x},${tgt.y})!`, kind: held ? "good" : "bad" });
      if (state.log.length > 60) state.log.length = 60;
      if (!held) continue;
    }
    // Rivals at/over the cap stop expanding — they can still be attacked, never snowball.
    if (tileCount(f.id) >= aiTileCap) continue;

    // AI-vs-AI: skirmish a rival's border tile, preferring an over-cap (dominant) neighbour
    // so the biggest faction gets pecked back down. Capitals can fall (harder) — the loser
    // is eliminated and its land reverts to neutral, freeing it for re-conquest / a respawn.
    if (rivalBorder.length > 0) {
      const overCap = rivalBorder.filter((r) => tileCount(r.owner) >= aiTileCap);
      const pool = overCap.length > 0 ? overCap : rivalBorder;
      const tgt = pool[Math.floor(roll(state) * pool.length)];
      const nk = key(tgt.x, tgt.y);
      const isCapital = capitals.has(nk);
      const atk = (state.factionStrength[f.id] ?? 8) * (0.8 + roll(state) * 0.5);
      const def = (state.factionStrength[tgt.owner] ?? 8) * balance.conquest.aiVsAiMargin * (isCapital ? 2 : 1);
      if (atk > def) {
        if (isCapital) {
          const fallen = tgt.owner;
          for (const t of (ownedTiles[fallen] ?? [])) state.tileOwner[key(t.x, t.y)] = "neutral";
          ownedTiles[fallen] = [];
          state.tileOwner[nk] = f.id;
          state.log.unshift({ tick: state.tick, text: `${factionById[fallen]?.name ?? "A rival"} has fallen to ${f.name}.`, kind: "war" });
          if (state.log.length > 60) state.log.length = 60;
        } else {
          state.tileOwner[nk] = f.id;
          ownedTiles[tgt.owner] = (ownedTiles[tgt.owner] ?? []).filter((t) => !(t.x === tgt.x && t.y === tgt.y));
        }
      }
    }

    // expand into neutral land (economic rivals grab more per turn)
    for (let e = 0; e < info.expand && neutralBorder.length > 0; e++) {
      const idx = Math.floor(roll(state) * neutralBorder.length);
      const g = neutralBorder.splice(idx, 1)[0];
      state.tileOwner[key(g.x, g.y)] = f.id;
    }
  }
}

/** A dormant rival rises onto the map on an interval, keeping the world escalating (Wave 3).
 *  Dormant = a faction not holding its capital (never-activated or previously eliminated) whose
 *  capital tile is currently free. Awakens the lowest-difficulty available one — so rivals
 *  appear in rising difficulty — with strength scaled to the player's progress so late
 *  arrivals are real threats. Deterministic (no RNG). */
export function maybeSpawnRival(state: GameState): void {
  if (state.tick - state.lastSpawnTick < balance.conquest.spawnIntervalTicks) return;
  state.lastSpawnTick = state.tick;
  const dormant = factions.filter((f) => !f.isPlayer
    && state.tileOwner[key(f.capital.x, f.capital.y)] === "neutral")
    .sort((a, b) => a.difficulty - b.difficulty || (a.id < b.id ? -1 : 1));
  const f = dormant[0];
  if (!f) return;
  state.tileOwner[key(f.capital.x, f.capital.y)] = f.id;
  for (const n of neighbors(f.capital.x, f.capital.y))
    if (state.tileOwner[key(n.x, n.y)] === "neutral") state.tileOwner[key(n.x, n.y)] = f.id;
  const scaled = Math.min(220, f.difficulty * 8 + playerStrengthIndex(state) * 0.5);
  state.factionStrength[f.id] = Math.max(state.factionStrength[f.id] ?? 0, scaled);
  state.log.unshift({ tick: state.tick, text: `A new power rises in the realm: ${f.name}.`, kind: "war" });
  if (state.log.length > 60) state.log.length = 60;
}

// ---- Fog of war (Phase 2) ----
// Passive "explored" comes from proximity to your land; active "scouted/surveilled"
// comes from scouting expeditions (stored in state.intel). Effective = max of the two.
export function visionRange(state: GameState): number {
  return 2 + (state.research["cartography"] ?? 0) + (state.research["scouting"] ?? 0);
}

/** How far (tiles from your nearest holding) your scouts can reach. Grows with the Scouting
 *  Parties research, with a bonus from Cartography — distant lands need investment to survey. */
export function scoutRange(state: GameState): number {
  return balance.scouting.rangeBase
    + (state.research["scouting"] ?? 0) * balance.scouting.rangePerRank
    + (state.research["cartography"] ?? 0) * 3;
}

export function buildExplored(state: GameState): Set<string> {
  const r = visionRange(state);
  const seen = new Set<string>();
  for (const t of landTiles()) {
    if (state.tileOwner[key(t.x, t.y)] !== "player") continue;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = t.x + dx, ny = t.y + dy;
      if (isLand(nx, ny)) seen.add(key(nx, ny));
    }
  }
  return seen;
}

/** 0 unknown · 1 explored · 2 scouted · 3 surveilled. Scouted intel goes STALE: it drops a
 *  level every `staleTicks`, so distant lands fog back over unless you re-scout. Passive
 *  "explored" (near your own land) never decays. */
export function tileVisibility(state: GameState, explored: Set<string>, x: number, y: number): number {
  const k = key(x, y);
  let intel = state.intel[k] ?? 0;
  if (intel > 0) {
    const age = state.tick - (state.intelAt?.[k] ?? state.tick);
    intel = Math.max(0, intel - Math.floor(age / balance.scouting.staleTicks));
  }
  return Math.max(intel, explored.has(k) ? 1 : 0);
}

export function tileLoot(state: GameState, ownerId: string): ResourceMap {
  const diff = factionById[ownerId]?.difficulty ?? 1;
  const out: ResourceMap = {};
  for (const r of RESOURCE_IDS) {
    const base = balance.conquest.tileLootPerDifficulty[r];
    if (base) out[r] = Math.round(base * diff * (0.6 + roll(state) * 0.6));
  }
  return out;
}
