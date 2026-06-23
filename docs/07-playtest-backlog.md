# 07 — Playtest Backlog & Build Plan

Prioritised plan from a mid-game playtest. Grouped into **waves** by effort/risk so we
ship visible wins fast and tackle the big systems deliberately. Each item notes effort
(S/M/L), risk, and whether it's blocked on an **asset from you**.

> **Assets needed from you (remind: windmill!):**
> - **Windmill sprite** — currently emoji/vector fallback. *(You said you'd make this — reminder logged here.)*
> - **Moat sprite** — same.
> - **Scout sprite** — for the map marker (optional; emoji works until then).

---

## Wave 1 — Quick wins & polish (S, low risk) — *recommended first*
Immediate feel improvements, mostly UI, no sim/save changes.

1. **Fix troop-count input** *(bug)* — in `MilitaryTab.tsx` the count is a controlled
   number forced through `Math.max(1, …)`, so you can't clear the `0`/replace it (typing 25
   → 250/025). Fix: hold the field as a free-text string, allow empty while editing, parse
   to a number only on Train; select-all on focus. **S.**
2. **Vineyard sprite +50%** — bump its per-building scale value. While there, sanity-check
   the other new buildings' scales. **S.**
3. **Sprite variety** — identical buildings look samey. Add deterministic per-instance
   variation (horizontal flip and/or small scale/offset jitter keyed off the building's
   position/index) so a row of farms isn't a clone stamp. Keep it subtle so lighting still
   reads. **S–M, UI only.**
4. **Build / march / scout timers** — the scene queue (top-right) shows *what's* in progress
   but no countdown. Add a remaining-time readout + progress bar: builds have
   `startedTick`+`durationTicks`; marches have `arriveTick`. Show "⏳ 2m left" + a bar on
   each. **S–M, UI only.**

## Wave 2 — Scouting depth (M)
Make recon a real, risk-bearing system (extends Appendix G).

5. **Scout visual on the map** — render in-transit scout/army marches as a moving marker on
   the world map (emoji until a sprite exists; `.march-mark` styling already exists). **M.**
6. **Scouting-distance research** — a tech that extends scout/vision range (today
   `visionRange` keys off cartography+scouting; add an explicit node + effect). **S–M.**
7. **Scout survival risk** — sending too few scouts, or low scout-research level vs a
   high-difficulty target, can get scouts **caught/killed** (lose them, maybe alert the
   rival). Deterministic roll vs target difficulty − your scouting level − party size.
   **M, sim + UI.**
8. **Intel goes stale / targets keep growing** — once scouted, the rival keeps growing
   (its `factionStrength` already rises); the *displayed* intel is a snapshot that ages and
   decays a level over time, so you must re-scout. **M, sim + UI.**

## Wave 3 — A living, bigger world (L) — *the big experience change*
Directly addresses "map too small, enemies too close, not enough action."

9. **Bigger, fuller map + player off-centre** — regenerate via `tools/genworld.py` at a
   larger size with more rivals; **place the player in a corner/edge**, not the centre, so
   there's a long conquest runway. (Generator change + regenerate `world.json`.) **M.**
10. **Enemies fight each other** — AI factions contest neutral/border land with rivals (a
    cheap abstract clash), so the map visibly churns without the player. **M, sim.**
11. **New rivals appear over time, scaling with difficulty** — periodically spawn a fresh
    faction on open land, with difficulty scaling to game progress / player strength, so it
    never gets easy. (Dynamic factions — currently they're static from `world.json`; this
    is the biggest sim change here.) **L, sim + save migration.**
12. **Enemies keep growing** — ongoing `factionStrength` growth + occasional capital
    fort/garrison upgrades, so left-alone rivals become real threats. **S–M (mostly tuning
    existing growth).**

## Wave 4 — Castle overhaul (L) — *"design matters"*
The current castle is weak; make layout a real, satisfying system (Appendix A + L).

13. **Grid wall-placement with adjacency/enclosure** — place **individual wall segments**
    on a grid that **connect** to neighbours; the keep must be **enclosed** to get its full
    defensive bonus. Compute enclosure (flood-fill: is the keep sealed off from the map
    edge?). **L, sim + UI.**
14. **Rotating / connecting pieces** — walls, gatehouses, towers, corners that visually and
    logically join up. **M–L, UI + content.**
15. **Layout feeds the siege** — enclosure %, breach points, and tower coverage drive the
    deterministic siege (the breach-lane model, Appendix L). A poorly-sealed castle is
    easier to crack. **L, sim.**

---

## Recommended sequence
**Wave 1 → Wave 3 → Wave 2 → Wave 4.** Rationale: Wave 1 is cheap polish that fixes real
friction now; Wave 3 is the biggest *felt* change you called out (the world); Wave 2
deepens scouting (and pairs with the bigger map); Wave 4 (castle) is the largest design
piece and benefits from being done deliberately last. Happy to reorder — e.g. do the
castle sooner if it's bugging you most.

## Notes / open questions
- **Map size & rival count:** how big? (e.g. ~60×90 with ~35 rivals?) And which corner for
  the player start?
- **New-rival cadence:** how often should fresh enemies appear, and a cap on total factions?
- **Castle:** free-form per-tile wall placement (most flexible, most work) vs a few preset
  wall "pieces" you rotate (simpler, still tactical)? Decide before Wave 4.
- Determinism + `npm test` + `npm run build` after every change; bump `SCHEMA_VERSION` +
  extend `migrate()` whenever `GameState` shape changes.
