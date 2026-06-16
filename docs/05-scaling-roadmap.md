# 05 — Scaling Roadmap ("Make it BIG")

The plan for taking *Bannerfall* from a proven M1/M2 prototype to a deep, great-looking,
eventually-multiplayer game. This sits **after** `04-mvp-roadmap.md` and turns its later
milestones into a concrete, buildable backlog.

> **Status when written:** M1 complete, mid-M2. Current content scale: **21 buildings,
> 36 research nodes, 10 troops, 9 AI rivals** on a 22×32 GB+Ireland map. Clean
> `src/sim` (pure/deterministic/tested) ↔ `src/ui` split is intact — protect it.

---

## Guiding decisions (the "why" behind the sequencing)

1. **Web-first, all the way through depth.** The web stack (React/TS + Vite) is free,
   fast to iterate, and every expensive asset (content JSON, sim spec, save format)
   ports forward unchanged. We extract *all* gameplay and design wins here before paying
   any engine-port cost.
2. **Engine cost is not a blocker.** Unity Personal is free under $200k/yr revenue;
   Godot is free with no revenue cap. The real question isn't cost — it's **2D/2.5D vs
   3D** (see below).
3. **Target stylized 2.5D / isometric, not full 3D.** The genre's best games (Travian,
   Forge of Empires, SHK) are 2D/2.5D. Full 3D is a massive art pipeline (model, rig,
   animate, light, camera) that adds nothing to *systems depth* — the actual appeal.
   2.5D looks great for a fraction of the work and is where AI art tools (e.g.
   Higgsfield) generate buildings/terrain/units. **Higgsfield is an asset generator, not
   a game engine** — it feeds whatever engine we use; it is not an alternative to Unity.
4. **The sim core is sacred.** All new game logic goes in `src/sim` as pure,
   deterministic, testable code. UI only reads state and emits commands. This is what
   keeps the Unity/MMO port cheap.

---

## Phase 1 — Smarter, scaling AI rivals

**Goal:** Rivals that feel like real opponents and stay a fair-but-rising threat at
every stage of progression. Today the AI only grabs bordering tiles
(`src/sim/territory.ts:118 aiTurn`); it has no economy, no research, no army growth.

### 1A. AI economic simulation (lightweight)
- Give each AI faction a **simulated economy state**: a power/economy score that grows
  over time, plus a notion of army size and fortification level at its capital.
- Keep it *cheap* — not a full per-AI copy of the player sim. A compact growth model
  (a few numbers per faction advanced each AI turn) is enough to drive believable
  behavior and remain deterministic.
- Store AI state in `GameState` (extend the save format; bump a save version).

### 1B. Scaling to the player
- AI strength tracks a **player progression index** (blend of rank/tiles/research/
  army). Define a target band so AI is always "a bit ahead if you're passive, beatable
  if you push." Tunable in `config/balance.json`.
- **Per-faction difficulty personalities:** turtle (fortifies, hard to crack, passive),
  aggressor (raids the player often, weaker economy), economic (snowballs if left
  alone). Drive these from the existing `difficulty` field plus a new `archetype`.

### 1C. AI behaviors (acting on the existing AI turn interval)
- Expand into neutral land (already exists) **and** invest in economy/army/forts.
- Launch **real sieges back at the player** (reuse the deterministic siege resolver),
  not just silent tile seizures — produce a Chronicle report the player can read.
- Rivals war with *each other* over neutral land so the map feels alive.

### 1D. Tests
- Golden-state tests: AI growth is deterministic; scaling stays inside the target band
  across a simulated long game; no runaway/degenerate loops.

**Done when:** a passive player gets pressured, an aggressive player is challenged, the
map visibly evolves over a multi-day arc, and it's all deterministic + tested.

---

## Phase 2 — Fog of War & Reconnaissance (the scouting system)

**Goal:** Opponent and map info is **hidden until scouted**, with scouting depth/
difficulty scaling with progression. This is a *new* system — today scouting is only a
loot expedition (`src/sim/sim.ts:480`), there is no fog of war, and you can already see
every AI's garrison. The unused `scout_vision_flat` effect type
(`src/sim/types.ts:39`) is the hook for this.

### 2A. Fog-of-war state
- Each land tile has a **visibility level** per the player: `unknown → explored →
  scouted → surveilled` (info decays back toward stale over time so recon is ongoing,
  not one-and-done).
- Persist a visibility map in `GameState`.

### 2B. What each level reveals
| Level | Reveals |
|---|---|
| **unknown** | Just "there is land here" (or not). Opponent identity hidden. |
| **explored** | Tile terrain + who owns it (faction name/color). |
| **scouted** | Approximate garrison & fortification strength (fuzzed ranges). |
| **surveilled** | Exact garrison, fort layout, economy estimate — full intel for siege planning. |

