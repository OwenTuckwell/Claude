# 05 — Scaling Roadmap ("Make it BIG")

The plan for taking *Bannerfall* from a proven M1/M2 prototype to a deep, great-looking,
eventually-multiplayer game. This sits **after** `04-mvp-roadmap.md` and turns its later
milestones into a concrete, buildable backlog.

> **Status when written:** M1 complete, mid-M2. Current content scale: **21 buildings,
> 36 research nodes, 10 troops, 9 AI rivals** on a 22×32 GB+Ireland map. Clean
> `src/sim` (pure/deterministic/tested) ↔ `src/ui` split is intact — protect it.

## Contents
**Phases:** 1 Scaling AI · 2 Fog of war · 3 Castle development · 4 Progression ·
5 Design/feel · 6 Bigger world/MMO · 7 Unity packaging.

**Appendices (the detail):**
- **A** — Castle content draft (buildings, Castellany research, locked decisions, village-vs-castle).
- **B** — Phase 1 scaling-AI detail (AI state, scaling band, personalities, combat model).
- **C** — The layered ring model (difficulty rings, rival archetype assignments, layer stack).
- **D** — Scaling the world (bigger map & more opponents; the missing generator).
- **E** — World generator spec (seeded TS generator; reverse-engineered rival formulas).
- **F** — Gateway techs & concrete progression path (real research/troop ids per ring).
- **G** — Phase 2 fog-of-war detail (visibility levels, scaling recon, fuzzing).
- **H** — **Phase 1 implementation checklist — START HERE for building.**

> **Resuming at home?** Read this top section, then jump to **Appendix H** for the ordered
> build steps. Appendices B/C/F give the "why" behind them.

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

## A.4 Decided design rules (locked)
These were open questions; now decided. They drive the implementation.

1. **Garrison = the field-army pool.** Troops you assign to garrison towers/walls are the
   *same* troops you'd send to attack — so manning the castle removes them from any
   attacking force. This is the core **defend-vs-attack allocation tension**. Implication:
   the garrison is an *assignment* of existing `state.troops`, not a separate roster;
   garrisoned troops are unavailable for marches until un-assigned.
2. **Castle has its OWN build queue,** separate from the village queue. Fortifying and
   economy progress run in parallel — building walls doesn't stall a farm upgrade.
   Implication: `GameState` needs a second queue (e.g. `castleQueue`) alongside the
   village build queue; UI shows two queues.
3. **Keep level expands the buildable castle grid.** A higher `keep` unlocks more castle
   tiles/slots — a long-arc progression hook centered on one prestige building. Implication:
   castle grid capacity is a function of `keep` level; the keep is the first thing you
   invest in and gates how elaborate a fortress you can design.
4. **Repair is a player action costing resources** (stone/iron), sped up by
   `rapid_repair` research + `castle_smithy`. Sieges have a real economic aftermath — a
   lost defense isn't free to rebuild. Implication: add a `repair` command; damaged
   fortifications persist in state at reduced health until repaired.

## A.5 Still-open balance knobs (tune later, don't block build)
- Exact keep-level → grid-size curve.
- Whether garrison assignment is per-tower (micro) or one castle-wide garrison number.
- Repair cost as a % of original build cost vs a flat per-damage formula.

## A.6 Design clarification — Village vs Castle
- **Village = economy engine.** Holds production/housing/civic buildings. Today
  rearranging it is largely cosmetic; an *optional later idea* is to make village layout
  mechanical (adjacency bonuses, districts) — not committed.
- **Castle = defense engine.** Spatial layout here *does* matter for sieges (the breach-
  lane model below). This is the home of tactical defensive strategy.
- Net: the two screens have distinct jobs — grow the economy in the village, design the
  fortress in the castle. AI keeps mirror this (they have economies *and* castles).

---

# Appendix B — Phase 1 detail (scaling AI rivals)

How the AI becomes a real, scaling opponent. All of this lives in `src/sim` (pure,
deterministic, tested). Today `aiTurn` (`src/sim/territory.ts:118`) only grabs bordering
tiles using a flat `factionAttackPower`; there is no AI economy, growth, or real siege.

## B.1 AI state model (abstract, cheap)
Do **not** run a full player-sim per faction. Give each AI faction a compact state on
`GameState` (bump save version), advanced each AI turn:
- `economy` — a growing power/wealth score (drives everything else).
- `army` — abstract military strength → converted to a concrete troop mix for sieges.
- `fortLevel` — capital fortification strength (grows over time; used when the player
  attacks it).
- `archetype` — `turtle | aggressor | economic` (see B.3).
- `tilesOwned` is already derivable from `tileOwner`.

## B.2 Scaling to the player (fair, not punishing)
- **Player progression index `P`** = a blend of rank/tiles + total research ranks +
  field-army power + castle strength. One number summarizing "how strong is the player."
- **Target band:** each AI aims for strength ≈ `P × bandFactor(archetype, difficulty)`.
  Passive players see AI drift *slightly* ahead (pressure); active players stay ahead.
