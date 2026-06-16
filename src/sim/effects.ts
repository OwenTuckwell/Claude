// Aggregates research (and, later, card/boost) effects into a Modifiers object the sim
// reads. Research and the [Later] boost system share this typed-effect vocabulary, so
// boosts will plug in here with no new sim plumbing (docs/03 §4).
import { research as researchDefs, researchById } from "./content";
import type { GameState } from "./types";

export interface Modifiers {
  productionPct: Record<string, number>;   // buildingId -> additive fraction
  storageCapPct: Record<string, number>;   // resourceId -> additive fraction
  taxYieldPct: number;
  buildTimePct: number;                     // negative = faster
  happinessFlat: number;
  defenseHealthPct: number;                 // fortification HP bonus
  marchSpeedPct: number;
  scoutYieldPct: number;
  troopStatPct: Record<string, { attack: number; defense: number; health: number }>;
  unlockedBuildings: Set<string>;
  unlockedTroops: Set<string>;
}

function emptyTroopStat() {
  return { attack: 0, defense: 0, health: 0 };
}

export function computeModifiers(state: GameState): Modifiers {
  const m: Modifiers = {
    productionPct: {}, storageCapPct: {}, taxYieldPct: 0, buildTimePct: 0,
    happinessFlat: 0, defenseHealthPct: 0, marchSpeedPct: 0, scoutYieldPct: 0, troopStatPct: {},
    unlockedBuildings: new Set(), unlockedTroops: new Set(),
  };

  for (const def of researchDefs) {
    const rank = state.research[def.id] ?? 0;
    if (rank <= 0 && !def.effects.some((e) => e.type.startsWith("unlock"))) continue;
    for (const e of def.effects) {
      const perRank = (e.valuePerRank ?? 0) * rank;
      switch (e.type) {
        case "production_pct":
          m.productionPct[e.target] = (m.productionPct[e.target] ?? 0) + perRank; break;
        case "storage_cap_pct":
          m.storageCapPct[e.target] = (m.storageCapPct[e.target] ?? 0) + perRank; break;
        case "tax_yield_pct": m.taxYieldPct += perRank; break;
        case "build_time_pct": m.buildTimePct += perRank; break;
        case "happiness_flat": m.happinessFlat += perRank; break;
        case "defense_health_pct": m.defenseHealthPct += perRank; break;
        case "march_speed_pct": m.marchSpeedPct += perRank; break;
        case "scout_yield_pct": m.scoutYieldPct += perRank; break;
        case "troop_stat_pct": {
          const s = (m.troopStatPct[e.target] ??= emptyTroopStat());
          if (e.stat === "attack") s.attack += perRank;
          else if (e.stat === "defense") s.defense += perRank;
          else if (e.stat === "health") s.health += perRank;
          break;
        }
        case "unlock_building":
          if (rank >= (e.atRank ?? 1)) m.unlockedBuildings.add(e.target); break;
        case "unlock_troop":
          if (rank >= (e.atRank ?? 1)) m.unlockedTroops.add(e.target); break;
      }
    }
  }
  return m;
}

/** Whether a building id is buildable given research unlocks (buildings with no
 *  unlock effect anywhere are unlocked by default). */
export function isBuildingUnlocked(id: string, mods: Modifiers): boolean {
  const gated = researchDefs.some((r) =>
    r.effects.some((e) => e.type === "unlock_building" && e.target === id));
  return !gated || mods.unlockedBuildings.has(id);
}

export function isTroopUnlocked(id: string, mods: Modifiers): boolean {
  const gated = researchDefs.some((r) =>
    r.effects.some((e) => e.type === "unlock_troop" && e.target === id));
  return !gated || mods.unlockedTroops.has(id);
}

export function rpCostFor(researchId: string, currentRank: number): number {
  const def = researchById[researchId];
  return Math.round(def.rpCostBase * Math.pow(def.rpCostGrowth, currentRank));
}
