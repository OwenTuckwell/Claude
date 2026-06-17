# 06 — Handoff & Pickup

Where things stand at the end of the planning session, and exactly how to resume on
another machine. Read this first when you come back.

## Status: DESIGN complete, BUILD just started

The design for taking *Bannerfall* "BIG" is written and pushed. A **build session** then
shipped Phases 1–3 plus the world-scaling work. Table below reflects what's actually live.

### Plan vs. Built
| Thing | Designed? | Built & live? | Where it's specced |
|---|---|---|---|
| New colour palette (parchment/earthy) | ✅ | ✅ | `art-style.md` |
| **Bigger map** + more opponents (38×54, ~736 tiles, 20 rivals) | ✅ | ✅ | Appendix D, E, N |
| **Border-based travel** + realm **slowdown** (upkeep/sprawl/scaling defenders) | ✅ | ✅ | D/E + roadmap |
| Scaling **AI** rivals — archetypes (turtle/aggressor/economic) + rubber-band | ✅ | ✅ | Appendix B, C, I |
| **Fog of war** / scouting (intel levels, scout-a-tile, fuzzed intel) | ✅ | ✅ | Appendix G |
| Home **castle** development screen (defence rating + fortifications) | ✅ | ✅ (first pass) | Appendix A, L |
| **Village progression** — Town Hall spine + tier-gated build list + "next goal" bar | ✅ | ✅ | Appendix S, T |
| Tap/market scaling | ✅ | ❌ not coded | Appendix J |
| Research-tree cleanup | ✅ | partial (tree built, not re-tiered) | Appendix K |
| Prestige / politics / boosts | ✅ | ❌ not coded | Appendix M |
| Onboarding, save migration, balance harness | ✅ | ❌ not coded | Appendix O, P, Q |

> Castle is a **first pass** (defence view + fortification building). The deeper castle
> from Appendix A (separate `castleQueue`, keep-gated grid, Castellany research branch) is
> still to do. Save schema is at **v7**.

## The plan, in one place
- **`docs/05-scaling-roadmap.md`** — 7 phases + 18 appendices (A–R). Start at the
  **Contents** section, then **Appendix H** (the ordered Phase 1 build checklist).
- **`docs/art-style.md`** — palette (hex), perspective, the AI-asset prompt template.

## Live prototype
- **https://OwenTuckwell.github.io/Claude/?v=10** (bump the `?v=` number if your phone
  shows a stale cached version). Auto-redeploys ~2 min after every push to the branch.

## Before you build: install Node
Building features means changing TypeScript (sim + UI). You **must** be able to build/test
locally first, or you risk white-screening the live site.
- Install Node (the `node-v26.3.0-x64.msi` is in your Downloads, or get the latest LTS).
- Then in the repo: `npm install`, `npm test` (sim suite), `npm run dev` (local preview).

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
2. Confirm Node is installed (`node -v`). If not, tell me — I need it to build/test.
   Then run `npm install` and `npm test` to confirm the sim suite passes.
3. Read docs/06-handoff-and-pickup.md (the status), then docs/05-scaling-roadmap.md
   (the full plan — read the Contents, then the appendices), and docs/art-style.md.
4. Skim src/sim/ (the pure deterministic core): territory.ts (AI), siege.ts (combat),
   effects.ts (typed-effect modifiers), persistence.ts (saves), types.ts (GameState).

Context: This is an M1/M2 TypeScript+React prototype. We finished a complete design plan
(docs/05-scaling-roadmap.md, appendices A–R) but have only BUILT the new colour palette so
far. The map, castle, scaling AI, fog of war etc. are designed-not-coded. I want to START
BUILDING now.

Begin with **Appendix H** (Phase 1: scaling AI), Step 1: create src/sim/rivals.ts with the
geography-derived difficulty/garrison/archetype rules (formulas in Appendix E.4/E.5) plus a
parity test that the current 9 rivals match content/world.json. Keep all logic in src/sim,
stay deterministic, run `npm test` after each step, and commit + push each step. When a step
changes GameState shape, add the save-migration chain from Appendix O so saves aren't wiped.
Show me Appendix H's checklist and confirm npm test passes before you start coding.

(If I'd rather see something visual first, instead build one of: the bigger map, or the
castle screen — both are fully specced in the appendices.)
```

### Alt prompt — if you want ART next instead of code
```
Continue Bannerfall at C:\Dev\Claude (git pull first). Read docs/art-style.md. I want to
generate the first game art following that guide — start with the village buildings (farm,
woodcutter, quarry, house) using the AI prompt template, isometric, on the documented
palette. Produce a few options each and tell me how to drop them into the web build.
```
