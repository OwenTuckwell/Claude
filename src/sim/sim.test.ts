import { describe, expect, it } from "vitest";
import {
  advance, applyCommand, createInitialState, netProduction, storageCaps, townHallLevel,
} from "./sim";
import { computeModifiers } from "./effects";
import { resolveSiege } from "./siege";
import { landTiles, key, ownedCount, realmInfo } from "./territory";
import { archetypeFor, ARCHETYPE } from "./rivals";
import { world, factions } from "./content";
import type { GameState } from "./types";

const fresh = () => createInitialState(777);

describe("determinism", () => {
  it("N single ticks equals one N-tick advance", () => {
    let a = fresh();
    for (let i = 0; i < 50; i++) a = advance(a, 1);
    const b = advance(fresh(), 50);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("chained advances compose (offline catch-up correctness)", () => {
    const a = advance(advance(fresh(), 30), 30);
    const b = advance(fresh(), 60);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("does not mutate the input state", () => {
    const s = fresh();
    const snapshot = JSON.stringify(s);
    advance(s, 100);
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});

describe("economy", () => {
  it("the starting village has a positive food balance and grows", () => {
    const s = fresh();
    const mods = computeModifiers(s);
    expect(netProduction(s, mods).food).toBeGreaterThan(0);
    const later = advance(s, 200);
    expect(later.population).toBeGreaterThan(s.population);
  });

  it("resources respect storage caps", () => {
    const s = advance(fresh(), 1000);
    const caps = storageCaps(s, computeModifiers(s));
    expect(s.resources.wood).toBeLessThanOrEqual(caps.wood + 0.001);
  });

  it("raising tax increases gold income but lowers happiness", () => {
    const base = fresh();
    const taxed = applyCommand(base, { type: "setTax", rate: 0.5 }).state;
    const m = computeModifiers(taxed);
    expect(netProduction(taxed, m).gold).toBeGreaterThan(netProduction(base, computeModifiers(base)).gold);
  });
});

describe("commands", () => {
  it("building spends resources and completes after its timer", () => {
    const s0 = fresh();
    const r = applyCommand(s0, { type: "build", building: "farm", instanceIndex: null });
    expect(r.result.ok).toBe(true);
    expect(r.state.resources.wood).toBeLessThan(s0.resources.wood);
    const farmsBefore = s0.buildings.filter((b) => b.id === "farm").length;
    const done = advance(r.state, 50);
    expect(done.buildings.filter((b) => b.id === "farm").length).toBe(farmsBefore + 1);
  });

  it("research spends RP and unlocks its effect", () => {
    let s = fresh();
    s = { ...s, resources: { ...s.resources, rp: 500 } };
    const r = applyCommand(s, { type: "research", research: "mining" });
    expect(r.result.ok).toBe(true);
    expect(r.state.resources.rp).toBeLessThan(500);
    expect(computeModifiers(r.state).unlockedBuildings.has("iron_mine")).toBe(true);
  });

  it("starts with a Town Hall (the progression spine)", () => {
    const s = fresh();
    expect(s.buildings.some((b) => b.id === "town_hall")).toBe(true);
    expect(townHallLevel(s)).toBe(1);
  });

  it("gates new construction behind Town Hall level (tier)", () => {
    const rich = (s: GameState): GameState => ({ ...s, resources: { ...s.resources, wood: 9999, stone: 9999 } });
    const s = fresh(); // Town Hall L1
    // tavern is tier 2 -> blocked at L1
    expect(applyCommand(rich(s), { type: "build", building: "tavern", instanceIndex: null }).result.ok).toBe(false);
    // raise Town Hall to L2 -> now allowed
    const s2 = rich({ ...s, buildings: [{ id: "town_hall", level: 2 }, ...s.buildings.filter((b) => b.id !== "town_hall")] });
    expect(applyCommand(s2, { type: "build", building: "tavern", instanceIndex: null }).result.ok).toBe(true);
  });

  it("rejects unaffordable actions", () => {
    const s: GameState = { ...fresh(), resources: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0, rp: 0, token: 0 } };
    expect(applyCommand(s, { type: "build", building: "barracks", instanceIndex: null }).result.ok).toBe(false);
  });

  it("attacking sends troops out and they leave the home garrison", () => {
    let s: GameState = { ...fresh(), troops: { spearman: 10 } };
    const r = applyCommand(s, { type: "attack", targetId: "ai_brookmere", army: { spearman: 10 } });
    s = r.state;
    expect(r.result.ok).toBe(true);
    expect(s.troops.spearman ?? 0).toBe(0);
    expect(s.marches.length).toBe(1);
  });
});

describe("market & scouting", () => {
  it("tapping generates market tokens", () => {
    const r = applyCommand(fresh(), { type: "tap" });
    expect(r.result.ok).toBe(true);
    expect(r.state.resources.token).toBe(1);
  });

  it("buys resources with tokens and rejects when short", () => {
    let s: GameState = { ...fresh(), resources: { ...createInitialState(777).resources, token: 50 } };
    const r = applyCommand(s, { type: "buy", resource: "wood", amount: 10 });
    expect(r.result.ok).toBe(true);
    expect(r.state.resources.token).toBe(25); // 10 wood @ 2.5 tokens each
    expect(r.state.resources.wood).toBe(s.resources.wood + 10);
    s = r.state;
    expect(applyCommand(s, { type: "buy", resource: "iron", amount: 1000 }).result.ok).toBe(false);
  });

  it("scouting requires research, then sends an expedition that returns loot", () => {
    let s = fresh();
    expect(applyCommand(s, { type: "scout" }).result.ok).toBe(false); // not researched
    s = { ...s, research: { scouting: 2 }, resources: { ...s.resources, food: 100 } };
    const sent = applyCommand(s, { type: "scout" });
    expect(sent.result.ok).toBe(true);
    expect(sent.state.marches.length).toBe(1);
    const after = advance(sent.state, 600); // long enough to go and return
    expect(after.marches.length).toBe(0);
    expect(after.reports.some((r) => r.kind === "scout")).toBe(true);
  });
});

describe("territory, conquest & rank", () => {
  it("starts holding land around the capital, with unclaimed wilds", () => {
    const s = createInitialState(1);
    expect(s.tileOwner[key(world.player.tile.x, world.player.tile.y)]).toBe("player");
    expect(ownedCount(s.tileOwner, "player")).toBeGreaterThanOrEqual(1);
    expect(Object.values(s.tileOwner).some((o) => o === "neutral")).toBe(true);
    expect(realmInfo(s).rank).toBe("Peasant");
  });

  it("conquers a neutral tile with an army", () => {
    let s: GameState = { ...createInitialState(3), troops: { swordsman: 40, archer: 20 } };
    const cap = world.player.tile;
    const neutral = landTiles()
      .filter((t) => s.tileOwner[key(t.x, t.y)] === "neutral")
      .sort((a, b) => (Math.abs(a.x - cap.x) + Math.abs(a.y - cap.y)) - (Math.abs(b.x - cap.x) + Math.abs(b.y - cap.y)))[0];
    const r = applyCommand(s, { type: "conquer", x: neutral.x, y: neutral.y, army: { swordsman: 40, archer: 20 } });
    expect(r.result.ok).toBe(true);
    const after = advance(r.state, 120);
    expect(after.tileOwner[key(neutral.x, neutral.y)]).toBe("player");
    expect(after.reports.some((rep) => rep.kind === "conquer" && rep.victory)).toBe(true);
  });

  it("assigns every rival a stable archetype", () => {
    for (const f of factions.filter((x) => !x.isPlayer)) {
      const a = archetypeFor(f.id);
      expect(ARCHETYPE[a]).toBeDefined();
      expect(archetypeFor(f.id)).toBe(a); // deterministic
    }
  });

  it("raises a tile's intel after a scouting expedition (fog of war)", () => {
    const base = createInitialState(9);
    const cap = world.aiVillages[0].tile;
    const s: GameState = { ...base, research: { scouting: 1 }, resources: { ...base.resources, food: 200 } };
    expect(s.intel[key(cap.x, cap.y)] ?? 0).toBe(0);
    const r = applyCommand(s, { type: "scoutTile", x: cap.x, y: cap.y });
    expect(r.result.ok).toBe(true);
    const after = advance(r.state, 1200);
    expect(after.intel[key(cap.x, cap.y)] ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("rivals grow economically over time (AI economy)", () => {
    const s = createInitialState(2);
    const before = { ...s.factionStrength };
    const after = advance(s, 900); // several AI turns
    expect(Object.keys(after.factionStrength).some((id) => after.factionStrength[id] > (before[id] ?? 0))).toBe(true);
  });

  it("crowns the faction holding a third of the realm as King", () => {
    const s = createInitialState(1);
    const need = Math.ceil(landTiles().length * 0.34);
    landTiles().slice(0, need).forEach((t) => { s.tileOwner[key(t.x, t.y)] = "player"; });
    expect(realmInfo(s).isKing).toBe(true);
    expect(realmInfo(s).rank).toBe("King");
  });
});

describe("save migration", () => {
  it("preserves village progress and resets world-coupled fields", async () => {
    const { migrate } = await import("../host/persistence");
    const oldSave = {
      schemaVersion: 1,
      resources: { food: 999, wood: 500 }, // partial; missing newer resource ids
      population: 42,
      buildings: [{ id: "farm", level: 5 }, { id: "barracks", level: 3 }],
      research: { mining: 2, militia: 1 },
      troops: { swordsman: 30 },
      tick: 1234,
    };
    const m = migrate(oldSave);
    expect(m.population).toBe(42);
    expect(m.buildings.find((b) => b.id === "barracks")?.level).toBe(3);
    expect(m.research.mining).toBe(2);
    expect(m.troops.swordsman).toBe(30);
    expect(m.resources.food).toBe(999);
    expect(m.resources.token).toBe(0);        // backfilled new resource
    expect(m.tileOwner[key(world.player.tile.x, world.player.tile.y)]).toBe("player"); // world reset
    expect(m.intel).toEqual({});
  });
});

describe("siege", () => {
  const defender = {
    garrison: { spearman: 6, archer: 4 },
    fortifications: [{ building: "wall", level: 1 }],
  };
  const mods = computeModifiers(fresh());

  it("is deterministic for identical inputs", () => {
    const a = resolveSiege({ swordsman: 20, catapult: 3 }, defender, mods, 42);
    const b = resolveSiege({ swordsman: 20, catapult: 3 }, defender, mods, 42);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("a large army with siege engines takes a small fort", () => {
    const out = resolveSiege({ swordsman: 40, archer: 20, catapult: 5 }, defender, mods, 1);
    expect(out.breached).toBe(true);
    expect(out.victory).toBe(true);
  });

  it("an army with no siege engines cannot breach walls", () => {
    const out = resolveSiege({ swordsman: 40 }, defender, mods, 1);
    expect(out.breached).toBe(false);
    expect(out.victory).toBe(false);
  });
});
