// Deterministic castle-siege auto-resolve (docs/01 §7). Given an attacking army, a
// defender (garrison + fortifications), the active modifiers and an RNG state, it
// produces a blow-by-blow log and an outcome. Determinism (seeded RNG) means the same
// inputs always yield the same result — replayable and server-verifiable.
import { buildingById, troopById } from "./content";
import { nextRandom } from "./rng";
import type { Modifiers } from "./effects";

/** Where and how a siege hits a castle — derived from its actual layout (or synthesized by
 *  difficulty for AI capitals). The attacker storms the weakest perimeter point; the layout
 *  decides how bloody that is. */
export interface CastleLayout {
  enclosure: number;       // 0..1 — how sealed the keep is (scales wall HP)
  breachName: string;      // what the attackers batter ("Gatehouse", "Stone Wall", …)
  breachIsGate: boolean;   // gate breach: quicker through, but murder-hole fire
  towersAtBreach: number;  // towers/watchtowers within 2 tiles of the breach point
  hasMoat: boolean;        // a moat keeps attackers in the killing field for longer
}

export interface SiegeDefender {
  garrison: Record<string, number>;
  fortifications: { building: string; level: number }[];
  enclosure?: number;      // 0..1 — how well the walls seal the keep; scales wall effectiveness
  layout?: CastleLayout;   // full breach-lane analysis (supersedes bare enclosure when present)
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
  dMods: Modifiers = m,    // defender's modifiers; defaults to the attacker's for back-compat
): SiegeOutcome {
  const lines: string[] = [];
  let rng = rngState;
  const roll = () => { const r = nextRandom(rng); rng = r.state; return 0.95 + 0.1 * r.value; };

  // Build mutable HP pools. Each side uses ITS OWN modifiers — so a besieger never
  // inherits the defender's research bonuses (or vice-versa).
  const atk: Side = { hp: {} };
  for (const [id, c] of Object.entries(attackerArmy)) if (c > 0) atk.hp[id] = c * durability(id, m);
  const def: Side = { hp: {} };
  for (const [id, c] of Object.entries(defender.garrison)) if (c > 0) def.hp[id] = c * durability(id, dMods);

  const attackerStart = counts(atk, m);
  const defenderStart = counts(def, dMods);

  // ---- Stage 1: the breach lane ----
  // The attacker storms the castle's weakest perimeter point; the LAYOUT decides how bloody
  // the approach is. Gates fall faster but pour murder-hole fire on the column; towers near
  // the breach rake it; a moat holds the attackers in the killing field for extra rounds.
  let rawFortHP = 0;
  let towerSlots = 0;
  for (const f of defender.fortifications) {
    const bd = buildingById[f.building];
    rawFortHP += (bd?.defense?.health ?? 0) * f.level * (1 + dMods.defenseHealthPct);
    towerSlots += (bd?.defense?.garrisonSlots ?? 0) * f.level;
  }
  const layout = defender.layout;
  const enclosure = layout?.enclosure ?? defender.enclosure ?? 1;
  // gates are the weak point: the effective barrier is thinner through them
  const fortHP = rawFortHP * enclosure * (layout?.breachIsGate ? 0.85 : 1);
  let breached = true;
  if (fortHP > 0) {
    lines.push(`The defenders man ${Math.round(fortHP)} HP of walls and towers${enclosure < 0.99 ? ` (walls ${Math.round(enclosure * 100)}% enclosing)` : ""}.`);
    if (layout) lines.push(`The assault falls on the ${layout.breachName}.`);
    // Siege engines batter the breach point.
    let siegeDmg = 0;
    for (const id of Object.keys(atk.hp)) {
      const t = troopById[id];
      if (t.role === "siege") siegeDmg += counts(atk, m)[id] * effAttack(id, m) * (t.bonusVsFortification ?? 1);
    }
    // Defensive fire on the column while the barrier stands: tower archers, amplified by
    // towers standing over the breach and by murder-holes if the breach is a gate.
    const archers = Math.min(defender.garrison["archer"] ?? 0, towerSlots);
    let fireMult = 1.2;
    const fireNotes: string[] = [];
    if (layout && layout.towersAtBreach > 0) {
      fireMult *= 1 + 0.15 * Math.min(4, layout.towersAtBreach);
      fireNotes.push(`${layout.towersAtBreach} tower(s) rake the breach`);
    }
    if (layout?.breachIsGate) { fireMult *= 1.25; fireNotes.push("murder-holes pour fire on the column"); }
    const towerDmgPerRound = archers * effAttack("archer", dMods) * fireMult;
    // A moat holds the attackers under fire for longer and fouls the engines' footing.
    const moatRounds = layout?.hasMoat ? 2 : 0;
    if (moatRounds > 0) { siegeDmg *= 0.85; fireNotes.push("the moat mires the assault"); }
    if (fireNotes.length) lines.push(fireNotes.join("; ") + ".");

    if (siegeDmg <= 0) {
      breached = false;
      // No siege engines: a few rounds of tower fire, then the assault is repelled.
      const towerRounds = 4 + moatRounds;
      applyDamage(atk, towerDmgPerRound * towerRounds * roll(), m);
      lines.push("Without siege engines the army cannot breach the walls — tower archers drive them off.");
    } else {
      const rounds = Math.max(1, Math.ceil(fortHP / siegeDmg)) + moatRounds;
      applyDamage(atk, towerDmgPerRound * rounds * roll(), m);
      lines.push(`The ${layout?.breachName ?? "walls"} gives way after ${rounds} round(s) under fire.`);
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
      const defDmg = damageOf(def, dMods, attackerArmy, true) * roll();
      applyDamage(def, atkDmg, dMods);
      applyDamage(atk, defDmg, m);
    }
    victory = totalHP(def) <= 0 && totalHP(atk) > 0;
    lines.push(victory
      ? "The keep falls — the assault carries the day!"
      : "The defenders hold. The attackers fall back.");
  }

  const survivors = counts(atk, m);
  const defLeft = counts(def, dMods);
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
