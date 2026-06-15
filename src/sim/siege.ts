// Deterministic castle-siege auto-resolve (docs/01 §7). Given an attacking army, a
// defender (garrison + fortifications), the active modifiers and an RNG state, it
// produces a blow-by-blow log and an outcome. Determinism (seeded RNG) means the same
// inputs always yield the same result — replayable and server-verifiable.
import { buildingById, troopById } from "./content";
import { nextRandom } from "./rng";
import type { Modifiers } from "./effects";

export interface SiegeDefender {
  garrison: Record<string, number>;
  fortifications: { building: string; level: number }[];
}

export interface SiegeOutcome {
  victory: boolean;
  breached: boolean;
  attackerSurvivors: Record<string, number>;
  attackerLosses: Record<string, number>;
  defenderLosses: Record<string, number>;
  lines: string[];
  rngState: number;
}

function effAttack(id: string, m: Modifiers) {
  return troopById[id].attack * (1 + (m.troopStatPct[id]?.attack ?? 0));
}
function effHealth(id: string, m: Modifiers) {
  return troopById[id].health * (1 + (m.troopStatPct[id]?.health ?? 0));
}
function effDefense(id: string, m: Modifiers) {
  return troopById[id].defense * (1 + (m.troopStatPct[id]?.defense ?? 0));
}
// A unit's effective durability folds defense into health so the defense stat
// meaningfully prolongs survival (tunable further in M2).
function durability(id: string, m: Modifiers) {
  return effHealth(id, m) + effDefense(id, m);
}

interface Side { hp: Record<string, number>; }   // troopId -> remaining HP pool

function counts(side: Side, m: Modifiers): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of Object.keys(side.hp)) {
    out[id] = Math.max(0, Math.round(side.hp[id] / durability(id, m)));
  }
  return out;
}

function rolesPresent(army: Record<string, number>): Set<string> {
  const s = new Set<string>();
  for (const id of Object.keys(army)) if ((army[id] ?? 0) > 0) s.add(troopById[id].role);
  return s;
}

// Offensive DPS of a side, applying a counter bonus per stack vs the enemy's roles.
function damageOf(side: Side, m: Modifiers, enemyArmy: Record<string, number>, defensive: boolean): number {
  const enemyRoles = rolesPresent(enemyArmy);
  let dmg = 0;
  for (const id of Object.keys(side.hp)) {
    const c = side.hp[id] / durability(id, m);
    if (c <= 0) continue;
    const def = troopById[id];
    let mult = 1;
    if (def.counters?.some((r) => enemyRoles.has(r))) mult *= 1.25;
    if (defensive) mult *= 1.1; // defender's home-ground edge
    dmg += c * effAttack(id, m) * mult;
  }
  return dmg;
}

export function resolveSiege(
  attackerArmy: Record<string, number>,
  defender: SiegeDefender,
  m: Modifiers,
  rngState: number,
): SiegeOutcome {
  const lines: string[] = [];
  let rng = rngState;
  const roll = () => { const r = nextRandom(rng); rng = r.state; return 0.95 + 0.1 * r.value; };

  // Build mutable HP pools.
  const atk: Side = { hp: {} };
  for (const [id, c] of Object.entries(attackerArmy)) if (c > 0) atk.hp[id] = c * durability(id, m);
  const def: Side = { hp: {} };
  for (const [id, c] of Object.entries(defender.garrison)) if (c > 0) def.hp[id] = c * durability(id, m);

  const attackerStart = counts(atk, m);
  const defenderStart = counts(def, m);

  // ---- Stage 1: walls ----
  let fortHP = 0;
  let towerSlots = 0;
  for (const f of defender.fortifications) {
    const bd = buildingById[f.building];
    fortHP += (bd?.defense?.health ?? 0) * f.level * (1 + m.defenseHealthPct);
    towerSlots += (bd?.defense?.garrisonSlots ?? 0) * f.level;
  }
  let breached = true;
  if (fortHP > 0) {
    lines.push(`The defenders man ${Math.round(fortHP)} HP of walls and towers.`);
    // Siege engines batter the walls.
    let siegeDmg = 0;
    for (const id of Object.keys(atk.hp)) {
      const t = troopById[id];
      if (t.role === "siege") siegeDmg += counts(atk, m)[id] * effAttack(id, m) * (t.bonusVsFortification ?? 1);
    }
    // Tower archers fire on the approaching army while the walls stand.
    const archers = Math.min(defender.garrison["archer"] ?? 0, towerSlots);
    const towerDmgPerRound = archers * effAttack("archer", m) * 1.2;

    if (siegeDmg <= 0) {
      breached = false;
      // No siege engines: a few rounds of tower fire, then the assault is repelled.
      const towerRounds = 4;
      applyDamage(atk, towerDmgPerRound * towerRounds * roll(), m);
      lines.push("Without siege engines the army cannot breach the walls — tower archers drive them off.");
    } else {
      const rounds = Math.max(1, Math.ceil(fortHP / siegeDmg));
      applyDamage(atk, towerDmgPerRound * rounds * roll(), m);
      lines.push(`Siege engines breach the walls after ${rounds} round(s) under archer fire.`);
    }
  }

  let victory = false;
  if (breached) {
    // ---- Stage 2: field battle inside the breach ----
    lines.push("Battle is joined within the walls.");
    for (let round = 0; round < 25; round++) {
      const atkAlive = totalHP(atk), defAlive = totalHP(def);
      if (atkAlive <= 0 || defAlive <= 0) break;
      const atkDmg = damageOf(atk, m, defender.garrison, false) * roll();
      const defDmg = damageOf(def, m, attackerArmy, true) * roll();
      applyDamage(def, atkDmg, m);
      applyDamage(atk, defDmg, m);
    }
    victory = totalHP(def) <= 0 && totalHP(atk) > 0;
    lines.push(victory
      ? "The keep falls — the assault carries the day!"
      : "The defenders hold. The attackers fall back.");
  }

  const survivors = counts(atk, m);
  const defLeft = counts(def, m);
  const attackerLosses = diff(attackerStart, survivors);
  const defenderLosses = diff(defenderStart, defLeft);

  return { victory, breached, attackerSurvivors: survivors, attackerLosses, defenderLosses, lines, rngState: rng };
}

function totalHP(s: Side): number {
  let t = 0; for (const id of Object.keys(s.hp)) t += Math.max(0, s.hp[id]); return t;
}
function applyDamage(s: Side, dmg: number, _m: Modifiers): void {
  if (dmg <= 0) return;
  const total = totalHP(s);
  if (total <= 0) return;
  // Distribute damage proportionally across the side's stacks.
  for (const id of Object.keys(s.hp)) {
    const share = s.hp[id] / total;
    s.hp[id] = Math.max(0, s.hp[id] - dmg * share);
  }
}
function diff(before: Record<string, number>, after: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of Object.keys(before)) {
    const d = (before[id] ?? 0) - (after[id] ?? 0);
    if (d > 0) out[id] = d;
  }
  return out;
}
