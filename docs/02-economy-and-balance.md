# 02 — Economy & Balance

This doc turns the systems in `01` into **coherent numbers**: the flow model, the timer
and cost formulas, storage math, and a worked example. The goal is to prove the systems
form a closed, tunable loop — not to ship final balance (that's milestone M2).

All formulas are **deterministic** and live as data/config so designers tune without
code changes (see schemas in `03`).

---

## 1. Tick model

- The sim advances in **fixed ticks** (design value: **1 tick = 1 minute** of game
  time). Production, consumption, and timers are all expressed per tick.
- On resume after being offline, the sim **fast-forwards** the elapsed ticks (capped by
  storage caps and a max-catch-up window). Determinism makes this exact and replayable.

---

## 2. Production

For a production building of level `L`, staffed at fraction `s ∈ [0,1]`:

```
output_per_tick = base_output(type)
                * level_multiplier(L)
                * staffing(s)
                * (1 + Σ research_bonuses)
                * (1 + Σ active_boosts)        // [Later] card/boosts
```

- `level_multiplier(L)` — e.g. `1.0, 1.6, 2.4, 3.4, ...` (sub-linear-to-linear growth;
  tuned per type).
- `staffing(s)` — proportional, with a small floor for "skeleton crew."
- Bonuses are **additive within a category, multiplicative across categories** (keeps
  big stacks from exploding; standard 4X practice).

**Storage clamp:** `stored = min(stored + output_per_tick, cap)`. Overflow is wasted.

---

## 3. Consumption, food & happiness

**Food consumption per tick:**
```
food_consumed = population * food_per_capita * ration_multiplier
```
- `ration_multiplier`: Half = 0.5, Normal = 1.0, Generous = 1.5, Double = 2.0.

**Happiness (popularity) score** — a signed sum, clamped, that drives growth/decline:
```
happiness = ration_bonus(ration_multiplier)      // -? .. +?
          - tax_penalty(tax_rate)
          + luxury_bonus(goods_supplied)
          + civic_bonus(buildings)
          - crowding_penalty(pop / housing_cap)
          + fear_modifier                         // [Later]
```
Example component shapes (tunable):
| Ration | bonus | | Tax rate | penalty |
|---|---|---|---|---|
| Half | −4 | | 0% | 0 |
| Normal | 0 | | 20% | −3 |
| Generous | +4 | | 40% | −8 |
| Double | +8 | | 60% | −16 |

**Population dynamics per tick:**
```
if food stores == 0:        pop decreases (starvation)   // hard fail state
elif happiness > 0:         pop grows toward housing_cap at rate ∝ happiness
elif happiness < 0:         pop declines slowly
else:                       stable
```

This reproduces the SHK tension: **rations & tax are the two big dials**, traded off
against gold income and growth.

---

## 4. Taxation (gold)

```
gold_per_tick = population * base_tax_yield * tax_rate_multiplier * (1 + trade_research)
```
Higher `tax_rate` → more gold now, lower happiness → slower/negative growth → less
population to tax later. The classic short-vs-long-term lever.

---

## 5. Costs & build times

**Cost of level `L` of a building** (geometric growth — standard for builders):
```
cost(res, L) = base_cost(res) * growth^(L-1)        // growth ≈ 1.5–1.7
```

**Build/upgrade time:**
```
build_time(L) = base_time * time_growth^(L-1)
              * (1 - Σ construction_research_time_reductions)   // capped, e.g. ≤ 60%
```
- Times scale from seconds (early) to many hours/days (late) — the slow-time backbone.
- A **build queue** (1 free slot; more via progression/[Later] monetization) lets work
  proceed while offline.

**Research node time/cost:** RP cost is geometric per rank; RP accrues at
`rp_per_tick = base + Σ civic_building_rp` so deep nodes naturally take real-world days.

**Troop training:** per-unit `resource cost` + `train_time`, batched in military
buildings; upkeep deducted per tick from gold/food.

**March time:** `distance_tiles / march_speed`, reduced by logistics research.

---

## 6. Storage caps

```
cap(res) = base_cap + Σ storage_building_capacity(level)
```
Production above cap is wasted → players must invest in storage *and* check in to spend.
Caps also bound the offline catch-up (you can't return to infinite resources).

---

## 7. Worked example (sanity check of the loop)

Starting village, illustrative early values (1 tick = 1 min):

- **Population:** 20, **housing cap:** 30, **ration:** Normal (×1.0), **tax:** 20%.
- 2× Farm L1 → food `+4/tick`; food consumption `20 * 0.15 * 1.0 = 3/tick` → **+1 food/tick** surplus → stores fill, happiness positive → **pop grows**.
- 1× Woodcutter L1 → wood `+3/tick`; 1× Quarry L1 → stone `+1.5/tick`.
- Tax: `20 * 0.5 * 0.2(rate) ≈ +2 gold/tick`.
- Happiness ≈ `ration(0) − tax(−3) + civic(+4 from a chapel) − crowding(~0) = +1` → slow growth. ✔ coherent.

Player wants a Barracks (cost wood 240 / stone 120, build 45 min):
- At `+3 wood/tick`, 240 wood ≈ **80 min** to bank (or less if storage already holds
  some) → then a **45 min** build. So fielding first troops is a ~2-hour arc → fits the
  check-in cadence. ✔

Push to war: raise tax to 40% (gold `+4/tick`, happiness `−4` → growth stalls) and
rations to Half to bank food for troop upkeep — a deliberate, costly choice. ✔ The dials
interact exactly as intended.

---

## 8. Balance methodology (for M2)

- Keep **all** constants in data (`config/balance.json` + per-entity data files).
- Build a tiny **spreadsheet/sim harness** (can reuse the deterministic core headless)
  to fast-forward thousands of ticks and chart resource/pop/happiness curves.
- Target **time-to-milestone** curves (e.g., "first troops ~2h, first siege ~1–2 days")
  and tune growth constants to hit them.
- Validate **no runaway loops** (e.g., happiness→pop→tax→… must have negative feedback;
  the additive-within/multiplicative-across bonus rule prevents stacking blowups).
