import { useState } from "react";
import { buildings as buildingDefs, buildingById, balance } from "../../sim/content";
import { buildCost, buildTimeTicks } from "../../sim/sim";
import { isBuildingUnlocked } from "../../sim/effects";
import { canAfford, costString, type TabProps } from "../helpers";
import { fmtDuration, BUILDING_ICONS } from "../format";
import { realmInfo } from "../../sim/territory";
import type { BuildingDef, ResourceMap } from "../../sim/types";

// The single building upgrade to nudge next: cheapest non-maxed, non-queued core
// (economy) building, falling back to anything upgradable. Pure read of state.
const CORE_CATS = new Set(["production", "housing", "storage", "civic"]);
function totalCost(c: ResourceMap): number {
  return Object.values(c).reduce((a, v) => a + (v ?? 0), 0);
}
function affordFraction(resources: ResourceMap, cost: ResourceMap): number {
  let frac = 1;
  for (const [r, amt] of Object.entries(cost)) {
    if (amt && amt > 0) frac = Math.min(frac, ((resources as Record<string, number>)[r] ?? 0) / amt);
  }
  return Math.max(0, Math.min(1, frac));
}

const CATEGORY_ORDER = ["production", "storage", "housing", "civic", "military", "fortification"] as const;

// Organic scatter of plots around the central keep (percentage coords).
const SLOTS = [
  { x: 30, y: 28 }, { x: 50, y: 20 }, { x: 70, y: 28 },
  { x: 18, y: 42 }, { x: 82, y: 42 },
  { x: 32, y: 62 }, { x: 50, y: 70 }, { x: 68, y: 62 },
  { x: 14, y: 62 }, { x: 86, y: 62 },
  { x: 38, y: 44 }, { x: 62, y: 44 },
  { x: 24, y: 80 }, { x: 50, y: 88 }, { x: 76, y: 80 },
  { x: 40, y: 14 }, { x: 60, y: 14 }, { x: 12, y: 30 }, { x: 88, y: 30 },
];

