// Loads and indexes the data-driven content. The JSON files are the portable assets
// that survive the eventual Unity port (docs/03-technical-architecture.md §1).
import buildingsJson from "../../content/buildings.json";
import researchJson from "../../content/research.json";
import troopsJson from "../../content/troops.json";
import worldJson from "../../content/world.json";
import balanceJson from "../../config/balance.json";
import type {
  Balance, BuildingDef, ResearchDef, TroopDef, WorldDef,
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