### 2C. Scouting as an action that scales
- Sending scouts targets a **tile or faction**, costs resources + travel time, and
  raises that target's visibility level.
- **Difficulty scales:** nearby/neutral tiles are easy; enemy capitals and distant
  tiles are *hard* — deeper intel needs higher Scouting research rank, more scouts, or
  repeated attempts. Hard targets can partially fail (incomplete/fuzzed intel) or get
  your scouts caught (cost, alert the enemy).
- **Progression hooks:** Scouting research ranks increase vision range, intel accuracy,
  travel speed, and success vs. hard targets (wire up `scout_vision_flat` +
  `scout_yield_pct`, add new effects as needed).
- Keep the existing "scout the wilds for loot" as one outcome; add "scout a known
  target for intel" as the new primary use.

### 2D. UI
- World map renders fog (dim/hidden unknown tiles, "?" markers for unscouted enemies).
- Target panels show **only what's been scouted**, with confidence/staleness
  indicators. Pre-siege screen pulls from current intel.

### 2E. Tests
- Visibility transitions deterministic; intel fuzzing seeded; hard-target success
  scales correctly with research rank.

**Done when:** the map starts mostly dark, the player must invest in recon to plan
attacks, and intel quality visibly improves with progression.

---

## Phase 3 — Castle Development & the Castellany

**Goal:** A dedicated **castle screen** — a second build/management space alongside the
home village — where the player designs and upgrades their fortress. This is both a major
gameplay pillar (it *is* your siege defense) and a huge **new research surface**.

Today fortifications exist only as data attached to the village/siege resolver; there is
no place to actually *develop* a castle. We make the castle a first-class location.

### 3A. The castle as a second location
- A new top-level screen (peer to the Village tab): the **castle bailey/grounds** with
  its own build grid/layout, separate from village production buildings.
- The castle holds **defensive + military-support structures**: keep, curtain walls,
  gatehouses, towers (garrisonable with ranged troops), barbican, moat, drawbridge,
  traps, and inner buildings (armoury, garrison hall, smithy, dungeon, great hall).
- **Layout matters:** placement on the grid feeds directly into the deterministic siege
  resolver (this is the "design-a-castle, breach-a-castle" identity from `01 §7`).
  Upgrading the village no longer silently sets defense — you *build the castle*.

### 3B. The Castellany research branch (lots of new research)
- A whole new research branch (or two) unlocked by castle development:
  - **Fortification tiers** — wooden palisade → stone curtain → concentric walls; tower
    types (watch/arrow/cannon); gatehouse upgrades; moat & water defenses.
  - **Castellany / garrison** — garrison capacity, tower archer bonuses, sortie ability,
    repair speed, supply/siege-resistance (hold out longer under siege).
  - **Siege engineering (offense side)** — better rams/catapults/trebuchets/towers for
    attacking *enemy* castles, tying back to Phase 1's AI sieges.
- This alone meaningfully grows the research tree toward the 100+ target in Phase 4 and
  gives the castle a long upgrade arc.

### 3C. Economy & integration hooks
- Castle buildings cost stone/iron/wood + build-time (reuse the build-queue system);
  some require village prerequisites (a quarry before stone walls, etc.) so the two
  locations interlock.
- Garrisoning towers pulls from your standing army → a real allocation decision
  (defend the castle vs. field an attacking force).
- **Fog of war (Phase 2) pairs here:** scouting an enemy reveals *their* castle layout,
  which you study before committing to a siege.

### 3D. Tests
- Castle layout → siege-resolver outcomes stay deterministic; new fortification tiers
  resolve correctly; garrison allocation is consistent.

**Done when:** the player has a distinct, satisfying castle to grow over time, its layout
visibly changes siege outcomes, and a deep Castellany research branch is live.

---

## Phase 4 — Loads more progression

**Goal:** Much more to chase, long-arc depth. Most of this is **data entry** against the
existing schemas, validated by the sim tests.

- **Content breadth:** buildings 21→50+, research 36→100+ (deeper ranks across all 5
  branches), troops 10→20+. Pure JSON in `content/`.
- **New long-arc systems:**
  - **Prestige / rebirth** — reset for permanent meta-bonuses (classic retention spine).
  - **Realm goals / achievements / quests** — directed objectives, not just sandbox.
  - **Political layer** (already designed in `01 §9`): parishes, sheriffs, local taxes,
    influence resource.
  - **Steward card/boost economy** (`01 §9`) — collectible timed modifiers; slots into
    the existing typed-effect system cleanly.
- **Deeper siege:** watchable replay of the auto-resolve (fortification breadth now
  comes largely from the castle/Castellany work in Phase 3).

