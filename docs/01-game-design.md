# 01 — Game Design Document (GDD)

This is the systems blueprint for *Bannerfall*. It describes an original game with
Stronghold-Kingdoms-class depth. Numbers and formulas live in `02-economy-and-balance.md`;
this doc defines *what the systems are and how they interact*.

> Reading note: systems marked **[M1]** are in the first playable vertical slice.
> **[Later]** systems are designed here but deferred (see `04-mvp-roadmap.md`).

---

## 1. Core loop

```
        ┌─────────────────────────────────────────────┐
        │                                             │
        ▼                                             │
  Produce resources ──► Feed & keep population happy ──► Grow population
        │                                                     │
        │                                                     ▼
        │                                            More labour available
        ▼                                                     │
  Build & upgrade ◄──── Spend resources ◄───────────────────┘
        │
        ▼
  Earn research points over time ──► Unlock tech in research tree
        │                                   │
        ▼                                   ▼
  Train troops ──► Defend / attack ──► Siege combat ──► Gain land, loot, rank
        │                                                     │
        └──────────────────── reinvest ◄─────────────────────┘
```

The economy is the **steady hum**; sieges are the **spikes**. Research is the
**long-arc progression** that gates and amplifies everything.

---

## 2. Resources **[M1]**

| Resource | Role | Produced by | Consumed by |
|---|---|---|---|
| **Food** (grain, meat, etc.) | Feeds population; ration level drives happiness | Farms, hunters, fisheries, orchards | Population (per-capita, scaled by ration setting) |
| **Wood** | Primary early build material | Woodcutters | Buildings, some troops/siege gear |
| **Stone** | Mid/late build material, fortifications | Quarries | Buildings, walls, towers |
| **Iron** | Tools, weapons, advanced buildings | Iron mines | Military buildings, weapons, troops |
| **Gold** | Trade, troop upkeep, rush convenience | Taxes on population, markets | Upkeep, trades, optional rush |
| **Research points (RP)** | Unlock the tech tree | Drips over real time, scaled by civic buildings & happiness | Research nodes |
| **Influence** **[Later]** | Political/diplomatic actions | Civic prestige | Politics layer |

Design rules:
- Each resource has a **storage cap** set by storage buildings; production past the cap
  is wasted (encourages active play & infrastructure investment, classic SHK tension).
- **Food can go negative in flow** (you consume more than you produce) → starvation →
  happiness collapse → population decline. This is the central balancing act.

---

## 3. Population & happiness **[M1]**

The beating heart of the SHK feel. Population is both your *labour pool* and your
*consumer base*.

- **Population** grows toward a cap (housing) when **happiness ≥ neutral**, and shrinks
  when unhappy or starving.
- **Labour:** population is assigned to production buildings. Unstaffed buildings
  produce less/nothing. Reassigning labour is a core micro-decision.
- **Happiness factors (sum to a popularity score):**
  - **Rations** — set food generosity (Half / Normal / Double…). More food → happier,
    but drains stores faster.
  - **Tax rate** — higher taxes → more gold, lower happiness. The core gold-vs-growth
    dial.
  - **Luxuries / ale** — providing goods (ale, etc.) boosts happiness.
  - **Fear vs. benevolence** **[Later]** — buildings/edicts that trade happiness for
    other effects (e.g., a gallows that boosts output but lowers popularity), echoing
    SHK's fear/popularity duality.
  - **Crowding / unmet needs** — penalties when housing or services lag.

This creates the signature **economic juggling act**: push taxes and rations to fund a
war, accept slower growth; or invest in happiness to grow your labour base.

---

## 4. Buildings **[M1 core, content expands later]**

Categories:
- **Production:** farm, woodcutter's lodge, quarry, iron mine, hunter, orchard, etc.
  Each has levels; higher levels = more output (and more labour/upkeep).
- **Storage:** granary (food), stockpile (wood/stone/iron). Sets resource caps.
- **Housing:** hovels/houses → population cap.
- **Civic / research:** scholar's hall, library — generate RP and boost happiness/services.
- **Military:** barracks, archery range, smithy, siege workshop, stables — unlock and
  train troops; require iron/upkeep.
- **Fortification:** walls, gatehouses, towers, traps, moat — define your **castle
  layout** for sieges (see §7).

Each building entry is **data-driven** (id, cost curve, build-time curve, output,
labour, prerequisites — see schema in `03`). Adding content = adding data, not code.

---

## 5. Research tree **[M1: a real slice; full breadth later]**

The depth showcase. Research points drip in over real time; nodes are **leveled** (most
techs have multiple ranks) and gated by prerequisites and building levels.

**Categories (branches):**
1. **Economy** — farming, logging, mining yields; storage; trade efficiency; happiness.
2. **Military** — troop unlocks, attack/defense/health bonuses, training speed.
3. **Construction** — unlock buildings, reduce build time/cost, fortification tiers.
4. **Exploration / Logistics** **[partly M1]** — scouting, march speed, vision, capacity.
5. **Diplomacy / Statecraft** **[Later]** — politics, influence, alliance perks.

