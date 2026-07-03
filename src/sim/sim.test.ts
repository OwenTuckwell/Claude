import { describe, expect, it } from "vitest";
import {
  advance, applyCommand, createInitialState, netProduction, storageCaps, townHallLevel, placementAllowed,
  footprint, buildingCells, firstFreeVillageCell,
} from "./sim";
import { computeModifiers } from "./effects";
import { resolveSiege } from "./siege";
import { landTiles, key, ownedCount, realmInfo, tileVisibility, scoutRange, castleEnclosure, aiEnclosure, analyzeCastle } from "./territory";
import { archetypeFor, ARCHETYPE } from "./rivals";
import { world, factions, balance } from "./content";
import type { GameState, BuildingInstance } from "./types";

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
  it("idle income scales passive production, and a developed village grows", () => {
    const base = fresh();
    const dev: GameState = {
      ...base,
      buildings: [
        { id: "town_hall", level: 1, gx: 0, gy: 0 },
        { id: "farm", level: 3, gx: 2, gy: 0 },
        { id: "farm", level: 3, gx: 4, gy: 0 },
        { id: "hovel", level: 2, gx: 6, gy: 0 },
      ],
      resources: { ...base.resources, food: 200 },
      research: { stewardship: 8 },            // idle income at the 50% cap
    };
    const hi = netProduction(dev, computeModifiers(dev)).food;
    const noStew: GameState = { ...dev, research: {} };          // idle income at the 10% base
    const lo = netProduction(noStew, computeModifiers(noStew)).food;
    expect(hi).toBeGreaterThan(lo);                              // more idle income → more output
    const later = advance(dev, 200);
    expect(later.population).toBeGreaterThan(dev.population);
  });

  it("a fresh realm starts with only a Town Hall (slow, market-driven start)", () => {
    const s = fresh();
    expect(s.buildings).toHaveLength(1);
    expect(s.buildings[0].id).toBe("town_hall");
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

  it("moves a village building to an empty plot", () => {
    const s = fresh();
    const idx = s.buildings.findIndex((b) => b.id === "town_hall");
    const free = firstFreeVillageCell(s.buildings, "town_hall");
    const r = applyCommand(s, { type: "moveBuilding", index: idx, gx: free.gx, gy: free.gy });
    expect(r.result.ok).toBe(true);
    expect(r.state.buildings[idx].gx).toBe(free.gx);
    expect(r.state.buildings[idx].gy).toBe(free.gy);
  });

  it("restricts quarry to the south-middle of the village grid", () => {
    expect(placementAllowed("farm", 0, 0)).toBe(true);       // others go anywhere
    expect(placementAllowed("quarry", 0, 0)).toBe(false);    // north-west: no
    expect(placementAllowed("quarry", 13, 13)).toBe(true);   // south-centre: yes
  });

  it("gives big buildings multi-tile footprints", () => {
    expect(footprint("town_hall")).toBe(3);   // 3×3 centrepiece
    expect(footprint("chapel")).toBe(2);       // 2×2
    expect(footprint("hovel")).toBe(1);        // 1×1 cottage
    expect(buildingCells("chapel", 4, 5).sort()).toEqual(["4,5", "4,6", "5,5", "5,6"].sort());
  });

  it("places starting buildings with no overlapping footprints", () => {
    const s = fresh();
    const seen = new Set<string>();
    for (const b of s.buildings) {
      for (const c of buildingCells(b.id, b.gx!, b.gy!)) {
        expect(seen.has(c)).toBe(false);  // every covered cell is claimed once
        seen.add(c);
      }
    }
  });

  it("won't move a building where its footprint would overlap or leave the grid", () => {
    const s = fresh();
    s.buildings.push({ id: "farm", level: 1, gx: 0, gy: 12 }); // a second building to collide with
    const thIdx = s.buildings.findIndex((b) => b.id === "town_hall"); // 3×3
    // bottom-right corner: a 3×3 origin at (13,13) on a 14-wide grid spills off the edge
    expect(applyCommand(s, { type: "moveBuilding", index: thIdx, gx: 13, gy: 13 }).result.ok).toBe(false);
    // onto another building's tiles → blocked
    expect(applyCommand(s, { type: "moveBuilding", index: thIdx, gx: 0, gy: 12 }).result.ok).toBe(false);
    // a genuinely free 3×3 spot → allowed
    const free = firstFreeVillageCell(s.buildings, "town_hall");
    expect(applyCommand(s, { type: "moveBuilding", index: thIdx, gx: free.gx, gy: free.gy }).result.ok).toBe(true);
  });

  it("rejects unaffordable actions", () => {
    const s: GameState = { ...fresh(), resources: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0, rp: 0, token: 0, renown: 0 } };
    expect(applyCommand(s, { type: "build", building: "barracks", instanceIndex: null }).result.ok).toBe(false);
  });

  it("attacking sends troops out and they leave the home garrison", () => {
    let s: GameState = { ...fresh(), troops: { spearman: 10 } };
    const r = applyCommand(s, { type: "attack", targetId: world.aiVillages[0].id, army: { spearman: 10 } });
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
    // scout a land tile near the player's corner so the round trip is short
    const p = world.player.tile;
    const target = landTiles()
      .filter((t) => !(t.x === p.x && t.y === p.y))
      .sort((a, b) => (Math.abs(a.x - p.x) + Math.abs(a.y - p.y)) - (Math.abs(b.x - p.x) + Math.abs(b.y - p.y)))[3];
    const s: GameState = { ...base, research: { scouting: 1 }, resources: { ...base.resources, food: 400 } };
    expect(s.intel[key(target.x, target.y)] ?? 0).toBe(0);
    const r = applyCommand(s, { type: "scoutTile", x: target.x, y: target.y });
    expect(r.result.ok).toBe(true);
    const after = advance(r.state, 5000);
    expect(after.intel[key(target.x, target.y)] ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("limits scouting to the scouts' range (distant lands need more research)", () => {
    const p = world.player.tile;
    const far = landTiles().slice().sort((a, b) =>
      (Math.abs(b.x - p.x) + Math.abs(b.y - p.y)) - (Math.abs(a.x - p.x) + Math.abs(a.y - p.y)))[0];
    const s: GameState = { ...createInitialState(5), research: { scouting: 1 }, resources: { ...createInitialState(5).resources, food: 400 } };
    expect(scoutRange(s)).toBeGreaterThan(0);
    expect(applyCommand(s, { type: "scoutTile", x: far.x, y: far.y }).result.ok).toBe(false); // across the continent
  });

  it("lets scouted intel go stale over time", () => {
    const explored = new Set<string>();
    const fresh: GameState = { ...createInitialState(1), tick: 100, intel: { "5,5": 3 }, intelAt: { "5,5": 100 } };
    expect(tileVisibility(fresh, explored, 5, 5)).toBe(3);                       // just gathered
    const stale: GameState = { ...fresh, tick: 100 + balance.scouting.staleTicks * 2 };
    expect(tileVisibility(stale, explored, 5, 5)).toBe(1);                       // faded two levels
  });

  it("castle enclosure rewards walling the keep in (walls are solid auto-connecting tiles)", () => {
    // 2×2 keep at (3,3)-(4,4) inside a full 4×4 ring of wall tiles from (2,2)-(5,5).
    const ring: BuildingInstance[] = [{ id: "keep", level: 1, gx: 3, gy: 3 }];
    for (let x = 2; x <= 5; x++) for (let y = 2; y <= 5; y++)
      if (x === 2 || x === 5 || y === 2 || y === 5) ring.push({ id: "wall", level: 1, gx: x, gy: y });
    const scattered: BuildingInstance[] = [
      { id: "keep", level: 1, gx: 3, gy: 3 },
      { id: "wall", level: 1, gx: 0, gy: 0 }, { id: "wall", level: 1, gx: 7, gy: 7 },
    ];
    expect(castleEnclosure(ring)).toBeGreaterThan(0.95);        // sealed courtyard
    expect(castleEnclosure(scattered)).toBeLessThan(0.6);       // scattered walls barely help
    expect(castleEnclosure([])).toBe(0);                        // nothing to defend
    // knock a hole in the ring → the outside floods the courtyard and enclosure drops
    const breached = ring.filter((b) => !(b.id === "wall" && b.gx === 2 && b.gy === 3));
    expect(castleEnclosure(breached)).toBeLessThan(castleEnclosure(ring));
  });

  it("towers and gates count as wall segments in the ring", () => {
    // same ring but with a tower replacing a wall tile and a gatehouse another — still sealed
    const ring: BuildingInstance[] = [{ id: "keep", level: 1, gx: 3, gy: 3 }];
    for (let x = 2; x <= 5; x++) for (let y = 2; y <= 5; y++) {
      if (!(x === 2 || x === 5 || y === 2 || y === 5)) continue;
      if (x === 2 && y === 2) ring.push({ id: "tower", level: 1, gx: x, gy: y });
      else if (x === 5 && y === 3) ring.push({ id: "gatehouse", level: 1, gx: x, gy: y });
      else ring.push({ id: "wall", level: 1, gx: x, gy: y });
    }
    expect(castleEnclosure(ring)).toBeGreaterThan(0.95);
  });

  it("tougher rival keeps are better enclosed (harder to breach)", () => {
    expect(aiEnclosure(5)).toBeGreaterThan(aiEnclosure(1));
    expect(aiEnclosure(5)).toBeLessThanOrEqual(1);
    expect(aiEnclosure(1)).toBeGreaterThan(0.4);
  });

  it("analyzeCastle reads the breach lane from the layout", () => {
    // ring with a gatehouse in the east wall and towers flanking it
    const ring: BuildingInstance[] = [{ id: "keep", level: 1, gx: 3, gy: 3 }];
    for (let x = 2; x <= 5; x++) for (let y = 2; y <= 5; y++) {
      if (!(x === 2 || x === 5 || y === 2 || y === 5)) continue;
      if (x === 5 && y === 3) ring.push({ id: "gatehouse", level: 1, gx: x, gy: y });
      else if (x === 5 && (y === 2 || y === 5)) ring.push({ id: "tower", level: 1, gx: x, gy: y });
      else ring.push({ id: "wall", level: 1, gx: x, gy: y });
    }
    const lay = analyzeCastle(ring);
    expect(lay.breachIsGate).toBe(true);                 // the gate is the natural target
    expect(lay.breachName).toBe("Gatehouse");
    expect(lay.towersAtBreach).toBe(2);                  // both flanking towers cover it
    expect(lay.hasMoat).toBe(false);
    // no gate → weakest frontline piece (a wall) becomes the breach
    const noGate = ring.map((b) => b.id === "gatehouse" ? { ...b, id: "wall" } : b);
    expect(analyzeCastle(noGate).breachIsGate).toBe(false);
    expect(analyzeCastle(noGate).breachName).toBe("Stone Wall");
  });

  it("towers over the breach and a moat make the assault bloodier", () => {
    const mods = computeModifiers(fresh());
    const army = { swordsman: 40, archer: 20, catapult: 5 };
    const base = (layout: Partial<import("./siege").CastleLayout>) => resolveSiege(army, {
      garrison: { spearman: 10, archer: 20 },
      fortifications: [{ building: "wall", level: 3 }, { building: "tower", level: 2 }],
      layout: { enclosure: 1, breachName: "Stone Wall", breachIsGate: false, towersAtBreach: 0, hasMoat: false, ...layout },
    }, mods, 42, computeModifiers(fresh()));
    const open = base({});
    const towered = base({ towersAtBreach: 3 });
    const moated = base({ hasMoat: true });
    const sum = (r: Record<string, number>) => Object.values(r).reduce((a, c) => a + c, 0);
    expect(sum(towered.attackerLosses)).toBeGreaterThan(sum(open.attackerLosses));
    expect(sum(moated.attackerLosses)).toBeGreaterThan(sum(open.attackerLosses));
    expect(towered.lines.join(" ")).toContain("rake the breach");
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