**Done when:** there's a satisfying multi-week progression arc with prestige beyond it,
and the political/boost systems are live in single-player.

---

## Phase 5 — Better design & feel (still web)

**Goal:** Make it *look and feel* like a real game on the current stack — the cheapest
place to nail art direction before any port.

- **Art direction:** adopt a stylized **2.5D / isometric** look. Pilot AI-generated
  assets (Higgsfield et al.) for isometric buildings, terrain tiles, unit art. Establish
  a consistent style guide so generated assets cohere.
- **Juice:** animations, transitions, number-pop, resource-tick feedback, sound/music.
- **UX:** information architecture pass, a real **onboarding/tutorial**, empty states,
  readable HUD at phone width.
- **Performance:** keep the map/render smooth as the world grows (it's already SVG-based
  after the black-screen fix).

**Done when:** a new player is guided in, the game reads as polished and intentional on a
phone screen, and the art style is locked.

---

## Phase 6 — Bigger world → Multiplayer (MMO)

**Goal:** Your roadmap's M4 — turn the single-player world persistent and shared.

- **Cheap first:** bigger map, more factions, richer neutral world — all in-sim.
- **Then the real lift:** authoritative **server running the same sim core** (the
  determinism we protected throughout Phases 1–4 is what makes this possible); command
  validation/anti-cheat; persistence DB; region/world matchmaking; real players replace
  local AI (AI fills empty space). Layer the political/boost systems server-side.

**Done when:** multiple real players share a persistent, server-authoritative map with
live economy, sieges, and recon.

---

## Phase 7 — Unity packaging (optional, later)

**Goal:** Native mobile apps — **not a 3D rewrite.**

- Port **only** to ship Android/iOS/WebGL, reusing all content JSON + the deterministic
  sim spec + save format. Reimplement the sim runner in C# and **verify parity** against
  the TS golden-state tests; bring the 2.5D art across.
- True 3D stays an explicit, separate decision made only if it earns its cost later.

**Done when:** the game runs on real Android + iOS + WebGL with C#↔TS sim parity.

---

## Sequencing & principles

```
Phase 1 (scaling AI) ─┐
Phase 2 (fog/recon)  ─┤
Phase 3 (castle dev) ─┼─ web, parallelizable, all reversible
Phase 4 (progression)┘
        │
Phase 5 (design/feel) ── art lock on web
        │
Phase 6 (bigger world → MMO)
        │
Phase 7 (Unity packaging, optional)
```

- **Cheap validation before expensive commitment** — exhaust the web stack before any
  port.
- **Never discard expensive assets** — content data, sim spec, save format carry forward.
- **Protect determinism** — every gameplay system lives in `src/sim`, pure and tested.
- **Each phase is independently playable/demoable.**

## Recommended starting point

Begin with **Phase 1 (scaling AI)** — biggest leap in how the game *feels*, self-
contained in the sim core — then **Phase 2 (fog of war)**, which pairs naturally with it
(smarter rivals are more interesting when you must scout to learn about them).

---

## Pick-up checklist (for resuming on another machine)

1. `git pull` the branch (`claude/stronghold-kingdoms-mobile-90pe4k` or wherever this
   lands).
2. `npm install` → `npm run dev` to confirm it still runs; `npm test` for the sim suite.
3. Start Phase 1A: extend `GameState` with AI economy state + bump save version, then
   grow `aiTurn` in `src/sim/territory.ts`. Add golden-state tests alongside.
4. Keep all logic in `src/sim`; UI changes only read state / emit commands.

---

# Appendix A — Castle content draft (Phase 3)

Concrete first-pass content for the castle screen + Castellany research, aligned to the
existing JSON schema (see `content/buildings.json`, `content/research.json`). Numbers are
**starting points to balance**, not final. The existing `wall`/`tower`/`watchtower`
fortifications fold into this set.

## A.1 Castle buildings

Proposed new `category: "castle"` (or extend `"fortification"`). `defense.health` feeds
the siege resolver; `defense.garrisonSlots` = ranged troops that can man it.

