import { useState } from "react";
import { buildings as buildingDefs, buildingById, balance } from "../../sim/content";
import { buildCost, buildTimeTicks } from "../../sim/sim";
import { isBuildingUnlocked } from "../../sim/effects";
import { canAfford, costString, type TabProps } from "../helpers";
import { fmtDuration, BUILDING_ICONS } from "../format";
import type { BuildingDef } from "../../sim/types";

const CATEGORY_ORDER = ["production", "storage", "housing", "civic", "military", "fortification"] as const;

export function VillageTab({ state, mods, dispatch }: TabProps) {
  const [sel, setSel] = useState<number | null>(null);
  const [building, setBuilding] = useState(false);

  const busyIndexes = new Set(state.buildQueue.map((o) => o.instanceIndex).filter((i): i is number => i !== null));
  const selInst = sel !== null ? state.buildings[sel] : null;
  const selDef = selInst ? buildingById[selInst.id] : null;

  return (
    <div className="list">
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

      <div className="card">
        <h3>Your village</h3>
        <div className="village-grid">
          {state.buildings.map((inst, idx) => {
            const def = buildingById[inst.id];
            return (
              <div key={idx} className={"vtile" + (sel === idx ? " sel" : "") + (busyIndexes.has(idx) ? " busy" : "")}
                onClick={() => { setSel(idx === sel ? null : idx); setBuilding(false); }}>
                <div className="vic">{BUILDING_ICONS[inst.id] ?? "🏠"}</div>
                <div className="vnm">{def.name}</div>
                <div className="vlv">L{inst.level}</div>
              </div>
            );
          })}
          <div className="vtile empty" onClick={() => { setBuilding(true); setSel(null); }}>＋</div>
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
