# Asset Pipeline — generating game art (free options)

How to produce the 2.5D isometric art for *Bannerfall* cheaply and consistently. Pairs
with `art-style.md` (the style guide) and Appendix R of `05-scaling-roadmap.md`.

## TL;DR recommendation (free + best + least effort)
1. **Free CC0 asset packs first** — best effort-to-result. **Kenney.nl** and **Quaternius**
   have free, commercially-usable, *already-consistent* isometric/low-poly medieval sets.
   No modeling, no cost, instantly coherent. Likely ~80% of what's needed.
2. **Blender as the power tool** — for *custom, unique* buildings that must match exactly:
   model (or kitbash free models) and **batch-render to 2D sprites** with one fixed camera
   + light. Bigger time investment, best consistency.
3. **AI image gen (Higgsfield etc.) for concept / hero / marketing art** — splash screen,
   title, promo. Accept it needs curation; don't rely on it for the consistent sprite set.

## Note on connectors
There is **no Blender connector available** to Claude here (not installed, not in the
registry). Claude can't *operate* Blender or Higgsfield directly. It CAN write scripts,
wire packs into the build, and do the in-game rendering. Community Blender MCP servers
exist on GitHub but require manual setup and aren't wired up.

## Blender vs Higgsfield (for this game)
| | Blender (3D → render to 2D sprites) | Higgsfield / AI image gen |
|---|---|---|
| Cost | **Free** (GPL, no revenue cap, commercial OK) | Often paid tiers; commercial terms vary |
| **Consistency** | Excellent — one camera angle + one light → every asset matches | Hard — each generation drifts in angle/style/lighting |
| Speed per asset | Slower (model it, or import) | Very fast (prompt) |
| Skill needed | 3D modeling (real learning curve) | Just prompting |
| Best for | A coherent **set** of many building/unit sprites at a fixed iso angle | Concept art, hero images, backgrounds, marketing |

**Why it matters here:** `art-style.md` demands a fixed isometric angle, one light
direction, one palette across dozens of buildings. That's exactly where AI gen struggles
(mismatched pile) and Blender shines (model once, render all consistently). So for the
**core sprite set**, Blender (or pre-made consistent packs) beats AI gen; use AI gen for
one-offs and concept work.

## Free sources (all commercial-OK; confirm license & record in CREDITS.md)
- **Kenney.nl** — CC0 (no attribution), excellent isometric + UI + audio packs.
- **Quaternius** — free low-poly model packs (incl. medieval), CC0.
- **BlenderKit** (free tier), **Sketchfab** (filter to CC0/CC-BY) — free 3D models.
- **OpenGameArt** — filter to CC0/CC-BY.
- AI gen: any tool whose terms permit commercial use of outputs.

## The Blender render-to-sprite pipeline (the consistency trick)
The plan for custom assets (script not yet written — see "Next steps"):
1. One Blender scene with the **art-style.md camera**: 2:1 dimetric isometric, fixed
   angle, single warm top-left sun, soft shadow.
2. Import/model each building; place on origin; uniform scale.
3. A **Python batch script** renders each to a transparent PNG at a consistent pixel size
   (e.g. 256×128 @2x), named `building_<id>@2x.png`.
4. Drop the PNGs into the game and render them isometrically (Appendix R: canvas/PixiJS,
   z-order by x+y).
- Benefit: change the angle/palette once → re-render everything; perfect coherence.

## What Claude can do to help (next steps — pick one at home)
- **Draft the Blender Python render-pipeline script** (sets up the art-style.md camera +
  lighting, batch-renders a folder of models to transparent iso PNGs at a fixed size) —
  ready to run once Blender is installed.
- **Find & wire a free CC0 pack** (Kenney/Quaternius) into the asset pipeline so real art
  shows in the game fast — the quickest path to seeing it look like a game.
- **Build the in-game 2.5D rendering** (Appendix R) to consume the sprites.

## Licensing guardrail
Ship only **CC0 / free-for-commercial** assets, or AI output you have commercial rights
to. Maintain a `CREDITS.md`. (Protects the project if it ever earns revenue.)