- **Rubber-banding with fairness limits:** AI growth rate adjusts toward its target band
  but is **capped** — it can't spike absurdly if you sprint, and there's a **floor** so a
  dominant player still faces token resistance. All constants in `config/balance.json`.
- **No wipeouts:** player capital remains unconquerable (already true).

## B.3 Personalities (distinct, from `archetype` + `difficulty`)
| Archetype | Economy | Aggression | Forts | Feel |
|---|---|---|---|---|
| **Turtle** | medium | low (rarely attacks player) | **high** (hard to crack) | a tough nut you choose to crack |
| **Aggressor** | low–med | **high** (raids player land, sieges back) | medium | the rival that keeps you defending |
| **Economic** | **high** (snowballs if ignored) | low early, rises with size | medium | ignore it and it becomes the runaway threat |

Difficulty (the existing `difficulty` field) scales each archetype's magnitudes.

## B.4 AI actions each turn
On the existing AI-turn interval (`balance.conquest.aiTurnTicks`), each living faction:
1. **Grows economy** (per archetype) and reinvests into `army` / `fortLevel`.
2. **Expands** into neutral border land (already exists) — and **wars rival factions**
   over contested neutral land so the map evolves on its own.
3. **Pressures the player:** aggressors launch **real sieges** at the player (reuse
   `resolveSiege`, produce a Chronicle report the player can read) rather than silently
   flipping a tile. Seizing a tile requires actually beating the player's defense.
4. Defends: a faction under pressure shifts investment toward `fortLevel`.

## B.5 Turning abstract AI strength into a real siege
When the player attacks an AI capital/tile, or an AI attacks the player, convert the
faction's `army`/`fortLevel` into a concrete `SiegeDefender` (garrison troop mix +
fortifications) on the fly, scaled by `difficulty` and current strength — then run the
**existing deterministic `resolveSiege`**. This reuses the real combat model (B.6) for
both directions and keeps everything seed-deterministic.

## B.6 The combat model (answers "is it just bigger army?")
**No.** The current resolver already encodes tactics; Phase 1 *feeds* it scaling inputs,
it doesn't replace it:
- **Walls gate the assault.** No siege engines ⇒ **cannot breach**, repelled by tower
  archers regardless of army size (`siege.ts:111`).
- **Siege engines vs wall HP** sets breach rounds; longer breach ⇒ more **tower-archer
  attrition** on the approach (`siege.ts:118`).
- **Role counters** = +25% vs countered roles (`siege.ts:64`); composition matters.
- **Home-ground edge** = defenders +10% in the field battle (`siege.ts:65`).

So victory needs the *right army* (siege engines + counters + enough mass), not just the
*biggest*. **What's missing today: spatial layout** — forts are summed into one `fortHP`
(`siege.ts:93`), so *where* you place towers/walls doesn't matter yet. That tactical
**breach-lane** layer is **Phase 3** (castle), and AI castles will use the same layout
system once it exists. For Phase 1 we keep the aggregate model and make AI fort/garrison
*scale*; Phase 3 makes both sides' layouts *positional*.

## B.7 Anti-frustration & readability
- **Telegraphing:** scouting (Phase 2) and/or Chronicle warnings hint at incoming
  aggression so attacks aren't unreadable surprises.
- **Cooldowns:** cap how often any one faction can siege the player so you're pressured,
  not swarmed.
- **Clear Chronicle reports** for every AI action (who, what, outcome, losses) — the
  player should always understand *why* the map changed.

## B.8 Determinism, offline catch-up, saves
- AI uses the existing seeded RNG stream — fully deterministic and replayable.
- AI turns advance during **offline catch-up** the same as the rest of the sim, so the
  world legitimately moves while you're away (capped/credited like other progress).
- Extending `GameState` ⇒ **bump the save version** and handle migration of old saves.

## B.9 Phase 1 missing-details checklist (resolve while building)
- [ ] Exact formula/weights for the player progression index `P`.
- [ ] `bandFactor` curves + rubber-band caps/floor per difficulty (tune via headless sim).
- [ ] Mapping from abstract `army`/`fortLevel` → concrete troop mix & fortifications.
- [ ] AI-vs-AI resolution: full `resolveSiege` or a cheap abstract clash? (lean cheap).
- [ ] Siege cooldown + max simultaneous threats against the player.
- [ ] Loot/consequences when AI wins vs the player (and when player wins vs AI).
- [ ] Save-migration path for existing saves.
- [ ] Golden-state tests: deterministic growth; scaling stays in band over a long game;
      no runaway loops; AI-vs-player and player-vs-AI sieges resolve consistently.

---

# Appendix C — The layered model (the unifying frame)

The realization that "everything falls into layers." The game is **concentric rings
radiating from your home tile (15,19)**, and every system is a layer that stacks onto
those rings. This is the spine that ties AI, research, rank, and geography together.

## C.1 Geographic difficulty rings (already true in the data)
Difficulty already correlates with distance from home — the map is a natural ladder:

