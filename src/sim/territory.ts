// Territory, rank progression, the Crown, and the AI factions' turns.
// Deterministic and pure-ish: aiTurn mutates the passed state (called from the tick).
import { world, factions, factionById, aiById, balance, troopById, buildingById } from "./content";
import { nextRandom } from "./rng";
import { archetypeInfoFor, archetypeFor, ARCHETYPE, playerStrengthIndex } from "./rivals";
import { resolveSiege } from "./siege";
import { computeModifiers, emptyModifiers } from "./effects";
import type { SiegeReport } from "./types";
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
  for (const f of factions) {
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

export interface TileDefender { garrison: Record<string, number>; fortifications: { building: string; level: number }[]; ownerId: string; isCapital: boolean; }

export function defenderForTile(tileOwner: Record<string, string>, x: number, y: number): TileDefender {
  const ownerId = tileOwner[key(x, y)] ?? "neutral";
  // The world levels up with you: garrisons swell as your realm grows (a slowdown lever).
  const scale = 1 + ownedCount(tileOwner, "player") * balance.conquest.defenderScalePerTile;
  const grow = (g: Record<string, number>) => Object.fromEntries(Object.entries(g).map(([t, c]) => [t, Math.max(1, Math.round(c * scale))]));
  const cap = factions.find((f) => f.capital.x === x && f.capital.y === y && !f.isPlayer);
  if (cap && ownerId === cap.id) {
    const v = aiById[cap.id];
    return { garrison: grow(Object.fromEntries(v.garrison.map((g) => [g.troop, g.count]))), fortifications: v.fortifications, ownerId, isCapital: true };
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

/** The player's home defence as a SiegeDefender: standing army + fortifications. */
function playerAsDefender(state: GameState): { garrison: Record<string, number>; fortifications: { building: string; level: number }[] } {
  const garrison: Record<string, number> = {};
  for (const [id, c] of Object.entries(state.troops)) if (c > 0) garrison[id] = c;
  const fortifications = state.buildings
    .filter((b) => buildingById[b.id].category === "fortification")
    .map((b) => ({ building: b.id, level: b.level }));
  return { garrison, fortifications };
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
  for (const f of factions) {
    if (f.isPlayer) continue;
    if (state.tileOwner[key(f.capital.x, f.capital.y)] !== f.id) continue; // defeated
    const info = archetypeInfoFor(f.id);
    // light AI economy: strength snowballs over time per archetype × difficulty
    const grown = (state.factionStrength[f.id] ?? f.difficulty * 8) + ARCHETYPE[archetypeFor(f.id)].economy * f.difficulty * 0.6;
    state.factionStrength[f.id] = Math.min(220, grown);
    const mine = ownedTiles[f.id] ?? [];
    if (mine.length === 0) continue;

    // candidate player tiles bordering this faction (never the capital)
    const playerBorder: { x: number; y: number }[] = [];
    const neutralBorder: { x: number; y: number }[] = [];
    for (const t of mine) for (const n of neighbors(t.x, t.y)) {
      const o = state.tileOwner[key(n.x, n.y)];
      if (o === "player" && key(n.x, n.y) !== playerCap) playerBorder.push(n);
      else if (o === "neutral") neutralBorder.push(n);
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
    // expand into neutral land (economic rivals grab more per turn)
    for (let e = 0; e < info.expand && neutralBorder.length > 0; e++) {
      const idx = Math.floor(roll(state) * neutralBorder.length);
      const g = neutralBorder.splice(idx, 1)[0];
      state.tileOwner[key(g.x, g.y)] = f.id;
    }
  }
}

// ---- Fog of war (Phase 2) ----
// Passive "explored" comes from proximity to your land; active "scouted/surveilled"
// comes from scouting expeditions (stored in state.intel). Effective = max of the two.
export function visionRange(state: GameState): number {
  return 2 + (state.research["cartography"] ?? 0) + (state.research["scouting"] ?? 0);
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

/** 0 unknown · 1 explored · 2 scouted · 3 surveilled */
export function tileVisibility(state: GameState, explored: Set<string>, x: number, y: number): number {
  return Math.max(state.intel[key(x, y)] ?? 0, explored.has(key(x, y)) ? 1 : 0);
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
