# Bannerfall — Art Style Guide

The one-page recipe that keeps every asset (AI-generated or from free packs) coherent.
See `05-scaling-roadmap.md` Appendix R for the reasoning. **Conform every asset to this
guide before it ships.**

## 1. Vision & tone
Stylized-but-grounded medieval realm-builder. **Clean readable isometric shapes** (mobile
small-screen first) with a **serious, earthy, historical palette** (not cartoon-bright,
not grimdark). Think: a tidy, sunlit medieval diorama with clear silhouettes. The look
should say *"thoughtful strategy game"*, not *"casual tap toy"*.

## 2. Perspective & geometry
- **Projection:** 2:1 **dimetric isometric** (classic game iso). Tile diamond ratio 2:1
  (width:height).
- **Camera angle:** fixed; no rotation. All assets drawn at this single angle.
- **Light direction:** from the **top-left**, warm midday sun. Shadows fall to the
  bottom-right, soft, semi-transparent (not hard black).
- **Buildings:** anchored to their tile footprint, extend **upward** from the back of the
  tile; taller buildings occupy the same footprint but rise in screen-space.
- **Outlines:** subtle darker-tone edge (not a hard black cartoon stroke); keep silhouettes
  distinct so buildings read at a glance on a phone.

## 3. Tile & scale specs (starting values — tune in the village vertical slice)
- **Base tile:** `128 × 64 px` diamond (2:1). Export at @2x (`256 × 128`) for crisp retina.
- **Building footprint:** 1×1 tile default; large structures (keep, great hall) up to
  2×2 or 3×3 — always whole-tile footprints for clean z-sorting.
- **Z-order:** draw back-to-front by `(tileX + tileY)`.
- **Padding:** leave transparent headroom above building art for tall roofs/banners.

## 4. Palette (hex)
Core earthy environment + UI neutrals + per-faction heraldic accents. Faction accents
**reuse the existing in-game faction colors** (`src/sim/content.ts`) so art matches the map.

### Environment (the world)
| Role | Hex | Note |
|---|---|---|
| Grass / land | `#7a8c4e` | muted green, the base land tone |
| Grass shadow | `#5f6f3c` | terrain depth |
| Soil / path | `#8a6b46` | roads, tilled fields |
| Stone (walls/keep) | `#9a948b` | primary fortification grey |
| Stone shadow | `#6f6a63` | |
| Timber (buildings) | `#7c5a3a` | wood structures |
| Timber light | `#a9794c` | sunlit wood |
| Roof thatch | `#b79556` | |
| Water | `#3f6f8c` | rivers/sea, slightly desaturated |
| Water highlight | `#5b93ad` | shimmer |

### UI neutrals (parchment/ink theme)
| Role | Hex |
|---|---|
| Parchment bg | `#e8dcc0` |
| Panel / card | `#d8c8a4` |
| Ink (text) | `#2e2620` |
| Muted ink | `#6b5d4a` |
| Gold accent (highlights) | `#c9a24a` |

### Faction heraldic accents (from `content.ts`)
| Faction | Hex |
|---|---|
| Player ("Your Realm") | `#4a86d8` |
| Accent 1 | `#c2554f` |
| Accent 2 | `#7a9b46` |
| Accent 3 | `#9b6bbf` |
| Accent 4 | `#c98a3a` |
| Accent 5 | `#3f9b96` |
| Accent 6 | `#b04f86` |

> Rule: environment stays earthy/muted; **saturated color is reserved for faction
> heraldry and UI highlights** so ownership and interactables pop.

## 5. Readability rules (mobile-first)
- Distinct **silhouettes** per building type — recognizable as a thumbnail.
- Limit palette per asset (~4–6 tones + shade/highlight) for a unified look.
- Avoid fine detail that vanishes at phone size; favor bold shape + a couple of focal
  details (a banner, a wheel, a forge glow).
- Faction ownership shown via a **heraldic accent** (banner/roof trim) in the faction color.

## 6. AI generation prompt template
Use this as the base for any AI-generated building/asset; swap the **subject**. Generate on
a transparent or flat background, then trim/recolor to the palette.

**Positive prompt:**
```
isometric game asset, single {SUBJECT} (e.g. medieval stone keep / timber farmhouse /
archer tower), 2:1 dimetric view, stylized but grounded, clean readable silhouette,
earthy muted palette (mossy green, timber brown, stone grey, thatch), warm top-left
sunlight with soft shadow to bottom-right, subtle edge shading not hard cartoon outline,
medieval strategy game art, centered, transparent background, high detail focal points,
mobile game sprite
```
**Negative prompt:**
```
top-down, front view, perspective distortion, multiple objects, text, watermark, ui,
people in foreground, oversaturated, neon, modern, sci-fi, blurry, photo, drop shadow box,
busy background
```
**Settings:** generate several, pick the cleanest silhouette, then **conform** (section 8).
Keep the {SUBJECT}, angle, lighting, and palette words **identical** across all assets —
that consistency is what makes a hybrid/AI set look like one game.

## 7. Asset categories to produce (priority order)
1. **Terrain tiles:** grass, soil/field, water edge, road. (CC0 pack candidate — Kenney.)
2. **Village buildings:** farm, woodcutter, quarry, mine, house, granary, market, civic.
3. **Castle:** keep, wall segment, gate, tower, moat, the castle ground.
4. **Units (map/siege):** small iconic sprites per troop type + faction tint.
5. **UI frames/icons:** resource icons, buttons, panels (parchment theme).
6. **FX:** dust, smoke, arrow volley, wall-break, number-pop.

## 8. Conformance checklist (every asset, before commit)
- [ ] Correct iso angle (2:1) and top-left light.
- [ ] Recolored to the section-4 palette (no off-palette hues).
- [ ] Transparent background, trimmed, anchored to tile footprint.
- [ ] Reads clearly at phone thumbnail size.
- [ ] Exported @2x; consistent naming `category_name@2x.png` (e.g. `building_farm@2x.png`).
- [ ] License recorded in `CREDITS.md` (CC0 = note source; CC-BY = attribution; AI = note
      tool + that commercial use is permitted).

## 9. Licensing
Ship only **CC0 / free-for-commercial** assets or AI output you have commercial rights to.
Maintain `CREDITS.md`. (Protects the project if it ever earns revenue.)
