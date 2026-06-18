# Building art sprites — drop them here

Put a transparent **PNG** named exactly `<buildingId>.png` in this folder and it
**automatically** appears on the Village/Castle boards (the emoji shows until then —
no code change, no broken images). Commit & push → it's live ~2 min later.

## Filenames (one per building)
```
town_hall  farm  windmill  woodcutters_lodge  quarry  iron_mine
hovel  granary  stockpile  warehouse
chapel  tavern  marketplace  scholars_hall  university
barracks  archery_range  blacksmith  siege_workshop
wall  tower  watchtower  keep  gatehouse  moat  barbican
```
e.g. `farm.png`, `keep.png`, `tower.png`.

## Specs (keep them consistent)
- **Transparent background**, roughly **square** (256×256 or 512×512 is ideal; it's
  drawn ~42px so detail beyond that is wasted).
- **Isometric** view, single building, clean readable silhouette, earthy palette,
  top-left light — i.e. follow `docs/art-style.md` (it has the exact AI-gen prompt).
- Trim empty space so the building roughly fills the square; it stands on its tile.

## Two easy ways to add them
1. **From your PC:** generate per `docs/art-style.md`, save into this folder, then
   `git add public/sprites && git commit && git push`.
2. **From your phone (no PC):** on github.com open `public/sprites/`, tap
   **Add file → Upload files**, upload your PNGs (named as above), commit. Done.

You don't have to do them all at once — add `farm.png` alone and just the farm gets
art; everything else stays emoji until you add its file.
