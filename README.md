# Bannerfall

An original medieval realm-builder with the depth of a slow-paced strategy MMO, built
for mobile. This repo contains the design docs (`docs/`) and the **M1 web vertical
slice** — a single-player, playable prototype proving the core loop.

> Design & architecture: see [`docs/`](docs/README.md). Why these choices: the game core
> is engine-agnostic and data-driven so it can later move to Unity (Web/Android/iOS)
> without throwing the content away — see `docs/03-technical-architecture.md`.

## What's playable (M1)

A single village you grow through interacting systems:

- **Economy** — farms/woodcutters/quarries/mines produce resources; storage caps; a
  granary/stockpile to raise them.
- **Population & happiness** — the ration and tax dials trade growth against gold; starve
  your people and they leave.
- **Research** — research points drip from civic buildings; spend them across an economy/
  construction/military/logistics tech tree that amplifies everything.
- **Army & sieges** — train troops, march on AI keeps, and break their walls in a
  **deterministic siege** (siege engines breach, tower archers bleed you, then the field
  battle). Win to loot.
- **Slow real-time** — build/research/train/march on timers; progress is credited while
  you're away (offline catch-up).

## Run it

```bash
npm install
npm run dev        # local dev server (Vite) — open the printed URL on your phone/browser
```

To host it yourself (it's a static site):

```bash
npm run build      # outputs static files to dist/
npm run preview    # preview the production build locally
# then deploy the contents of dist/ to any static host
```

```bash
npm test           # run the deterministic-sim test suite (Vitest)
```

## How it's organized

```
src/sim/     Engine-agnostic, deterministic simulation core (no React). THE game.
src/host/    Persistence + the wall-clock→ticks bridge (the only place time is read).
src/ui/      React + canvas presentation (reads sim state, emits commands).
content/     Data-driven game content (buildings, research, troops, world) as JSON.
config/      Tunable balance constants.
docs/        Design & architecture documents.
```

The strict split between `src/sim` (pure, tested, portable) and `src/ui` is deliberate:
it's what lets the simulation later be re-implemented in Unity/C# (and run on an
authoritative server for the MMO) while the content and rules port unchanged.

## Prototype notes

- Time is sped up for demo play: ~1 real second ≈ 1 game-minute (`TICKS_PER_REAL_SECOND`
  in `src/host/persistence.ts`). The underlying balance numbers are the design-time ones.
- Single-player only; the world's AI keeps stand in for real players. Multiplayer is a
  later milestone (`docs/04-mvp-roadmap.md`).