| Ring | Rivals (difficulty) | Distance | Role in the arc |
|---|---|---|---|
| **Inner** | Stormhold (1), Westvale (1), Highfort (1) | ~6–9 | Tutorial rivals — first conquests |
| **Mid** | Eastmarch (2), Greyfen Keep (2) | ~11 | The step-up after you've grown |
| **Outer** | Ironcliff (3), Dunhollow (3) | ~13–16 | Real tests; need research + a real army |
| **Far** | Southport (4), Brookmere (4) | ~15–19 | Endgame powers; rivals for the Crown |

You expand outward ring by ring; the Crown (`territory.ts`) sits at the end of the push.

## C.2 Rival archetype assignments (B.3 archetypes mapped onto the ladder)
A balanced spread (3 turtle / 3 aggressor / 3 economic) so every ring teaches something:

| Rival | Diff | Archetype | Why / what it teaches |
|---|---|---|---|
| **Stormhold** | 1 | Aggressor | Closest rival → early raids teach you to *defend* |
| **Westvale** | 1 | Economic | Ignore it and it snowballs → teaches you to *act* |
| **Highfort** | 1 | Turtle | Low-stakes walled keep → teaches you to bring *siege engines* |
| **Eastmarch** | 2 | Aggressor | Sustained mid-game pressure on your north |
| **Greyfen Keep** | 2 | Turtle | "Keep" by name & nature — a tougher nut |
| **Ironcliff** | 3 | Turtle | Hard fortress; needs real siege tech to crack |
| **Dunhollow** | 3 | Economic | Distant snowballer; a race if left alone |
| **Southport** | 4 | Aggressor | Strong late raider from the far west |
| **Brookmere** | 4 | Economic | The runaway northern power — the Crown rival |

