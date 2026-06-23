// Engine-agnostic simulation types for Bannerfall.
// NOTE: this folder must never import React or any presentation code — it is the
// portable, deterministic game core (see docs/03-technical-architecture.md).

export type ResourceId = "food" | "wood" | "stone" | "iron" | "gold" | "rp" | "token" | "renown";
export const RESOURCE_IDS: ResourceId[] = ["food", "wood", "stone", "iron", "gold", "rp", "token", "renown"];

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
  researchBonus?: number;   // +fraction to RP earned per building level (civic buildings)
  defense?: { health?: number; garrisonSlots?: number };
  tier?: number;        // Town Hall level required to construct (default 1); Appendix S/T
  footprint?: number;   // square side length in grid tiles (default 1 → 1×1; 2 → 2×2; 3 → 3×3)
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
    | "scout_vision_flat" | "scout_yield_pct" | "unlock_building" | "unlock_troop"
    | "idle_income_pct";
  target: string;       // resource id, building id, troop id, "global", or category
  stat?: string;        // for troop_stat_pct: "attack" | "defense" | "health"
  valuePerRank?: number;
  atRank?: number;      // for unlocks
}

export interface ResearchDef {
  id: string;
  name: string;
  branch: "economy" | "military" | "construction" | "logistics" | "statecraft" | "castellany";
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
  productionScale: number;        // global multiplier on all building output (slow-game knob)
  researchPerLevel: number;       // RP awarded per building level gained (research = development)
  villageGrid: { cols: number; rows: number };
  castleGrid: { cols: number; rows: number };
  market: {
    tokensPerTap: number;
    buyPriceTokens: Partial<Record<ResourceId, number>>;   // tokens to buy 1 unit
    sellPriceTokens: Partial<Record<ResourceId, number>>;  // tokens gained per 1 unit sold
  };
  scouting: {
    baseTravelTicks: number;      // expedition round-trip-ish duration
    travelTicksPerRankReduction: number;
    sendCost: ResourceMap;        // cost to send a scouting party
    baseLoot: ResourceMap;        // expected loot at rank 1 (randomised ±)
    lootPctPerRank: number;       // extra loot fraction per scouting rank
  };
  conquest: {
    aiTurnTicks: number;          // how often AI factions act
    kingThresholdPct: number;     // land share needed to hold the Crown
    tileTravelPerTile: number;    // march ticks per tile distance (from your border)
    patrolPerDifficulty: number;  // garrison size scaler for non-capital tiles
    tileLootPerDifficulty: ResourceMap; // loot when taking a normal tile
    defenderScalePerTile: number; // tile garrisons grow as your realm grows (slowdown)
    tileUpkeepGold: number;       // gold/tick per owned tile beyond the free allowance
    freeTiles: number;            // tiles before upkeep & sprawl penalties bite
    sprawlHappinessPer10: number; // happiness lost per 10 tiles beyond the allowance
    protectedTiles: number;       // AI won't seize your land while you hold <= this (safe heartland)
  };
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
  land: string[];
  player: { tile: { x: number; y: number } };
  aiVillages: AiVillageDef[];
}

export interface Faction {
  id: string;
  name: string;
  color: string;
  isPlayer?: boolean;
  capital: { x: number; y: number };
  difficulty: number;
}

// ---- Mutable game state (serializable; this is the save format) ----

export interface BuildingInstance { id: string; level: number; gx?: number; gy?: number; }

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
  kind: "assault" | "scout" | "conquer";
  targetId: string;          // ai village id, "wilds" (scout), or "tile:x,y" (conquer)
  targetName: string;
  army: Record<string, number>;
  phase: "outbound" | "returning";
  arriveTick: number;
  travelTicks: number;
  targetTile?: { x: number; y: number };
  loot?: ResourceMap;
  reportId?: string;
}

export interface SiegeReport {
  id: string;
  kind: "assault" | "scout" | "conquer" | "defense";
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
  tileOwner: Record<string, string>;   // "x,y" -> faction id (incl. "player", "neutral")
  intel: Record<string, number>;       // "x,y" -> recon level reached (2 scouted, 3 surveilled)
  factionStrength: Record<string, number>; // rival economic strength, grows over time
  reports: SiegeReport[];
  log: LogEntry[];
  nextId: number;
  lastAiTurn: number;
}

export type Command =
  | { type: "setRation"; level: RationLevel }
  | { type: "setTax"; rate: number }
  | { type: "build"; building: string; instanceIndex?: number | null }
  | { type: "cancelBuild"; queueIndex: number }
  | { type: "research"; research: string }
  | { type: "train"; troop: string; count: number }
  | { type: "attack"; targetId: string; army: Record<string, number> }
  | { type: "tap" }
  | { type: "buy"; resource: ResourceId; amount: number }
  | { type: "sell"; resource: ResourceId; amount: number }
  | { type: "scout" }
  | { type: "scoutTile"; x: number; y: number }
  | { type: "moveBuilding"; index: number; gx: number; gy: number }
  | { type: "conquer"; x: number; y: number; army: Record<string, number> };

export interface CommandResult { ok: boolean; error?: string; }
