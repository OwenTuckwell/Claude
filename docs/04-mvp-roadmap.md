# 04 — MVP Roadmap

Phased path from "design done" to a Unity-standard, cross-platform, eventually-MMO game.
Each milestone has a **goal**, **scope**, and a concrete **"done" definition**. The bet:
prove the core is fun cheaply (web) before paying for engine polish (Unity) or live
infrastructure (MMO).

---

## M0 — Design & Architecture ✅ (this effort)

- **Goal:** A coherent, buildable design foundation.
- **Scope:** `docs/00`–`04` + sample content data in `docs/data/`.
- **Done when:** systems are internally consistent (economy formulas use the same
  entities as the GDD; schemas match sample JSON), and the web→Unity→MMO path is clear.

---

## M1 — Web Vertical Slice (single-player, the fun test)

- **Goal:** Prove that one village + full economy + real research + a real siege is
  compelling, on a phone browser.
- **Scope:**
  - TS **simulation core** (`/sim`): resources, production/consumption, population &
    happiness (rations + tax dials), storage caps, build queue, research drip, troop
    training & upkeep, deterministic **siege auto-resolve** with log, offline catch-up.
  - **Content:** the `docs/data` slice expanded to ~12–20 buildings, ~20–30 research
    nodes across ≥3 branches, ~4–6 troop types.
  - **Web UI** (`/web`): village view (buildings + queue), resource/happiness HUD,
    research tree screen, military/training, a basic world map with a few AI villages,
    and a siege screen (layout + result log).
  - Save to localStorage/IndexedDB + export/import.
  - **Vitest** golden-state tests for the sim (determinism + catch-up).
- **Done when:** a player can, in a phone browser, grow a village, juggle rations/tax,
  unlock meaningful tech, train an army, and win/lose a siege vs. AI — and it's *fun for
  a day or two of check-ins*. **This is the go/no-go gate** for further investment.

---

## M2 — Content & Balance Pass

- **Goal:** Make the slice deep and well-tuned (the SHK "level of detail").
- **Scope:** expand content toward full breadth (more buildings, deeper research ranks,
  fear/benevolence happiness, luxuries, captains); build the **headless sim harness** to
  chart curves; tune constants to hit target time-to-milestone curves (`02 §8`); deepen
  siege (more fortification types, watchable replay).
- **Done when:** progression curves feel right over a 1–2 week play arc with no runaway
  loops or trivial exploits.

---

## M3 — Unity Port + Cross-Platform Builds

- **Goal:** The Unity-standard product across **Android, iOS, and Web (WebGL)**.
- **Trigger:** M1 passed the fun gate **and** M2 balance is stable enough that content
  isn't churning daily (porting against a moving target wastes effort).
- **Scope:** reuse all `docs/data` content + `config/balance.json` + save format +
  simulation spec; reimplement the **sim runner in C#** (verified against M1 golden-state
  tests) and the **presentation in Unity**; set up WebGL/Android/iOS export pipelines.
- **Done when:** the game runs on a real Android device, a real iOS device, and in a
  hosted WebGL build, with C#↔TS sim **parity verified** on identical command sequences.

---

## M4 — Multiplayer / MMO Backend

- **Goal:** Turn the single-player world into a persistent shared one.
- **Scope:** authoritative **server** running the same sim core; command
  validation/anti-cheat; persistence (DB); region/world matchmaking; replace local AI
  neighbours with real players (AI fills empty space); then layer in the **[Later]**
  political systems (parishes, sheriffs, alliances) and the **card/boost** economy using
  the existing typed-effect system.
- **Done when:** multiple real players share a persistent map with server-authoritative
  economy & sieges, and the political/social layer is live.

---

## Sequencing principles

- **Cheap validation before expensive commitment:** web slice (M1) before Unity (M3)
  before live infra (M4).
- **Never discard the expensive assets:** content data, sim spec, and save format are
  carried forward at every milestone; only runtime/runner/UI is re-implemented.
- **Each milestone is independently demoable** — there's always something runnable to
  show and play.
