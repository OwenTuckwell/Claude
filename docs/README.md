# Bannerfall — Design & Architecture

*Bannerfall* (working title) is an original mobile strategy game built to capture the
**depth and interacting systems** of Stronghold Kingdoms (PC) — a slow-paced,
persistent-world economic 4X — without being a clone of its IP, art, or specific content.

This folder is the **design foundation** (milestone **M0**). No game engine code is here
yet; this is what the prototype gets built against.

## Reading order

1. **[00-vision.md](00-vision.md)** — pitch, design pillars, target player, and what we
   deliberately defer (anti-scope).
2. **[01-game-design.md](01-game-design.md)** — the GDD: economy, population & happiness,
   research tree, military, the signature castle-siege combat, world map, and the
   social/politics layer. The system-interaction map shows *why* it has depth.
3. **[02-economy-and-balance.md](02-economy-and-balance.md)** — the numbers spine: tick
   model, production/consumption/happiness/cost/timer formulas, storage math, and a
   worked example proving the loop closes.
4. **[03-technical-architecture.md](03-technical-architecture.md)** — how we **start easy
   on the web (you host it)** and **migrate to a Unity-standard cross-platform build
   (Android + iOS + WebGL)** without throwing work away, and how **single-player** becomes
   **MMO** with no rewrite. Includes the content data schemas.
5. **[04-mvp-roadmap.md](04-mvp-roadmap.md)** — milestones M0→M4 with "done" definitions.
6. **[05-scaling-roadmap.md](05-scaling-roadmap.md)** — the "make it BIG" plan: scaling
   AI, fog-of-war scouting, castle development + the Castellany research branch, deep
   progression, 2.5D art/feel, MMO, and the (optional) Unity packaging step. Picks up
   where `04` leaves off.
7. **[art-style.md](art-style.md)** — the art style guide: perspective, palette (hex),
   tile specs, the AI generation prompt template, and the asset conformance checklist.
8. **[asset-pipeline.md](asset-pipeline.md)** — how to generate the art for free: Blender
   vs AI gen (Higgsfield), free CC0 packs (Kenney/Quaternius), the render-to-sprite trick,
   and next steps.
8. **[06-handoff-and-pickup.md](06-handoff-and-pickup.md)** — **READ FIRST when resuming.**
   Current status (design done, build just started), plan-vs-built table, and the
   copy-paste pickup prompt for another machine.

## Sample content data

[`data/`](data/) holds concrete, schema-conforming starter content that doubles as the
prototype's seed:

- [`data/buildings.sample.json`](data/buildings.sample.json)
- [`data/research.sample.json`](data/research.sample.json)
- [`data/troops.sample.json`](data/troops.sample.json)

These validate against the schemas in `03` and make the data-driven design tangible:
**adding game content is data entry, not code** — the key to reaching SHK-scale depth.

## The core architectural bet (TL;DR)

> Keep all **content + rules as engine-agnostic data + a deterministic simulation spec**.
> Build a cheap **web vertical slice** first to prove the fun, then port the thin
> runner/UI to **Unity** (which exports Web/Android/iOS). The expensive assets — content,
> sim spec, save format — carry forward at every step.

## Status

- **M0:** design & architecture — complete.
- **M1:** TypeScript simulation core + React/canvas web slice, single-player vs. AI —
  **playable** (see the repo root `README.md` to run it). Economy, happiness, research,
  troops, and deterministic sieges are implemented with a passing sim test suite.
- **Next (M2):** content breadth + balance pass. See `04-mvp-roadmap.md`.
