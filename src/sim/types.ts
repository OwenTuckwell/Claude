// Engine-agnostic simulation types for Bannerfall.
// NOTE: this folder must never import React or any presentation code — it is the
// portable, deterministic game core (see docs/03-technical-architecture.md).

export type ResourceId = "food" | "wood" | "stone" | "iron" | "gold" | "rp";
export const RESOURCE_IDS: ResourceId[] = ["food", "wood", "stone", "iron", "gold", "rp"];

export type RationLevel = "half" | "normal" | "generous" | "double";
export type BuildingCategory =
  | "production" | "storage" | "housing" | "civic" | "military" | "fortification";

export type ResourceMap = Partial<Record<ResourceId, number>>;

// ---- Content (data-driven; loaded from /content + /config) ----

export interface BuildingDef {
  id: string;
  name: string;
  category: BuildingCategory;
  produces?: ResourceMap;
  consumes?: ResourceMap;
  labour?: number;
  storageBonus?: ResourceMap;
  housingBonus?: number;
  happiness?: number;
  defense?: { health?: number; garrisonSlots?: number };
  maxLevel: number;
  costBase: ResourceMap;
  costGrowth: number;
  timeBaseSec: number;
  timeGrowth: number;
  requires?: { buildings?: string[]; research?: { id: string; rank: number }[] };
}

export interface ResearchEffect {
  type:
    | "production_pct" | "storage_cap_pct" | "tax_yield_pct" | "build_time_pct"
    | "happiness_flat" | "troop_stat_pct" | "defense_health_pct" | "march_speed_pct"
    | "scout_vision_flat" | "unlock_building" | "unlock_troop";
  target: string;       // resource id, building id, troop id, "global", or category
  stat?: string;        // for troop_stat_pct: "attack" | "defense" | "health"
  valuePerRank?: number;
  atRank?: number;      // for unlocks
}

export interface ResearchDef {
  id: string;
  name: string;
  branch: "economy" | "military" | "construction" | "logistics" | "statecraft";
  maxRank: number;
  rpCostBase: number;
  rpCostGrowth: number;
  requires?: { research?: { id: string; rank: number }[]; buildingLevels?: Record<string, number> };
  effects: ResearchEffect[];
}

export interface TroopDef {
  id: string;
  name: string;
  role: "infantry" | "ranged" | "cavalry" | "siege";
  attack: number; defense: number; health: number;
  counters?: string[];
  bonusVsFortification?: number;
  rangedFromTower?: boolean;
  cost: ResourceMap;
  upkeep?: ResourceMap;
  trainTimeSec: number;
  requires?: { buildings?: Record<string, number>; research?: { id: string; rank: number }[] };
}

export interface Balance {
  tickLengthSec: number;
  maxCatchUpTicks: number;
  foodPerCapitaPerTick: number;
  baseTaxYieldPerCapita: number;
  rationTable: Record<RationLevel, number>;
  rationHappiness: Record<RationLevel, number>;
  taxHappiness: { rate: number; happiness: number }[];
  popGrowthPerHappyPointPerTick: number;
  popDeclinePerTick: number;
  starvationDeclinePerTick: number;
  crowdingPenaltyPerPctOver: number;
  skeletonStaffing: number;
  baseStorage: Record<ResourceId, number>;
  startingResources: Record<ResourceId, number>;
  startingPopulation: number;
  buildTimeReductionCap: number;
}

export interface AiVillageDef {
  id: string; name: string; tile: { x: number; y: number };
  difficulty: number;
  loot: ResourceMap;
  garrison: { troop: string; count: number }[];
  fortifications: { building: string; level: number }[];
  regrowTicks: number;
}

export interface WorldDef {
  gridSize: { w: number; h: number };
  player: { tile: { x: number; y: number } };
  aiVillages: AiVillageDef[];
}

// ---- Mutable game state (serializable; this is the save format) ----

export interface BuildingInstance { id: string; level: number; }

export interface BuildOrder {
  building: string;       // building def id
  instanceIndex: number | null;  // null = new building, else upgrade existing
  targetLevel: number;
  durationTicks: number;
  cost: ResourceMap;              // stored for refund on cancel
  startedTick: number | null;     // null until it reaches the front of the queue
}

export interface TrainOrder {
  troop: string; count: number; perUnitTicks: number;
  startedTick: number | null;
}

export interface March {
  id: string;
  targetId: string;
  army: Record<string, number>;
  phase: "outbound" | "returning";
  arriveTick: number;
  travelTicks: number;
  loot?: ResourceMap;
  reportId?: string;
}

export interface SiegeReport {
  id: string;
  tick: number;
  targetName: string;
  victory: boolean;
  breached: boolean;
  attackerLosses: Record<string, number>;
  defenderLosses: Record<string, number>;
  loot: ResourceMap;
  lines: string[];
}

export interface LogEntry { tick: number; text: string; kind: "info" | "good" | "bad" | "war"; }

export interface AiVillageState { lootedUntilTick: number; }

export interface GameState {
  schemaVersion: number;
  tick: number;
  rngState: number;
  resources: Record<ResourceId, number>;
  population: number;
  rationLevel: RationLevel;
  taxRate: number;
  buildings: BuildingInstance[];
  buildQueue: BuildOrder[];
  research: Record<string, number>;     // researchId -> rank achieved
  troops: Record<string, number>;       // home garrison
  trainQueue: TrainOrder[];
  marches: March[];
  aiState: Record<string, AiVillageState>;
  reports: SiegeReport[];
  log: LogEntry[];
  nextId: number;
}

export type Command =
  | { type: "setRation"; level: RationLevel }
  | { type: "setTax"; rate: number }
  | { type: "build"; building: string; instanceIndex?: number | null }
  | { type: "cancelBuild"; queueIndex: number }
  | { type: "research"; research: string }
  | { type: "train"; troop: string; count: number }
  | { type: "attack"; targetId: string; army: Record<string, number> };

export interface CommandResult { ok: boolean; error?: string; }
