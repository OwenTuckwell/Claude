# 03 — Technical Architecture

How we build *Bannerfall* so it can **start easy on the web (user-hostable)** and **grow
into a Unity-standard, cross-platform (Android + iOS + Web) game** without throwing away
the expensive work — and so the **single-player** build becomes the **MMO** client later
without a rewrite.

---

## 1. The one idea that makes the whole path work

> **Separate the simulation core from presentation, and keep all game content & rules
> as engine-agnostic data.**

The expensive, game-defining assets are:
1. **Content data** — buildings, research tree, troops, world, balance constants (JSON).
2. **The simulation spec** — the deterministic rules that turn data + player actions +
   time into new state (documented in `02` and formalized here).

Neither of those is tied to React, TypeScript, or Unity. They survive the web→Unity
migration. Only the **sim *runner*** (the code executing the spec) and the **renderer**
get reimplemented in C# for Unity — and the runner is a direct, mechanical port because
the spec is deterministic and fully specified.

```
        ┌────────────────────────────────────────────┐
        │   PORTABLE (write once, reuse forever)       │
        │  • Content data (JSON: buildings/research/   │
        │    troops/world/balance)                     │
        │  • Simulation spec (this doc + 02)           │
        │  • Save format (versioned JSON)              │
        └────────────────────────────────────────────┘
                 ▲                         ▲
                 │ implements              │ implements
        ┌────────┴─────────┐     ┌─────────┴──────────┐
        │  M1: Web (TS)     │     │  M3: Unity (C#)     │
        │  • sim runner TS  │     │  • sim runner C#    │
        │  • React/canvas UI│     │  • Unity UI/render  │
        └───────────────────┘     └────────────────────┘
                                    exports → WebGL / Android / iOS
```

Note: Unity exports **WebGL, Android, and iOS** from a single project — so the Unity end
state already covers all three of the user's targets, including web hosting.

---

## 2. Layered design (engine-independent)

```
┌─────────────────────────────────────────────┐
│ Presentation  (per-engine: React/canvas, Unity)│  ← rendering, input, animation
├─────────────────────────────────────────────┤
│ Application / Commands                        │  ← validates & queues player intents
├─────────────────────────────────────────────┤
│ Simulation Core  (deterministic, headless)    │  ← THE GAME; no UI, no I/O
│   state + tick() + applyCommand()             │
├─────────────────────────────────────────────┤
│ Content Data (JSON)  +  Balance config        │  ← portable assets
└─────────────────────────────────────────────┘
```

- **Simulation Core** is a pure function world: `(state, command) → state` and
  `(state, ticks) → state`. No clocks, no network, no rendering inside it. This is what
  makes it testable, fast-forwardable, *and* server-authoritative-ready.
- **Presentation** only *reads* state and *emits commands*. Swapping React for Unity
  changes only this layer.

---

## 3. Determinism, ticks & offline catch-up

- **Fixed-timestep tick** (1 tick = 1 game-minute, see `02`). The core never reads
  wall-clock time itself; the host passes in "advance N ticks."
- **Seeded RNG:** any randomness (siege rolls, AI) uses an explicit seed stored in
  state → identical inputs always produce identical outputs (replayable sieges,
  server-verifiable).
- **Offline progress:** on resume, host computes `elapsed_ticks = (now − last_saved) /
  tick_len`, clamps to a max window, and calls `tick()` that many times. Storage caps
  bound the result (see `02 §6`). No special "offline code path" — same sim.

This determinism is the bridge to MMO: an authoritative server runs the *same* core; the
client predicts, the server confirms; commands are validated server-side.

---

## 4. Content data schemas (the portable assets)

Stored as JSON, validated at load. Sample files live in `docs/data/`. Schemas
(informal; a JSON-Schema can be generated in M1):

**Building** (`buildings.sample.json`)
```jsonc
{
  "id": "farm",
  "name": "Farm",
  "category": "production",          // production|storage|housing|civic|military|fortification
  "produces": { "food": 2 },          // base per-tick at L1, fully staffed
  "consumes": {},                     // optional per-tick input
  "labour": 3,                        // population needed for full staffing
  "storageBonus": {},                 // for storage buildings: {"food": 500}
  "housingBonus": 0,                  // for housing
  "maxLevel": 10,
  "costBase": { "wood": 60, "stone": 0 },
  "costGrowth": 1.6,                  // cost(L)=costBase*growth^(L-1)
  "timeBaseSec": 60,
  "timeGrowth": 1.5,
  "requires": { "buildings": [], "research": [] }
}
```

**Research node** (`research.sample.json`)
```jsonc
{
  "id": "better_ploughs",
  "name": "Better Ploughs",
  "branch": "economy",               // economy|military|construction|logistics|statecraft
  "maxRank": 5,
  "rpCostBase": 50,
  "rpCostGrowth": 1.8,
  "requires": { "research": [], "buildingLevels": { "scholars_hall": 1 } },
  "effects": [                        // typed modifiers applied to the sim
    { "type": "production_pct", "target": "farm", "valuePerRank": 0.08 }
  ]
}
```