**Mechanics:**
- A node has a **RP cost**, **rank** (1..N), **prereqs**, and **effects** (typed
  modifiers applied to the sim, e.g. `farm_output +8%`).
- **Slow drip + choice:** you can't research everything; early ranks are cheap, deep
  ranks are expensive → meaningful build-order/strategy decisions.
- Tree is **data-driven** (`research.sample.json`), so the "hundreds of nodes" SHK
  scale is a content task, validated by a small but real M1 slice (~20–30 nodes).

---

## 6. Military **[M1: basic; depth later]**

- **Troop types:** ranged (archers), infantry (spearmen/swordsmen), siege (catapults,
  rams), each with attack/defense/health/role and resource+time cost to train.
- **Counters:** rock-paper-scissors-ish roles (spears beat cavalry, archers soft from
  range, siege breaks walls) so army composition matters.
- **Upkeep:** troops cost gold/food upkeep → standing armies have an economic price.
- **Marches & travel timers** **[M1 light]**: attacking a (single-player, AI) target
  takes real time to march; scouting reveals defenses first.
- **Captains / heroes** **[Later]:** lead armies, provide bonuses, level up.

---

## 7. Castle-siege combat — the signature mechanic **[M1: simplified; deepen later]**

This is the one mechanic worth getting *distinctive* and right.

**Defender side (layout):** you place **walls, gatehouses, towers (garrisoned with
ranged troops), traps, and a moat** on a grid around your keep. This *is* your defense —
a designed fortress, not a single "defense number."

**Attacker side (assault):** an attacker brings an army + siege equipment and must
**breach the layout** to reach the keep:
- Siege engines break walls/gates to open paths.
- Ranged units in towers thin the attackers as they approach.
- Traps/moat slow and damage.
- Infantry pours through breaches toward the keep.

**Resolution model (progressive):**
- **M1 (deterministic auto-resolve):** the siege is simulated deterministically from
  the layout + army stats and a fixed RNG seed, producing a blow-by-blow log and an
  outcome (held / partial loss / fell, with casualties & loot). No live input required
  — fits async/slow-time and is server-authoritative-ready.
- **Later:** optional **watchable replay** of the auto-resolved siege, then potentially
  light real-time attacker commands. Crucially, the *outcome* stays deterministic from
  inputs so it can run on a server.

This keeps the distinctive "design-a-castle, breach-a-castle" identity while remaining
async-friendly and cheat-resistant.

---

## 8. World map **[M1: single-player shape]**

- A **tiled region** containing the player's village(s), **AI villages** (raidable /
  trade partners), and **resource tiles / parishes** (capturable nodes that grant
  bonuses).
- Single-player: AI neighbours have simple economies and defenses; they regrow, raid
  back, and provide PvE targets and goals.
- **Later (MMO):** the same map structure becomes a shared persistent world with real
  players; AI fills empty space. Designing the map as data + tile-coords now means the
  single-player map is a subset of the eventual world — **no structural rewrite**.

---

## 9. Social, politics & boosts **[Later — designed, not built]**

Documented now so the architecture leaves room:
- **Parishes / regions** with a controlling power, local taxes, and perks.
- **Sheriffs / leadership** — appointed or elected control of a parish.
- **Alliances / houses / leagues** — cooperative play, shared goals, rankings/honor.
- **Steward "card"/boost system** — collectible boosts (timed production/military/build
  bonuses) the player plays from a hand. Designed as a **modifier system** (same typed
  effects as research), so it slots into the existing sim cleanly when built.

---

## 10. Progression, timers & monetization

- **Progression spine:** village level / realm rank gates content and confers prestige;
  driven by buildings, research, and military success.
- **Timers:** build/research/train/march each have a real-time duration (formulas in
  `02`). **Offline progress is credited** on resume (catch-up, capped by storage).
- **Monetization principles (implementation deferred):**
  - Sell **convenience** (extra build queues, timer reductions within fairness limits),
    **cosmetics**, and **breadth** (optional content), **never raw power** that makes
    paying players strictly dominate (protects the long-term MMO economy & goodwill).
  - Always-generous **offline catch-up** so non-payers aren't punished for sleeping.

---

## 11. System interaction map (why it has "depth")

```
 Research ──amplifies──► Production ──feeds──► Storage(capped)
    ▲                        │                      │
    │                        ▼                      ▼
 RP drip ◄──Civic──── Happiness ◄──Rations/Tax── Population ──staffs──► Buildings
                          ▲                          │
                          │                          ▼
                       Luxuries                  Labour ──► Military ──► Siege ──► Land/Loot/Rank
                                                                            │
                                                                            └──► reinvest into economy
```

Depth emerges because **no system is isolated**: a tech choice changes production,
which changes happiness headroom, which changes how hard you can tax to fund the army
that wins the siege that funds the next tech tier.
