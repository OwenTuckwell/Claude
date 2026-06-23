# 06 — Handoff & Pickup

Where things stand at the end of the planning session, and exactly how to resume on
another machine. Read this first when you come back.

## Status: most of the plan is BUILT & live

The design for taking *Bannerfall* "BIG" is written, and a large build effort has shipped
most of it — scaling AI, fog of war, a bigger world, the village progression spine, the
prestige system, a real art/visual overhaul, and the balance harness. Table reflects
what's actually live. Save schema is at **v13**. Tests: **36 passing** (`npm test`).

### Plan vs. Built
| Thing | Designed? | Built & live? | Where it's specced |
|---|---|---|---|
| Colour palette + **full visual overhaul** (38 building sprites, painted scene backdrops, landscape-first UI w/ resource rail + nav rail + pop-out drawers) | ✅ | ✅ | `art-style.md`, R |
| **Isometric rendering** — IsoBoard, sprites, pinch-zoom/pan, drag-to-place buildings | ✅ | ✅ | Appendix R |
| **Bigger map** + more opponents (38×54, ~736 tiles, 20 rivals) | ✅ | ✅ | Appendix D, E, N |
| **Border-based travel** + realm **slowdown** (sprawl/scaling defenders) | ✅ | ✅ | D/E + roadmap |
| Scaling **AI** rivals — archetypes + rubber-band + two-way sieges | ✅ | ✅ | Appendix B, C, I |
| **Fog of war** / scouting (intel levels, scout-a-tile, fuzzed intel) | ✅ | ✅ | Appendix G |
| Home **castle** — defence view + **layout designer** (grid) | ✅ | ✅ (first pass) | Appendix A, L |
| **Village progression** — Town Hall spine + tier-gated build list | ✅ | ✅ | Appendix S, T |
| **Active→idle economy** — idle income gated by Stewardship (10%→50%), storage a real gate | ✅ | ✅ | Appendix S |
| **Prestige** — Renown & Banner Ranks + perks (RenownTab) | ✅ | ✅ | Appendix M |
| **Balance harness** — long-run invariant tests (`balance.test.ts`) | ✅ | ✅ | Appendix Q |
| Save migration (v13, preserves village, resets world-coupled fields) | ✅ | ✅ | Appendix O |
| 7 new buildings + research (vineyard, banquet hall, arena, stables, training grounds, weaponsmith, armoury) | ✅ | ✅ | — |
| Research-tree cleanup (per-category tree + pop-out) | ✅ | ✅ (re-tier vs gateway pending) | Appendix K |
| Tap/market scaling (rank-scaled + soft cap) | ✅ | partial (market is the early engine; explicit J scaling pending) | Appendix J |
| Spatial breach-lane siege resolution | ✅ | ❌ not coded (castle layout designed, resolver still aggregate) | Appendix L |
| Politics (parishes/sheriffs) · steward boosts | ✅ | ❌ not coded | Appendix M |
| Onboarding / tutorial | ✅ | ❌ not coded | Appendix P |
| Procedural land-gen + name pool | ✅ | ⚙️ generator exists (`tools/genworld.py`) | Appendix E, N |

> Castle is a **first pass** (defence + layout designer). The deeper Appendix A/L castle
> (separate `castleQueue`, keep-gated grid, Castellany branch, *spatial* breach-lane siege
> resolution) is still to do.

## The plan, in one place
- **`docs/05-scaling-roadmap.md`** — 7 phases + appendices A–T. Start at the **Contents**
  section. Most of the early phases are now built (see the table above).
- **`docs/art-style.md`** — palette (hex), perspective, the AI-asset prompt template.
- **`docs/asset-pipeline.md`** — Blender vs AI gen, free CC0 packs, render-to-sprite.
- **`docs/art-prompts.md`** / **`docs/art-checklist.md`** — per-sprite prompts + which art
  is live vs vector-fallback.

## Live prototype
- **https://OwenTuckwell.github.io/Claude/?v=50** (bump the `?v=` number if your phone
  shows a stale cached version). Auto-redeploys ~2 min after every push to the branch.
  Landscape-first — rotate the phone to play.

## Build & test (Node is installed — v26)
Always build/test locally before pushing, or you risk white-screening the live site.
- `npm install` (once per machine), `npm test` (36 tests), `npm run dev` (local preview),
  `npm run build` (strict type-check + production build).
- The balance harness lives in `src/sim/balance.test.ts` (long-run invariant sims) — runs
  as part of `npm test`.

## Repo location
- Use **`C:\Dev\Claude`** (a plain local path, NOT inside OneDrive — OneDrive + git
  conflicts). On a fresh machine: `git clone https://github.com/OwenTuckwell/Claude.git C:\Dev\Claude`.
- Branch: `claude/stronghold-kingdoms-mobile-90pe4k`.

---

## Pickup prompt — paste this into Claude Code at home

```
I'm continuing my medieval strategy game "Bannerfall". Repo:
https://github.com/OwenTuckwell/Claude.git, branch
claude/stronghold-kingdoms-mobile-90pe4k

Get set up and caught up:
1. Clone to C:\Dev\Claude (a PLAIN local path, NOT OneDrive). If it already exists, cd in
   and `git pull` instead.
2. `npm install`, then `npm test` (36 tests) and `npm run build` to confirm green.
3. Read docs/06-handoff-and-pickup.md (the status + Plan-vs-Built table), then
   docs/05-scaling-roadmap.md (the plan — Contents, then appendices), docs/art-style.md.
4. Skim src/sim/ (the pure deterministic core): territory.ts (AI), siege.ts (combat),
   effects.ts (typed-effect modifiers incl. idle income), renown.ts (prestige),
   persistence.ts (saves, schema v13), types.ts (GameState). Then src/ui/ (IsoBoard,
   BuildingSprite, PanZoom, App, the tabs).

Context: A TypeScript+React prototype that's now substantially built — scaling AI, fog of
war, a 38×54 world, Town-Hall-gated village progression, active→idle economy, Renown
prestige, a full sprite/visual overhaul, and a balance harness are all LIVE (see the
Plan-vs-Built table). Still open: spatial breach-lane siege resolution (Appendix L),
politics/boosts (M), onboarding (P), explicit tap scaling (J).

Tell me what to work on. Good candidates: tune balance via the harness
(src/sim/balance.test.ts), polish the new landscape UI, or build the next unbuilt feature
above. Keep all game logic in src/sim, stay deterministic, run `npm test` + `npm run build`
after each change, and commit + push each step. When a change alters GameState shape, bump
SCHEMA_VERSION and extend migrate() in persistence.ts (Appendix O).
```

### Alt prompt — if you want ART next instead of code
```
Continue Bannerfall at C:\Dev\Claude (git pull first). Read docs/art-style.md. I want to
generate the first game art following that guide — start with the village buildings (farm,
woodcutter, quarry, house) using the AI prompt template, isometric, on the documented
palette. Produce a few options each and tell me how to drop them into the web build.
```