**Troop** (`troops.sample.json`)
```jsonc
{
  "id": "archer",
  "name": "Archer",
  "role": "ranged",                  // ranged|infantry|cavalry|siege
  "attack": 12, "defense": 4, "health": 20,
  "cost": { "wood": 10, "iron": 5, "gold": 5 },
  "upkeep": { "gold": 0.02, "food": 0.05 },  // per tick
  "trainTimeSec": 90,
  "requires": { "buildings": { "archery_range": 1 }, "research": [] }
}
```

**Effects are typed** (`production_pct`, `build_time_pct`, `troop_stat`, `storage_cap`,
`happiness`, …) and interpreted by the sim. Research and **[Later]** card/boosts share
this same effect vocabulary, so boosts plug in with zero new sim plumbing.

**Balance config** (`config/balance.json`, M1): tick length, ration/tax tables,
per-capita food, pop-growth rates, catch-up cap, bonus-stacking rule.

---

## 5. State & save format

- **State** = a single serializable tree: resources, buildings (id, level, staffing,
  build-queue), population, happiness inputs, research progress, troops, world tiles,
  RNG seed, `lastTick`, and a **`schemaVersion`**.
- **Save** = versioned JSON. M1: browser `localStorage` / IndexedDB (+ optional export
  to file so the user can back up / move between devices). Versioned so migrations are
  possible; the same format loads in Unity later.

---

## 6. Phase-1 web stack (easy, instantly testable, user-hostable)

| Concern | Choice | Why |
|---|---|---|
| Language | **TypeScript** | Types catch data/sim bugs; ports concepts cleanly to C#. |
| UI | **React** | Fast iteration for the menu/economy-heavy UI. |
| Map/siege view | **HTML Canvas / PixiJS** | 2D grid rendering without engine overhead. |
| Build tool | **Vite** | Trivial dev server + static build. |
| Sim core | **Plain TS module, zero deps** | Pure, testable, portable; no framework lock-in. |
| Tests | **Vitest** | Unit-test the deterministic sim (golden-state tests). |
| Hosting | Static bundle | `vite build` → static files the **user hosts on the web**. |

The sim core lives in its own folder with **no React imports**, enforcing the boundary
and keeping the eventual C# port mechanical.

---

## 7. Unity migration path (M3)

When the web slice proves the fun (see `04`), migrate to Unity for the polished
cross-platform product:

1. **Reuse as-is:** all `docs/data/*.json` content + `config/balance.json` + the
   simulation spec (this doc + `02`) + the save format. *This is most of the game's
   value.*
2. **Reimplement in C#:** the sim runner (mechanical port of the deterministic spec —
   same data in, same state out; verify against the TS golden-state tests) and the
   presentation (Unity UI Toolkit / sprites for map & siege).
3. **Export:** one Unity project → **WebGL** (web hosting), **Android**, **iOS**.
4. **Validate parity:** run identical command sequences through TS core and C# core;
   assert identical resulting state (the determinism pays off here).

**Why not just start in Unity?** Unity iteration is heavier and harder to drive in a
headless/CI/dev-cloud environment; the web slice lets us validate *design* fast and
cheap. Because content is portable, the web work isn't thrown away — only the thin
runner/UI is rewritten.

---

## 8. Single-player now → MMO later (no rewrite)

The architecture is **server-authoritative-ready** from day one:
- Sim core is pure & deterministic → the *same* logic can run on an authoritative
  server.
- Player actions are already modeled as **commands** → these become the
  client→server message protocol; server validates and applies them.
- World map is **data + tile coordinates** → single-player map is a subset of the
  eventual shared world; AI fills empty regions.
- Save state ≈ per-player server state.

MMO milestone (M4) then adds: an authoritative server hosting the core, command
validation/anti-cheat, persistence (DB), matchmaking of map regions, and replacing
local AI neighbours with real players — **without touching game rules**.

---

## 9. Repo layout (target, when prototype starts — not built this phase)

```
/docs            ← design + architecture (this phase)
/docs/data       ← portable content (seed for the prototype)
/sim             ← (M1) TS simulation core, engine-agnostic, tested
/web             ← (M1) React/canvas presentation + host shell
/config          ← (M1) balance.json
/unity           ← (M3) Unity project (reuses /docs/data + /config)
/server          ← (M4) authoritative backend
```

---

## 10. Key risks & mitigations

| Risk | Mitigation |
|---|---|
| Web→Unity becomes a full rewrite | Strict sim/presentation split + data-driven content; golden-state parity tests across both runners. |
| Sim non-determinism breaks catch-up/MMO | No wall-clock or unseeded RNG inside core; CI test that `tick`ing N×1 == 1×N. |
| Content volume (SHK scale) overwhelms | Data-driven design — content is data entry, not code; ship a small validated slice first. |
| Balance runaway/exploits | Constants in config + headless sim harness to chart curves; additive-in/multiplicative-across bonus rule. |
| Scope creep into MMO too early | Anti-scope in `00`; MMO is M4 and explicitly designed-for, not built early. |
