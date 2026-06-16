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

## Phase 3 — Loads more progression

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
- **Deeper siege:** more fortification types, watchable replay of the auto-resolve.

**Done when:** there's a satisfying multi-week progression arc with prestige beyond it,
and the political/boost systems are live in single-player.

---

## Phase 4 — Better design & feel (still web)

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

## Phase 5 — Bigger world → Multiplayer (MMO)

**Goal:** Your roadmap's M4 — turn the single-player world persistent and shared.

- **Cheap first:** bigger map, more factions, richer neutral world — all in-sim.
- **Then the real lift:** authoritative **server running the same sim core** (the
  determinism we protected in Phases 1–2 is what makes this possible); command
  validation/anti-cheat; persistence DB; region/world matchmaking; real players replace
  local AI (AI fills empty space). Layer the political/boost systems server-side.

**Done when:** multiple real players share a persistent, server-authoritative map with
live economy, sieges, and recon.

---

## Phase 6 — Unity packaging (optional, later)

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
Phase 2 (fog/recon)  ─┼─ web, parallelizable, all reversible
Phase 3 (progression)┘
        │
Phase 4 (design/feel) ── art lock on web
        │
Phase 5 (bigger world → MMO)
        │
Phase 6 (Unity packaging, optional)
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