| id | name | role | key fields (draft) |
|---|---|---|---|
| `keep` | The Keep | Heart of the castle; its level gates other castle buildings & sets max layout size | high `defense.health`; `requires` village level; unlocks castle tab |
| `palisade` | Timber Palisade | Cheap tier-1 wall (early game) | low `defense.health`; wood cost; pre-masonry |
| `wall` | Stone Curtain Wall | Tier-2 wall *(exists)* | `defense.health` 200; stone; `masonry` r1 |
| `concentric_wall` | Concentric Walls | Tier-3 double ring; big breach resistance | high health; `concentric_design` research |
| `gatehouse` | Gatehouse | Defended entry; weak point if breached | health + small garrison; controls a breach lane |
| `barbican` | Barbican | Forward gate defense; slows attackers at the gate | adds delay/damage to gate assaults |
| `tower` | Defensive Tower | Garrisonable ranged platform *(exists)* | health 350, garrisonSlots 4 |
| `watchtower` | Great Watchtower | Bigger tower *(exists)* + vision bonus | health 480, garrisonSlots 6; ties to scouting vision |
| `artillery_tower` | Artillery Tower | Late tower mounting siege weapons vs attackers | high health; bonus damage to attacker siege engines |
| `moat` | Moat | Slows/damages attackers before the walls | layout modifier; no garrison |
| `drawbridge` | Drawbridge | Pairs with moat/gate; raises to deny a lane | toggles a gate lane during siege |
| `traps` | Traps & Murder Holes | One-shot attrition on attackers in a lane | per-lane damage; consumed/rebuilt |
| `garrison_hall` | Garrison Hall | Raises total garrison capacity | `+garrison capacity` (support, not a wall) |
| `armoury` | Armoury | Boosts defending troop stats during a siege | troop stat % while defending |
| `castle_smithy` | Castle Smithy | Speeds fortification repair & build | repair/build-time reduction |
| `granary_store` | Siege Stores | Hold-out duration under siege (supply) | extends how long you resist before attrition |
| `great_hall` | Great Hall | Civic/influence + happiness from prestige | influence (Phase 4 politics) + happiness |
| `dungeon` | Dungeon | Fear/benevolence dial (`01 §3`); minor output vs happiness | trades happiness for an output/defense edge |

**Layout rule:** walls/towers/gates/moat/traps occupy the castle grid and define **breach
lanes** the attacker must fight through; support buildings (garrison hall, armoury, smithy,
stores) buff but don't occupy defensive lanes.

## A.2 Castellany research branch(es)

New `branch: "castellany"` (plus offense-side `siege_engineering`). Effects reuse the
typed-effect system; add new effect `type`s where noted.

**Fortification tiers**
| id | name | effect (per rank, draft) |
|---|---|---|
| `timber_framing` | Timber Framing | unlock `palisade`; +% palisade health |
| `masonry` | Masonry *(exists)* | unlock `wall`/`tower`; +% wall health |
| `architecture` | Architecture *(exists)* | unlock `watchtower`; +% tower health |
| `ashlar_masonry` | Ashlar Masonry | +% all wall/tower health |
| `concentric_design` | Concentric Design | unlock `concentric_wall` |
| `machicolations` | Machicolations | towers deal +% damage to attackers below |

**Castellany / garrison**
| id | name | effect (per rank, draft) |
|---|---|---|
| `arrow_slits` | Arrow Slits | +% garrison ranged damage from towers |
| `garrison_drills` | Garrison Drills | +garrison capacity |
| `sortie_tactics` | Sortie Tactics | defenders can sally to damage attacker siege engines |
| `tower_artillery` | Tower Artillery | unlock `artillery_tower`; +damage vs siege engines |

**Defense operations**
| id | name | effect (per rank, draft) |
|---|---|---|
| `rapid_repair` | Rapid Repair | +% fortification repair speed (also post-siege) |
| `siege_provisioning` | Siege Provisioning | +% hold-out duration (works with `granary_store`) |
| `counter_mining` | Counter-Mining | reduces attacker sapping/wall-breach effectiveness |

**Siege engineering (offense — for attacking enemy castles, ties to Phase 1)**
| id | name | effect (per rank, draft) |
|---|---|---|
| `improved_rams` | Improved Rams | +% ram damage vs gates |
| `trebuchet_design` | Trebuchet Design | unlock/boost trebuchet vs walls |
| `siege_towers` | Siege Towers | bypass a wall tier; reduce approach casualties |
| `sapping` | Sapping | chance to collapse a wall section pre-assault |

## A.3 New typed effects likely needed
`unlock_building` / `unlock_troop` already exist. Probable additions:
`garrison_capacity_flat`, `repair_speed_pct`, `holdout_duration_pct`,
`fort_health_pct` (target = a fortification id or "all"), `siege_engine_dmg_pct`,
`tower_ranged_dmg_pct`. Add to the `Modifiers` shape in `src/sim/effects.ts` + the effect
`type` union in `src/sim/types.ts` when Phase 3 is built.

## A.4 Open balance questions (decide before building)
- Does the castle share the village build queue or get its own?
- Is garrison drawn from the same troop pool as your field army (forces allocation) — or
  a separate "garrison" pool?
- Grid size: fixed, or does `keep` level expand the buildable castle area?
- Repair: automatic over time, or a player action costing resources?
