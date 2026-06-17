// Balance harness (docs/05 Appendix Q). Headless long-runs of the deterministic sim that
// (a) assert invariants so the long game can't silently break, and (b) print curves to
// eyeball pacing. Pure sim — no UI, no network. Run with `npm test`.
import { describe, expect, it } from "vitest";
import { advance, applyCommand, createInitialState, buildCost, netProduction, happiness } from "./sim";
import { computeModifiers, isBuildingUnlocked } from "./effects";
import { realmInfo, ownedCount, key } from "./territory";
import { buildings as buildingDefs } from "./content";
import { world } from "./content";
import type { GameState } from "./types";
import { RESOURCE_IDS } from "./types";

const DAY = 1440;          // ticks per game-day (tickLengthSec 60)

function finite(s: GameState): boolean {
  if (!Number.isFinite(s.population)) return false;
  for (const r of RESOURCE_IDS) if (!Number.isFinite(s.resources[r])) return false;
  for (const v of Object.values(s.factionStrength)) if (!Number.isFinite(v)) return false;
  return true;
}

function summary(label: string, s: GameState) {
  const m = computeModifiers(s);
  const info = realmInfo(s);
  const res = RESOURCE_IDS.map((r) => `${r}:${Math.round(s.resources[r])}`).join(" ");
  // eslint-disable-next-line no-console
  console.log(`[${label}] day ${Math.round(s.tick / DAY)} | pop ${Math.floor(s.population)} | tiles ${info.tiles} (${info.rank}) | king ${info.kingName} | happy ${happiness(s, m)} | ${res} | net gold ${netProduction(s, m).gold}`);
}

describe("balance harness — long-run invariants", () => {
  it("idle realm stays sane for two weeks (no NaN, capital survives, bounded)", () => {
    let s = createInitialState(101);
    const cap = key(world.player.tile.x, world.player.tile.y);
    for (let d = 0; d < 14; d++) { s = advance(s, DAY); expect(finite(s)).toBe(true); }
    summary("idle", s);
    expect(s.tileOwner[cap]).toBe("player");          // capital never lost
    expect(s.population).toBeGreaterThanOrEqual(0);
    // protected heartland: an idle player keeps their starting region intact
    expect(ownedCount(s.tileOwner, "player")).toBeGreaterThanOrEqual(4);
  });

  it("an auto-economy player grows steadily over two weeks", () => {
    let s = createInitialState(202);
    s = applyCommand(s, { type: "setTax", rate: 0.2 }).state;
    const startPop = s.population;
    const startBuildings = s.buildings.length;

    // crude policy: each game-day, queue the cheapest affordable unlocked economy/housing
    // building, and upgrade the Town Hall when we can afford it.
    for (let d = 0; d < 14; d++) {
      const mods = computeModifiers(s);
      const th = s.buildings.find((b) => b.id === "town_hall");
      if (th) {
        const upCost = buildCost(buildingDefs.find((x) => x.id === "town_hall")!, th.level + 1);
        if (RESOURCE_IDS.every((r) => (upCost[r] ?? 0) <= s.resources[r]))
          s = applyCommand(s, { type: "build", building: "town_hall", instanceIndex: s.buildings.indexOf(th) }).state;
      }
      const candidates = buildingDefs.filter((def) =>
        ["production", "housing", "storage", "civic"].includes(def.category) &&
        isBuildingUnlocked(def.id, mods) &&
        (def.requires?.buildings ?? []).every((b) => s.buildings.some((x) => x.id === b)));
      let best: { id: string; cost: number } | null = null;
      for (const def of candidates) {
        const c = buildCost(def, 1);
        if (!RESOURCE_IDS.every((r) => (c[r] ?? 0) <= s.resources[r])) continue;
        const total = (Object.values(c) as number[]).reduce((a, b) => a + b, 0);
        if (!best || total < best.cost) best = { id: def.id, cost: total };
      }
      if (best) s = applyCommand(s, { type: "build", building: best.id, instanceIndex: null }).state;
      s = advance(s, DAY);
      expect(finite(s)).toBe(true);
    }
    summary("auto", s);
    expect(s.population).toBeGreaterThan(startPop);          // the realm grew
    expect(s.buildings.length).toBeGreaterThan(startBuildings);
    expect(s.resources.food).toBeGreaterThan(0);             // didn't starve under a sane policy
  });
});