(These set each faction's `archetype`; `difficulty` scales the magnitudes — see B.3.)

## C.3 Research is the layer that unlocks each ring
The progression tree isn't separate from the AI — it's the **key that opens the next
ring**. Each ring has a "gateway" capability the tree provides:

| To handle... | You need research in... | Branch |
|---|---|---|
| Turtle keeps (Highfort, Greyfen, Ironcliff) | **siege engineering** (rams/trebuchets/towers) | siege_engineering (App. A.2) |
| Aggressors raiding you (Stormhold, Eastmarch, Southport) | **castellany / fortification** (survive sieges) | castellany (App. A.2) |
| Economic snowballers (Westvale, Dunhollow, Brookmere) | **economy** (out-grow them) + military mass | economy / military |
| Seeing far rivals before you commit | **scouting** (Phase 2 fog of war) | logistics |

So the build order *is* the strategy: you research toward the ring you want to push next.

## C.4 The full layer stack
Reading the game top to bottom, every layer reinforces the rings:

```
Rank ladder (Peasant → King)      ── your title rises as you push outward
        ▲
Territory / the Crown             ── owning rings; the Crown ends the arc
        ▲
AI rivals (archetypes + scaling)  ── populate each ring; stay tense as you grow
        ▲
Research tree (gateway techs)     ── unlocks the tools for the NEXT ring
        ▲
Castle (defense) + Army           ── what you bring to each ring's fights
        ▲
Village economy                   ── the engine that funds all of it
        ▲
Geography (concentric rings)      ── the board the whole arc plays out on
```

## C.5 Design implications (carry into building)
- **Tune rings to gate on research,** not just raw army size — an under-teched player
  bounces off a ring (good: it sends them back to the tree), a teched player breaks
  through (good: progression feels earned).
- **Place "gateway techs"** in the tree that visibly correspond to rings (e.g. a siege-
  engine tier that's clearly "the thing that lets you take Highfort").
- **AI scaling (B.2) keeps each ring tense** so even a re-visited inner ring isn't
  trivial if you dawdled — the rings live and grow, they're not static checkpoints.
- This frame should guide content tuning in Phase 4 and the world growth in Phase 6
  (more rings = bigger world, same model).

---

# Appendix D — Scaling the world (bigger map & more opponents)

Planned because the player intends **many more opponents and a much bigger map**. Goal:
make the world *grow without rework* — adding rivals or enlarging the map should be data,
not code, and stay auto-balanced via the ring model (Appendix C). **Design Phase 1's AI
for N opponents from day one**, even though we ship with 9.

## D.0 Blocker found: the world generator is missing
`content/world.json` says it was *"Generated by tools/genworld.py"* — but **`tools/` is
not in the repo.** So there is currently **no reproducible way to make a bigger map.**
First scaling action: **recreate & commit a world generator** (`tools/genworld.*`) that
emits a schema-valid `world.json`. Without it, bigger maps mean error-prone hand-editing
of ASCII land rows.

## D.1 Derive difficulty & archetype from geography (don't hand-author per rival)
Today each rival hand-sets `difficulty`, `garrison`, `fortifications`. That doesn't scale
to dozens. Replace with **rules computed from position**:
- **Difficulty = ring(distance from home).** `difficulty = clamp(ceil(dist / RING_WIDTH),
  1, MAX_DIFF)`. Any new rival is auto-tiered by where it sits — drop a point on the map
  and it's balanced.
- **Archetype by rule.** Either rotate turtle→aggressor→economic across rivals in a ring,
  or weight by ring (more aggressors near home to teach defense, more economic far out as
  Crown rivals). Deterministic from rival index/position.
- **Garrison & forts derived from difficulty** via a formula (the current data already
  follows a clean difficulty curve — see the 9 rivals — so codify that curve and drop the
  hand-authored lists). Keep optional per-rival *overrides* for hand-placed "named"
  bosses.

Net: **adding an opponent = adding one `{id, name, tile}`** (or letting the generator
scatter them); everything else is computed.

## D.2 Map representation & growth
- Keep the ASCII `land[]` rows as the canonical format (simple, diffable, engine-agnostic)
  — but **generate** it, don't hand-edit it at scale.
- **Generator options for bigger maps:**
  - *Authored landmass* (like the current GB+Ireland) — a script that rasterizes a shape
    to ASCII at a chosen resolution.
  - *Procedural* — noise-based coastlines/islands for arbitrary size (good for the MMO map
    in Phase 6).
- The generator also **places rivals**: scatter `N` capitals on land with a **minimum
  spacing**, guarantee a clear inner ring around the player's start, then let D.1 assign
  difficulty/archetype/garrison.

## D.3 Make sure the sim is already N-proof (audit)
Mostly good today — confirm and protect:
- `factions` is built from `world.aiVillages` (dynamic ✓); `aiTurn` iterates all factions
  (✓); Crown threshold is a **proportion** of total land (`kingThresholdPct`), so it
  scales with map size automatically (✓).
- **Faction color palette** currently cycles a 6-color list — fine for dozens (colors
  repeat) but consider a generated palette for clarity on big maps.
- **Phase 1 AI state** (`AiVillageState`, today just `lootedUntilTick`) must be **keyed by
  faction id** and created lazily for *any* number of rivals — no fixed-size assumptions.

## D.4 Performance considerations for big maps
- `tileOwner` is a `"x,y" → id` map and `landTiles()` is cached — fine, but fog-of-war
  (Phase 2) adds a per-tile visibility entry: keep it sparse (store only non-default).
- `aiTurn` cost ~ O(factions × border tiles); with many factions, cap per-turn work or
  stagger factions across turns so a tick stays cheap on a phone.
- Map render (SVG) at large sizes: consider viewport culling / simplification when the
  grid is big.

## D.5 Phasing the world growth
1. **Now:** recreate + commit the generator; keep the current ~9-rival GB map as the
   authored default.
2. **Phase 1–4:** build the AI/rings/research against the *rules* (D.1) so opponent count
   is just a parameter.
3. **Phase 6 (MMO):** generate a large procedural world; real players + AI fill rings;
   same ring/archetype model, more rings.

## D.6 Schema/data changes implied
- `AiVillageDef`: make `difficulty`/`garrison`/`fortifications` **optional** (computed if
  absent; explicit values act as overrides). Add optional `archetype`.
- Add a `worldGen`/balance block for `RING_WIDTH`, `MAX_DIFF`, archetype-by-ring weights,
  rival count, min-spacing.
- Bump save version when AI state grows (shared with Phase 1, App. B.8).

## D.7 First steps (the actionable list for "scaling the world")
1. Recreate & commit `tools/genworld.*` producing a schema-valid `world.json`.
2. Codify the difficulty/archetype/garrison **rules** (D.1) in `src/sim` + `config`.
3. Make `AiVillageDef` fields optional + add `archetype`; regenerate the current map
   through the new pipeline to prove parity with today's hand-authored one.
4. Add a tiny test: a generated 9-rival map matches the current ring/archetype intent.

---

# Appendix E — World generator spec (D.7 step 1)

A reproducible, seeded generator that emits a schema-valid `content/world.json`. Replaces
the missing `tools/genworld.py`. **Must reproduce today's 9-rival GB map** (parity gate)
*and* scale to large maps with many rivals.

## E.1 Language & integration
- Write it in **TypeScript** under `tools/genworld.ts` (not Python) so it reuses
  `src/sim/types.ts` (schema), `src/sim/rng.ts` (the existing deterministic PRNG), and
  the difficulty/garrison rules — one source of truth, no drift.
- Run via `npm run genworld -- --seed 1 --size 22x32 --rivals 9 --out content/world.json`.
- Output is validated against `WorldDef` before writing; a test round-trips it.

## E.2 Inputs (CLI / config)
| Param | Meaning | Default (reproduces today) |
|---|---|---|
| `seed` | PRNG seed → fully deterministic map | fixed value chosen to match current map |
| `size` | grid `w x h` | `22x32` |
| `mode` | `authored` (rasterize a base shape) or `procedural` (noise) | `authored` (GB+Ireland) |
| `rivals` | number of AI capitals | `9` |
| `homeTile` | player start | `15,19` |
| `ringWidth` | tiles per difficulty ring | tuned so the 9 rivals land on diff 1–4 |
| `maxDiff` | max difficulty | `4` |
| `minSpacing` | min tiles between capitals | tuned to current spread |
| `homeClearR` | radius around home kept rival-free | small (protect the start) |

## E.3 Algorithm
1. **Land** — `authored`: rasterize the canonical GB+Ireland shape to ASCII `#`/`.` at the
   requested resolution. `procedural`: seeded value-noise → threshold → keep the largest
   connected landmass → smooth coastline. Output `land[]` rows + `gridSize`.
2. **Home** — place `player.tile` (default `15,19`); verify it's land.
3. **Scatter rivals** — Poisson-disk-style sampling on land tiles: reject points within
   `minSpacing` of another capital or within `homeClearR` of home, until `rivals` placed.
   Seeded → deterministic. (For parity, a fixed seed reproduces the current 9 positions;
   or pin them via an override list — see E.6.)
4. **Assign per rival from geography** (the D.1 rules, formalized in E.4/E.5).
5. **Validate & write** `world.json`.

## E.4 Difficulty & garrison formulas (reverse-engineered from the current 9 rivals)
These exactly reproduce the existing hand-authored data, so they're the canonical rules:

- **Difficulty:** `diff = clamp(ceil(distanceFromHome / ringWidth), 1, maxDiff)`.
- **Garrison by difficulty `d`:**
  - spearman = `4 + 5·d`  → d1:9, d2:14, d3:19, d4:24 ✓
  - archer   = `3 + 4·d`  → d1:7, d2:11, d3:15, d4:19 ✓
  - swordsman = `3·d` if `d ≥ 2` else 0 → d2:6, d3:9, d4:12 ✓
  - horseman = `2·d + 2` if `d ≥ 3` else 0 → d3:8, d4:10 ✓
  - knight   = `4` if `d ≥ 4` else 0 → d4:4 ✓
- **Fortifications by difficulty `d`:**
  - wall level = `d` (d1→L1 … d4→L4) ✓
  - tower level = `d − 1` if `d ≥ 2` else none (d2→L1 … d4→L3) ✓

So higher rings unlock richer troop types *and* taller walls — the ring ladder is baked
into the numbers, and any new rival at distance X is auto-statted.

## E.5 Archetype rule (reproduces Appendix C.2 intent)
Deterministic, position-based, with a bias that teaches early and threatens late:
- Default: cycle `[aggressor, economic, turtle]` by rival index **sorted by distance**, so
  the inner ring gets one of each (defend / act / siege lessons), matching C.2.
- Optional ring bias for big maps: weight inner rings toward `aggressor`, outer rings
  toward `economic` (Crown rivals). A knob in config.
- Always allow explicit per-rival `archetype` overrides (E.6).

## E.6 Named-rival overrides (keep authored character)
The generator accepts an optional list of fixed rivals: `{id, name, tile?, difficulty?,
archetype?, garrison?, fortifications?}`. Provided fields override the computed ones;
omitted fields are computed. This is how we (a) pin the current 9 named keeps for parity,
and (b) hand-place special "boss" rivals on big procedural maps while everything else is
auto-generated. Names for auto-rivals come from a **name pool** (medieval place-name
parts) so large maps get plausible names without manual work.

## E.7 Parity gate (the definition of done for step 1)
- Running the generator with the default/override config produces a `world.json` whose
  rivals match today's positions, difficulties, garrisons, forts, and archetypes (C.2).
- A test asserts the generated structure equals the committed reference (or matches the
  rules for each rival). Only after parity do we trust it for bigger maps.

## E.8 Then: prove scale
Generate a `60x90`, 40-rival map with a new seed; confirm rings populate sensibly,
spacing holds, difficulties spread 1–`maxDiff`, and the sim loads & runs it unchanged
(the N-proof audit, D.3). That's the green light that the world can grow freely.

---

# Appendix F — Gateway techs & the concrete progression path

Ties Appendix A/C to the **real** research + troop ids in `content/`. The "build order is
the strategy" claim, made concrete: each ring is gated by specific techs.

## F.1 The critical gateway: siege engines
The resolver hard-blocks any breach with no siege engines (`siege.ts:111`) — pure
infantry/cavalry **cannot take a walled keep at any size.** Therefore:
- **`siegecraft`** (r3, military) → unlocks **`catapult`** (`vsFort 3.0`). This is the
  game's first hard gate: until you research it you can raid neutral tiles but **cannot
  conquer any rival keep.** Highfort (turtle, wall L1) is the tutorial target that
  teaches this lesson.
- **`trebuchets`** (r3) → unlocks **`trebuchet`** (`vsFort 3.5`) — the heavier breacher
  you need for outer/far rings (wall L3–L4 + towers).

## F.2 Counter logic (who beats whom)
From the troop data (`counters`): **ranged beats infantry**, **infantry (spear/pike)
beats cavalry**, **cavalry beats ranged** (`siege.ts:64` gives +25% vs countered roles).
Rival garrisons are infantry-heavy + archers, gaining cavalry/knights at high difficulty
(E.4). So the army you must field shifts by ring:

| To beat their... | Bring... | Gated by |
|---|---|---|
| spearmen/swordsmen (infantry) | archers / crossbowmen (ranged) | `archery`, `crossbows` |
| tower archers (ranged) | horsemen / knights (cavalry) | `knighthood`, `chivalry` |
| horsemen/knights (cavalry, high diff) | pikemen (infantry) | `pikes` |
| the walls themselves | catapults → trebuchets (siege) | `siegecraft`, `trebuchets` |

## F.3 The ring-by-ring gateway path
| Ring | Rivals (archetype) | Threat profile | Gateway research (in order) |
|---|---|---|---|
| **Inner (d1)** | Highfort (turtle), Stormhold (aggr), Westvale (econ) | wall L1, no towers | `militia`+`archery` (an army) → **`siegecraft`** (breach at all). For the aggressor: `masonry` (your own walls). |
| **Mid (d2)** | Eastmarch (aggr), Greyfen (turtle) | wall L2 + tower L1, swordsmen | `crossbows` (better ranged), `blacksmithing`, `fortification` (survive Eastmarch's raids), more catapults |
| **Outer (d3)** | Ironcliff (turtle), Dunhollow (econ) | wall L3 + tower L2, +horsemen | **`trebuchets`** (crack L3), `pikes` (vs their cavalry), `deep_mining`/`stonecutting` (fund siege trains), economy to out-race Dunhollow |
| **Far (d4)** | Southport (aggr), Brookmere (econ, Crown) | wall L4 + tower L3, +knights | `knighthood`+`plate_armor`+`chivalry` (elite army), trebuchet trains, `architecture`/`fortification` maxed (survive a diff-4 aggressor), strong statecraft economy |

So the tech tree literally reads as a conquest route: **militia → archery → siegecraft**
(take the first keep) **→ crossbows/fortification** (survive & push the mid ring) **→
trebuchets/pikes** (crack the outer ring) **→ knighthood/plate/chivalry** (contest the
Crown). An under-teched player bounces off the next ring — exactly the intended pressure
back into the tree (C.5).

## F.4 Logistics becomes a gateway on bigger maps
March time scales with distance (`balance.conquest.tileTravelPerTile`). On today's small
map this is minor, but on the **bigger maps (Appendix D/E)** reaching a far ring takes
real time, so **logistics techs become a genuine gateway**:
- `cartography`, `supply_lines`, `royal_roads` (march speed) — without them, far-ring
  campaigns are painfully slow and your armies are exposed in transit.
- `scouting`/`foraging` (Phase 2 fog of war) — you can't even *see* far rings until you
  invest in recon; on a big map this is the difference between blind marches and planned
  strikes.
This is a nice emergent result: **the bigger the world, the more the logistics branch
matters** — scaling the map automatically deepens an otherwise-minor branch.

## F.5 Implication for content tuning (Phase 4)
- Set research **prereqs/costs** so the gateway order above is the natural path (e.g.
  `trebuchets` should sit deep enough that it reads as an outer-ring unlock).
- Consider explicit prereq links (`siegecraft` before `trebuchets`) so the tree visibly
  encodes the ladder.
- When adding the 100+ nodes (Phase 4), slot each new node into a ring tier so the tree
  grows *with* the rings rather than as a flat blob.

---

# Appendix G — Phase 2 detail (fog of war & reconnaissance)

Turns scouting from a loot button into an **intel system** that hides the world until you
explore it — the feature that makes a big map (Appendix D/E) feel like discovery.

## G.1 What exists today (reuse, don't rebuild)
- A `scout` command (`sim.ts:480`) sends a march to "the wilds" and returns **loot**
  (`rollScoutLoot`, `sim.ts:143`); travel time scales with `scouting` rank + march speed
  (`scoutTravelTicks`, `sim.ts:156`).
- Marches are a general system (`kind: "assault" | "scout" | "conquer"`) with outbound/
  return phases — a scout-to-a-target reuses this directly.
- `scout_vision_flat` is a **defined-but-unused** effect type (`types.ts:39`) — the hook
  for vision range. `scout_yield_pct` already scales loot.
- **Gap:** no visibility state; all rivals' garrisons/forts are fully visible already.

## G.2 Visibility state model
Add a per-tile visibility map to `GameState` (sparse — store only non-`unknown`):
`visibility: Record<"x,y", { level: VisLevel; asOfTick: number }>`.

| Level | The player sees | How obtained |
|---|---|---|
| `unknown` | nothing (dark tile) | default |
| `explored` | terrain + owner (faction name/color) | passive: tiles adjacent to owned land; cheap scouting |
| `scouted` | + **fuzzed** garrison & fort strength (ranges) | a scout expedition to the target |
| `surveilled` | + exact garrison, fort layout, economy estimate | repeated/deep scouting; high rank |

**Decay:** intel ages. After `intelFreshTicks`, a `surveilled`/`scouted` tile drops one
level (data goes stale) so recon is ongoing, not one-and-done. `asOfTick` drives a
staleness indicator in the UI.

## G.3 Scouting as a scaling action
- Extend the `scout` command with a **target** (`tile:x,y` or a faction capital), not just
  "wilds". Outbound march → on arrival, raise that target's visibility level → return.
- **Difficulty scales with the ring (reuses E difficulty):**
  - Inner/neutral tiles: easy — one cheap scout reaches `scouted`/`surveilled`.
  - Outer/far enemy capitals: **hard** — deeper intel needs higher `scouting` rank, more
    scouts, or repeated trips; high-difficulty targets can **partially fail** (you get
    only fuzzed `scouted`, not `surveilled`) or get scouts **caught** (lose the cost,
    optionally alert/anger the rival).
  - Success roll is deterministic (seeded RNG) vs a target difficulty derived from the
    ring and the rival's `fortLevel`.
- **Progression hooks:** `scouting` rank → vision range (wire up `scout_vision_flat`),
  intel accuracy (less fuzz), travel speed, and success vs hard targets. `foraging`
  remains the loot-flavored branch.

## G.4 Fuzzing (so partial intel feels real)
At `scouted`, report **ranges** not exact numbers (e.g. "~15–20 spearmen", "walls: strong")
derived deterministically from the true value ± a band that **shrinks with `scouting`
rank**. At `surveilled`, report exact values. Fuzz is seeded so re-reads are consistent
until intel refreshes.

## G.5 Integration with the rest of the design
- **Pre-siege planning:** the assault screen reads current intel; attacking a merely
  `explored` keep is a gamble (you don't know their garrison) — strong incentive to scout
  first, and a real use for the logistics branch (F.4).
- **Bigger map:** far rings start `unknown`; the map literally lights up as you expand —
  discovery is the carrot that pulls you outward through the rings.
- **AI awareness (optional later):** rivals could have their own intel on you, gating when
  aggressors decide to strike — keep simple for now.

## G.6 UI
- World map: `unknown` tiles dark/blank; `explored` show owner color; `?` markers on
  unscouted enemies; staleness shading on aging intel.
- Target panel shows **only what's known**, with confidence ("intel 3 days old").

## G.7 Tests
- Visibility transitions + decay deterministic; fuzz band shrinks with rank; hard-target
  success scales with ring/rank; pre-siege screen uses the right (possibly stale) data.

## G.8 Build order note
Phase 2 pairs naturally **right after Phase 1** (smarter rivals are more interesting when
you must scout to learn about them) and **before the big-map work pays off** — but it
depends only on the march system that already exists, so it can also be built
independently if desired.

---

# Appendix H — Phase 1 implementation checklist (start here at home)

Concrete, ordered, each step independently testable + committable. File targets are real.
Keep all logic in `src/sim`; run `npm test` after each step. Bump `schemaVersion`
(currently a field on `GameState`, `types.ts:185`) the first time state shape changes, and
handle old-save migration in `src/host/persistence.ts`.

### Step 1 — Codify the rules (no behavior change yet)
- New `src/sim/rivals.ts`: pure functions
  `difficultyFor(distance)`, `garrisonFor(difficulty)`, `fortsFor(difficulty)`,
  `archetypeFor(index)` — using the **E.4/E.5 formulas**.
- Test: for each of the 9 current rivals, `garrisonFor`/`fortsFor` equal the values in
  `content/world.json` (locks parity).
- Commit: "Add rivals.ts: geography-derived difficulty/garrison/archetype rules".

### Step 2 — Make rival data optional + archetype-aware
- `types.ts AiVillageDef`: make `difficulty?`, `garrison?`, `fortifications?` optional; add
  `archetype?: "turtle" | "aggressor" | "economic"`.
- `content.ts`: when building `factions`, fill missing fields via `rivals.ts`; apply the
  C.2 archetype assignments (or compute via `archetypeFor`).
- Test: derived factions still match today's 9. Commit.

### Step 3 — Extend AI state (save bump)
- `types.ts AiVillageState`: add `economy: number; army: number; fortLevel: number;`
  (keep `lootedUntilTick`). Initialize per faction from its difficulty.
- Bump `schemaVersion`; migrate old saves in `persistence.ts` (default the new fields).
- Test: load an old-shape save → fields defaulted, no crash. Commit.

### Step 4 — AI economic growth
- `territory.ts aiTurn`: each living faction grows `economy` per archetype (B.3) and
  reinvests into `army`/`fortLevel`, **clamped toward the player-scaled band** (B.2).
- New `src/sim/aiScaling.ts`: `playerProgressionIndex(state)` + `targetBand(archetype,
  difficulty, P)` + rubber-band caps/floor. Constants in `config/balance.json`.
- Test: deterministic growth; over a long simulated game strength stays in band; no
  runaway. Commit.

### Step 5 — Convert abstract strength → real defender
- `rivals.ts` (or `aiScaling.ts`): `defenderFor(faction, state)` → `{garrison, forts}`
  scaled by current `army`/`fortLevel` (not just static difficulty). Use it in
  `defenderForTile` (`territory.ts:83`) so attacking a grown rival is genuinely harder.
- Test: a rival that has grown yields a tougher `SiegeDefender`. Commit.

### Step 6 — AI sieges back at the player
- `territory.ts aiTurn`: aggressors (and pressured factions) launch a **real** assault on
  a player border tile via `resolveSiege` (build the attacker army from `army`), produce a
  `SiegeReport` + Chronicle log, apply outcome (seize tile only on a real win, with
  losses). Respect a **cooldown** + max simultaneous threats (B.7).
- Test: an aggressor with enough strength can take a weakly-defended border tile via a
  resolved siege; capital stays unconquerable; cooldown respected. Commit.

### Step 7 — AI-vs-AI (cheap)
- `aiTurn`: factions contest neutral border land with each other via an **abstract** clash
  (compare strengths + seeded roll), not a full siege — so the map evolves without cost.
- Test: over time, ownership shifts between AIs deterministically. Commit.

### Step 8 — Offline catch-up + polish
- Verify AI turns advance correctly through offline catch-up (`persistence.ts` time
  bridge) and remain deterministic across a save/load mid-campaign.
- Chronicle/log readability pass for all new AI actions. Commit.

### Definition of done (Phase 1)
A passive player gets visibly pressured by aggressors; ignored economic rivals snowball;
turtles are tough until you bring siege engines; the map evolves on its own; everything is
deterministic and covered by golden-state tests. Then move to **Phase 2 (Appendix G)**.

> Note: the world generator (Appendix E) is **not required** for Phase 1 — it works on the
> current 9-rival map. Build the generator when you actually want the bigger map; Steps 1–2
> here make that a clean drop-in because rival data is already rule-derived.

---

# Appendix I — Phase 1 starting balance constants

Concrete first numbers so Steps 4/6 aren't blocked on guessing. **All "tune via headless
sim" — these are sane starting points, not final.** Today's `conquest` block:
`aiTurnTicks: 240`, `kingThresholdPct: 0.33`, `tileTravelPerTile: 12`,
`patrolPerDifficulty: 3`. Garrisons run ~9–24 troops (E.4); use that as the strength scale.

## I.1 Proposed `aiScaling` block (add to `config/balance.json`)
```jsonc
"aiScaling": {
  // "Strength" is measured like factionAttackPower today (~6 + tiles*1.5 + diff*6),
  // and the player index P uses the same scalar (see I.2).
  "bandFactorByArchetype": {        // AI targets strength ~= P * this
    "turtle":    0.85,              // weaker offense, but invests in forts (I.3)
    "aggressor": 1.05,              // a step ahead in army to actually pressure you
    "economic":  1.00               // tracks you, snowballs if you stall (I.3)
  },
  "difficultyBandBonus": 0.08,      // + per difficulty level above 1 (far rings tougher)
  "bandFloor": 0.45,               // even a dominant player faces this * P resistance
  "bandCeil": 1.6,                 // AI can't exceed this * P (anti-frustration cap)
  "maxStrengthDeltaPerTurn": 0.06, // max fractional strength change per AI turn (smooth)
  "reinvestSplit": {                // how grown economy is spent, by archetype
    "turtle":    { "army": 0.35, "fort": 0.65 },
    "aggressor": { "army": 0.75, "fort": 0.25 },
    "economic":  { "army": 0.50, "fort": 0.50 }
  },
  "economyGrowthPerTurn": {         // base economy gain per AI turn, by archetype
    "turtle": 0.6, "aggressor": 0.5, "economic": 0.9
  },
  "siege": {
    "playerSiegeCooldownTurns": 6,  // min AI-turns between sieges vs the player (per faction)
    "maxSimultaneousThreats": 2,    // max factions actively sieging the player at once
    "minStrengthToSiege": 0.9       // faction must be >= this * (player border defense) to try
  }
}
```

## I.2 Player progression index `P` (starting formula)
A single scalar summarizing player strength, comparable to faction strength:
```
P = tilesOwned * 1.5
  + totalResearchRanks * 0.8
  + fieldArmyPower * 1.0          // sum over troops of count*(atk+def)*0.5 (matches territory.ts)
  + castleDefensePower * 0.5      // playerDefensePower() (territory.ts:97), once castles exist
  + 6                            // base, mirrors factionAttackPower's constant
```
Weights are the first knobs to tune; keep P in the same units as `factionAttackPower` so
`bandFactor * P` is directly comparable to a faction's strength.

## I.3 How the archetypes feel with these numbers
- **Turtle (0.85 band, 65% into forts):** lower attack power than you, but `fortLevel`
  climbs — so it rarely raids you yet becomes a *hard keep to crack* (needs siege engines,
  F.1). Matches "a tough nut you choose to crack."
- **Aggressor (1.05 band, 75% into army):** stays a touch ahead in offense and spends on
  army → actually launches sieges at you (Step 6), throttled by the cooldown so it
  pressures without swarming.
- **Economic (1.00 band, 0.9 growth):** highest economy growth → if you stall, it drifts
  toward `bandCeil` and becomes the runaway Crown threat (Brookmere). Punishes passivity.

## I.4 Tuning method (Phase 4, but note now)
Build a tiny **headless harness** (run the sim N turns with no UI, log P and each
faction's strength over time). Verify: factions track inside `[bandFloor, bandCeil] * P`;
no runaway; a passive player is overtaken within a believable window; an active player
stays ahead. Adjust the I.1 constants from those curves.
