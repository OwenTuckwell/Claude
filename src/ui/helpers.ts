import type { Command, GameState, ResourceMap } from "../sim/types";
import { RESOURCE_IDS } from "../sim/types";
import { RESOURCE_META } from "./format";

export type Dispatch = (cmd: Command) => void;

export interface TabProps {
  state: GameState;
  mods: import("../sim/effects").Modifiers;
  dispatch: Dispatch;
}

export function canAfford(state: GameState, cost: ResourceMap): boolean {
  for (const r of RESOURCE_IDS) if (cost[r] && state.resources[r] < cost[r]!) return false;
  return true;
}

export function costString(cost: ResourceMap): string {
  return RESOURCE_IDS.filter((r) => cost[r]).map((r) => `${RESOURCE_META[r].icon}${cost[r]}`).join("  ") || "free";
}
