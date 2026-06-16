// Loads and indexes the data-driven content. The JSON files are the portable assets
// that survive the eventual Unity port (docs/03-technical-architecture.md §1).
import buildingsJson from "../../content/buildings.json";
import researchJson from "../../content/research.json";
import troopsJson from "../../content/troops.json";
import worldJson from "../../content/world.json";
import balanceJson from "../../config/balance.json";
import type {
  Balance, BuildingDef, Faction, ResearchDef, TroopDef, WorldDef,
} from "./types";

export const buildings: BuildingDef[] = (buildingsJson as unknown as { buildings: BuildingDef[] }).buildings;
export const research: ResearchDef[] = (researchJson as unknown as { research: ResearchDef[] }).research;
export const troops: TroopDef[] = (troopsJson as unknown as { troops: TroopDef[] }).troops;
export const world: WorldDef = worldJson as unknown as WorldDef;
export const balance: Balance = balanceJson as unknown as Balance;

export const buildingById: Record<string, BuildingDef> = Object.fromEntries(
  buildings.map((b) => [b.id, b]),
);
export const researchById: Record<string, ResearchDef> = Object.fromEntries(
  research.map((r) => [r.id, r]),
);
export const troopById: Record<string, TroopDef> = Object.fromEntries(
  troops.map((t) => [t.id, t]),
);
export const aiById = Object.fromEntries(world.aiVillages.map((v) => [v.id, v]));

// Factions = the player plus each AI keep (treated as that faction's capital).
const FACTION_PALETTE = ["#c2554f", "#7a9b46", "#9b6bbf", "#c98a3a", "#3f9b96", "#b04f86"];
export const factions: Faction[] = [
  { id: "player", name: "Your Realm", color: "#4a86d8", isPlayer: true, capital: world.player.tile, difficulty: 0 },
  ...world.aiVillages.map((v, i) => ({
    id: v.id, name: v.name, color: FACTION_PALETTE[i % FACTION_PALETTE.length],
    capital: v.tile, difficulty: v.difficulty,
  })),
];
export const factionById: Record<string, Faction> = Object.fromEntries(factions.map((f) => [f.id, f]));
