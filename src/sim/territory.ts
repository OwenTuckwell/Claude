// Territory, rank progression, the Crown, and the AI factions' turns.
// Deterministic and pure-ish: aiTurn mutates the passed state (called from the tick).
import { world, factions, factionById, aiById, balance, troopById, buildingById } from "./content";
import { nextRandom } from "./rng";
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
  const cap = factions.find((f) => f.capital.x === x && f.capital.y === y && !f.isPlayer);
  if (cap && ownerId === cap.id) {
    const v = aiById[cap.id];
    return { garrison: Object.fromEntries(v.garrison.map((g) => [g.troop, g.count])), fortifications: v.fortifications, ownerId, isCapital: true };
  }
  if (ownerId === "neutral") return { garrison: { spearman: 2 }, fortifications: [], ownerId, isCapital: false };
  const diff = factionById[ownerId]?.difficulty ?? 1;
  const p = balance.conquest.patrolPerDifficulty;
  return { garrison: { spearman: p * diff, archer: Math.ceil((p * diff) / 2) }, fortifications: [], ownerId, isCapital: false };
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

function factionAttackPower(tileOwner: Record<string, string>, id: string): number {
  const diff = factionById[id]?.difficulty ?? 1;
  return 6 + ownedCount(tileOwner, id) * 1.5 + diff * 6;
}

function roll(state: GameState): number { const r = nextRandom(state.rngState); state.rngState = r.state; return r.value; }

/** AI factions act on an interval: seize an undefended player border tile, else grow into
 *  neutral land. The player's capital can never be taken (no total wipeout). */
export function aiTurn(state: GameState): void {
  if (state.tick - state.lastAiTurn < balance.conquest.aiTurnTicks) return;
  state.lastAiTurn = state.tick;
  const playerCap = key(world.player.tile.x, world.player.tile.y);

  for (const f of factions) {
    if (f.isPlayer) continue;
    if (state.tileOwner[key(f.capital.x, f.capital.y)] !== f.id) continue; // defeated
    const mine = landTiles().filter((t) => state.tileOwner[key(t.x, t.y)] === f.id);
    if (mine.length === 0) continue;

    // candidate player tiles bordering this faction (never the capital)
    const playerBorder: { x: number; y: number }[] = [];
    const neutralBorder: { x: number; y: number }[] = [];
    for (const t of mine) for (const n of neighbors(t.x, t.y)) {
      const o = state.tileOwner[key(n.x, n.y)];
      if (o === "player" && key(n.x, n.y) !== playerCap) playerBorder.push(n);
      else if (o === "neutral") neutralBorder.push(n);
    }

    if (playerBorder.length > 0) {
      const tgt = playerBorder[Math.floor(roll(state) * playerBorder.length)];
      const atk = factionAttackPower(state.tileOwner, f.id) * (0.8 + roll(state) * 0.5);
      if (atk > playerDefensePower(state)) {
        state.tileOwner[key(tgt.x, tgt.y)] = f.id;
        for (const id of Object.keys(state.troops)) state.troops[id] = Math.floor(state.troops[id] * 0.92);
        state.log.unshift({ tick: state.tick, text: `${f.name} seized your land at (${tgt.x},${tgt.y})! Defend your borders.`, kind: "bad" });
        if (state.log.length > 60) state.log.length = 60;
        continue;
      }
    }
    if (neutralBorder.length > 0) {
      const g = neutralBorder[Math.floor(roll(state) * neutralBorder.length)];
      state.tileOwner[key(g.x, g.y)] = f.id;
    }
  }
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