export function VillageTab({ state, mods, dispatch }: TabProps) {
  const [sel, setSel] = useState<number | null>(null);
  const [building, setBuilding] = useState(false);

  const busyIndexes = new Set(state.buildQueue.map((o) => o.instanceIndex).filter((i): i is number => i !== null));
  const selInst = sel !== null ? state.buildings[sel] : null;
  const selDef = selInst ? buildingById[selInst.id] : null;

  // --- "Next goal" progression hint (Appendix S/T step 1) ---
  const upgradable = state.buildings
    .map((inst, i) => ({ inst, i, def: buildingById[inst.id] }))
    .filter((u) => u.inst.level < u.def.maxLevel && !busyIndexes.has(u.i));
  const cheapest = (arr: typeof upgradable) =>
    arr.slice().sort((a, b) => totalCost(buildCost(a.def, a.inst.level + 1)) - totalCost(buildCost(b.def, b.inst.level + 1)))[0];
  const nextGoal = cheapest(upgradable.filter((u) => CORE_CATS.has(u.def.category))) ?? cheapest(upgradable);
  const goalCost = nextGoal ? buildCost(nextGoal.def, nextGoal.inst.level + 1) : null;
  const goalPct = goalCost ? Math.round(affordFraction(state.resources, goalCost) * 100) : 0;
  const rank = realmInfo(state).rank;

  return (
    <div className="list">
      {nextGoal && goalCost && (
        <div className="card">
          <div className="row">
            <h3 style={{ margin: 0 }}>🎯 Next goal</h3>
            <span className="tag">{rank}</span>
          </div>
          <div className="row" style={{ marginTop: 4 }}>
            <span>{BUILDING_ICONS[nextGoal.inst.id] ?? "🏠"} {nextGoal.def.name} → L{nextGoal.inst.level + 1}</span>
            <span className="cost">{costString(goalCost)}</span>
          </div>
          <div className="bar"><i style={{ width: goalPct + "%" }} /></div>
          <div className="row" style={{ marginTop: 6 }}>
            <span className="muted">{canAfford(state, goalCost) ? "Ready — grow your village." : `${goalPct}% of the way there`}</span>
            <button className="act" disabled={!canAfford(state, goalCost)}
              onClick={() => dispatch({ type: "build", building: nextGoal.def.id, instanceIndex: nextGoal.i })}>
              Upgrade
            </button>
          </div>
        </div>
      )}
      {state.buildQueue.length > 0 && (
        <div className="card">
          <h3>Under construction</h3>
          {state.buildQueue.map((o, i) => {
            const def = buildingById[o.building];
            const elapsed = o.startedTick === null ? 0 : state.tick - o.startedTick;
            const pct = Math.min(100, (elapsed / o.durationTicks) * 100);
            return (
              <div key={i}>
                <div className="queue-item">
                  <span>{BUILDING_ICONS[o.building]} {def.name} → L{o.targetLevel} {o.startedTick === null ? "(queued)" : ""}</span>
                  <button className="ghost" onClick={() => dispatch({ type: "cancelBuild", queueIndex: i })}>Cancel</button>
                </div>
                <div className="bar"><i style={{ width: pct + "%" }} /></div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="scene">
          <svg className="scene-bg" viewBox="0 0 100 100" preserveAspectRatio="none">
            <rect width="100" height="100" fill="#4a6b2e" />
            <path d="M0,70 Q25,60 50,72 T100,68 L100,100 L0,100 Z" fill="#43622a" />
            <path d="M-5,40 Q30,48 55,38 Q80,30 105,44" stroke="#3a78a8" strokeWidth="5" fill="none" opacity="0.8" />
            <path d="M50,50 C46,64 40,78 28,94" stroke="#b9a06a" strokeWidth="3" fill="none" opacity="0.6" />
            <path d="M50,50 C58,62 70,72 84,84" stroke="#b9a06a" strokeWidth="3" fill="none" opacity="0.6" />
          </svg>

          <div className="cloud" style={{ top: "12%", animationDelay: "0s" }}>☁️</div>
          <div className="cloud" style={{ top: "30%", animationDelay: "-18s", fontSize: 20 }}>☁️</div>
          <div className="cloud" style={{ top: "6%", animationDelay: "-32s", fontSize: 30 }}>☁️</div>

          {/* central keep */}
          <div className="keep" title="Your keep">
            <div className="keep-ic">🏰</div>
          </div>

          {state.buildings.map((inst, idx) => {
            const slot = SLOTS[idx % SLOTS.length];
            return (
              <button key={idx} className={"hut" + (sel === idx ? " sel" : "") + (busyIndexes.has(idx) ? " busy" : "")}
                style={{ left: slot.x + "%", top: slot.y + "%" }}
                onClick={() => { setSel(idx === sel ? null : idx); setBuilding(false); }}>
                <span className="hut-ic">{BUILDING_ICONS[inst.id] ?? "🏠"}</span>
                <span className="hut-lv">{inst.level}</span>
              </button>
            );
          })}
        </div>
        <div className="row" style={{ padding: "8px 10px" }}>
          <span className="muted">Tap a building to inspect or upgrade it.</span>
          <button className="act" onClick={() => { setBuilding(true); setSel(null); }}>＋ Build</button>
        </div>
      </div>

      {selInst && selDef && (
        <div className="card">
          <div className="row">
            <h3 style={{ margin: 0 }}>{BUILDING_ICONS[selInst.id]} {selDef.name} <span className="tag">L{selInst.level}</span></h3>
          </div>
          <div className="muted">{describe(selDef)}</div>
          {(() => {
            const maxed = selInst.level >= selDef.maxLevel;
            const next = selInst.level + 1;
            const cost = buildCost(selDef, next);
            return (
              <div className="row" style={{ marginTop: 8 }}>
                <div className="cost">{maxed ? "Fully upgraded." : `${costString(cost)} · ${fmtDuration(buildTimeTicks(selDef, next, mods), balance.tickLengthSec)}`}</div>
                <button className="act" disabled={maxed || !canAfford(state, cost)}
                  onClick={() => dispatch({ type: "build", building: selDef.id, instanceIndex: sel })}>
                  {maxed ? "Max" : `Upgrade → L${next}`}
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {building && (
        <div className="card">
          <div className="row"><h3 style={{ margin: 0 }}>Construct a new building</h3>
            <button className="ghost" onClick={() => setBuilding(false)}>Close</button></div>
          <div className="list" style={{ marginTop: 6 }}>
            {CATEGORY_ORDER.flatMap((cat) =>
              buildingDefs.filter((d) => d.category === cat && isBuildingUnlocked(d.id, mods)).map((def) => {
                const cost = buildCost(def, 1);
                const missingReq = (def.requires?.buildings ?? []).find((b) => !state.buildings.some((x) => x.id === b));
                return (
                  <div className="row" key={def.id}>
                    <div>
                      <strong>{BUILDING_ICONS[def.id] ?? "🏠"} {def.name}</strong> <span className="tag">{def.category}</span>
                      <div className="cost">{costString(cost)} · {fmtDuration(buildTimeTicks(def, 1, mods), balance.tickLengthSec)}</div>
                      {missingReq && <div className="cost">needs {buildingById[missingReq]?.name}</div>}
                    </div>
                    <button className="act" disabled={!!missingReq || !canAfford(state, cost)}
                      onClick={() => dispatch({ type: "build", building: def.id, instanceIndex: null })}>Build</button>
                  </div>
                );
              }),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function describe(def: BuildingDef): string {
  const bits: string[] = [];
  if (def.produces && Object.keys(def.produces).length) bits.push("produces " + Object.entries(def.produces).map(([r, v]) => `${v}/lvl ${r}`).join(", "));
  if (def.housingBonus) bits.push(`+${def.housingBonus} housing/lvl`);
  if (def.storageBonus && Object.keys(def.storageBonus).length) bits.push("storage " + Object.entries(def.storageBonus).map(([r, v]) => `+${v} ${r}/lvl`).join(", "));
  if (def.happiness) bits.push(`+${def.happiness} happiness`);
  if (def.labour) bits.push(`${def.labour} workers`);
  return bits.join(" · ") || "—";
}
