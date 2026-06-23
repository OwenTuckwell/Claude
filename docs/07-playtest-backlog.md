# 07 — Playtest Backlog & Build Plan

Prioritised plan from a mid-game playtest. Grouped into **waves** by effort/risk so we
ship visible wins fast and tackle the big systems deliberately. Each item notes effort
(S/M/L), risk, and whether it's blocked on an **asset from you**.

> **Assets needed from you (remind: windmill!):**
> - **Windmill sprite** — currently emoji/vector fallback. *(You said you'd make this — reminder logged here.)*
> - **Moat sprite** — same.
> - **Scout sprite** — for the map marker (optional; emoji works until then).

---

## Wave 1 — Quick wins & polish ✅ DONE (commit 90c4f05)
Immediate feel improvements, all UI, no sim/save changes.

1. ✅ **Fixed troop-count input** — `MilitaryTab` now holds the count as free text with
   select-on-focus, so you can clear/retype it cleanly (no more stuck `0` / 250 / 025).
2. ✅ **Vineyard sprite +50%** — bumped its `SCALE` to 1.5 in `IsoBoard`.
3. ✅ **Sprite variety** — per-instance mirror (~half) + subtle scale jitter, keyed off
   tile/index, so identical buildings no longer look stamped.
4. ✅ **Build / march timers** — build queue and world marches show a live **real-time
   countdown** (`fmtClock`) + progress bar; marches no longer show raw ticks.

> Note (Wave 2): the map march **marker** still shows ⚔️ for scouts — give scouts the 🧭
> icon + (later) a sprite there.

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

9. ✅ **Bigger, fuller map + player off-centre** (commit d3876b9) — regenerated to
   **120×68 (4× tiles), 50 rivals, player in the SW corner**; smaller tiles + zoom-to-select.
   `aiTurn` optimised to a one-pass ownership index so 50 factions stay performant.
10. ✅ **Enemies fight each other + anti-runaway** (commit d18740b) — rivals skirmish each
    other's border tiles, **preferring to peck the biggest faction down**. Hard guards keep
    it **player-focused, never a mega 1v1**: a per-faction tile cap (`maxAiTilePct`), and
    **AI can never capture a capital** (only the player can), so no faction is eliminated /
    snowballs. Harness asserts no rival nears the Crown.
11. ⬜ **New rivals appear over time, scaling with difficulty** — periodically awaken a
    fresh faction on open land, difficulty scaling to game progress. (Needs a dormant-pool
    or dynamic-faction approach — the one remaining Wave 3 piece.) **L.**
12. ✅ **Enemies keep growing** — `factionStrength` snowballs per archetype × difficulty each
    AI turn (already live); the cap stops any one from running away.

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

## Decisions made
- **Map size: HUGE — ~80×120 with ~50 rivals.** Because the painted backdrop (`bg_map`)
  stays one image, the grid gets **smaller tiles** and the player **zooms in** (PanZoom
  already supports this) to select them. Player starts in a **corner/edge**, not the centre.
- **Castle walls: preset rotatable connecting pieces** (segments / corners / gates /
  towers that snap together and are enclosure-aware) — better look + playability for the
  effort than free-form per-tile painting.
- **Sequence:** Wave 1 ✅ → Wave 3 (world) → Wave 2 (scouting) → Wave 4 (castle).

## Still open (decide when we reach them)
- **New-rival cadence:** how often fresh enemies appear, and a cap on total factions.
- Determinism + `npm test` + `npm run build` after every change; bump `SCHEMA_VERSION` +
  extend `migrate()` whenever `GameState` shape changes.
