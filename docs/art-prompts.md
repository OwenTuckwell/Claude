# Bannerfall — building art prompts (transparent sprites)

Copy a line, generate, save as `<id>.png`, upload to `public/sprites/`. It appears on the
board automatically (emoji/vector until then).

## Tools that actually output transparency
Prompt wording only gives a transparent PNG on tools that support alpha:
- **Recraft.ai** — free, explicit "transparent" + great for game assets (recommended).
- **ChatGPT image / Adobe Firefly / Ideogram / Leonardo** — have a transparent option.
- **Bing Image Creator / most others** — *no* transparency; generate on white and run it
  through **remove.bg** (free) once.

## Shared style suffix (keeps the set coherent — paste after every subject)
```
, isometric 2:1 dimetric view, stylised-but-realistic medieval, earthy muted palette
(mossy green, timber brown, stone grey, golden thatch), warm top-left sunlight with soft
shadow, clean readable silhouette, a SINGLE isolated building, NO ground, NO base plate,
NO grass, NO scenery, fully transparent background, PNG with alpha, centred with margin,
mobile strategy game sprite, crisp, high detail
```

## Per-building prompts (subject + the suffix above)
- **hovel** — `a small timber-framed cottage with a thatched roof and a stone chimney`
- **farm** — `a small fruit orchard: neat rows of apple trees with a little timber fruit-store hut`
- **woodcutters_lodge** — `a log cabin with a stack of cut logs and an axe in a tree stump`
- **quarry** — `a stone quarry workshop with cut stone blocks and a wooden cart`
- **iron_mine** — `a mine entrance set into a rocky outcrop with timber supports and a minecart`
- **granary** — `a round stone granary with a conical thatched roof`
- **stockpile** — `an open wooden storage yard stacked with crates and barrels`
- **warehouse** — `a large timber storehouse with big double doors`
- **chapel** — `a small stone chapel with a cross, arched windows and a little bell`
- **tavern** — `a two-storey timber inn with a hanging sign and barrels by the door`
- **marketplace** — `medieval market stalls with striped awnings and crates of goods`
- **scholars_hall** — `a stone scholars' hall (library) with tall arched windows and a small tower`
- **university** — `a grand stone university with spires, arched windows and a clock`
- **town_hall** — `a grand timber-and-stone town hall with a bell tower and hanging banners`
- **barracks** — `a timber barracks with hanging banners and a weapon rack`
- **blacksmith** — `a blacksmith forge with a stone chimney, glowing forge fire and an anvil`
- **archery_range** — `an archery range with straw targets and a wooden fence`
- **siege_workshop** — `an open workshop with a large wooden catapult under construction`

### Castle (fortifications)
- **wall** — `a short section of crenellated grey stone castle wall`
- **tower** — `a round crenellated grey stone defensive tower`
- **watchtower** — `a tall stone watchtower with a timber top and a flag`
- **keep** — `a large square stone castle keep with battlements and banners`
- **gatehouse** — `a stone castle gatehouse with a raised wooden portcullis`
- **barbican** — `a fortified stone barbican gate flanked by twin towers`

## Scenery & extras (optional, fill the empty space)
Same earthy style; these decorate the island.
- **bird** (`public/sprites/bird.png`) — `a single small bird in flight, wings spread, side profile, simple clean stylised shape, soft shading, fully transparent background, PNG with alpha, tiny sprite` — *(flies across the scene periodically)*
- **tree_oak** — `a single leafy oak tree, NO ground, transparent background, PNG with alpha`
- **tree_pine** — `a single pine/fir tree, NO ground, transparent background, PNG with alpha`
- **rocks** — `a small cluster of grey boulders, NO ground, transparent background, PNG with alpha`
- **stream** — `a gently curving section of a shallow stream/river with grassy banks, isometric 2:1 dimetric, top-down-ish, transparent background, PNG with alpha` — *(for the scenic layout phase)*
- **well** — `a round stone village well with a small wooden roof, isometric, NO ground, transparent background, PNG with alpha`

## Example (fully assembled — hovel)
```
a small timber-framed cottage with a thatched roof and a stone chimney, isometric 2:1
dimetric view, stylised-but-realistic medieval, earthy muted palette (mossy green, timber
brown, stone grey, golden thatch), warm top-left sunlight with soft shadow, clean readable
silhouette, a SINGLE isolated building, NO ground, NO base plate, NO grass, NO scenery,
fully transparent background, PNG with alpha, centred with margin, mobile strategy game
sprite, crisp, high detail
```
