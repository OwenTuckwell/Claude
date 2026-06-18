import { useState } from "react";
import { buildings as buildingDefs, buildingById, balance } from "../../sim/content";
import { buildCost, buildTimeTicks, townHallLevel, villageGrid, isVillageBuilding } from "../../sim/sim";
import { isBuildingUnlocked } from "../../sim/effects";
import { canAfford, costString, type TabProps } from "../helpers";
import { fmtDuration, BUILDING_ICONS } from "../format";
import { BuildingSprite } from "../BuildingSprite";
import type { BuildingDef } from "../../sim/types";

const CATEGORY_ORDER = ["production", "storage", "housing", "civic", "military"] as const;

export function VillageTab({ state, mods, dispatch }: TabProps) {
  const [sel, setSel] = useState<number | null>(null);
  const [building, setBuilding] = useState(false);
  const { cols, rows } = villageGrid();
  const thLevel = townHallLevel(state);

  const busyIndexes = new Set(state.buildQueue.map((o) => o.instanceIndex).filter((i): i is number => i !== null));
  const selInst = sel !== null ? state.buildings[sel] : null;
  const selDef = selInst ? buildingById[selInst.id] : null;
  const selIsVillage = !!selInst && isVillageBuilding(selInst.id);

  // village buildings with a grid position
  const placed = state.buildings
    .map((inst, idx) => ({ inst, idx }))
    .filter(({ inst }) => isVillageBuilding(inst.id) && inst.gx !== undefined);

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

      <div className="card" style={{ padding: 8 }}>
        <div className="row" style={{ marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>🏡 Your village</h3>
          <span className="tag">Town Hall L{thLevel}</span>
        </div>
        <div className="vgrid-wrap" style={{ position: "relative" }}>
          <svg className="vgrid" width={cols * 40} height={rows * 40} viewBox={`0 0 ${cols} ${rows}`}
            style={{ width: "100%", height: "auto", display: "block", borderRadius: 8 }}>
            {Array.from({ length: cols * rows }, (_, i) => {
              const x = i % cols, y = Math.floor(i / cols);
              const occupied = placed.some(({ inst }) => inst.gx === x && inst.gy === y);
              const isMoveTarget = selIsVillage && !occupied;
              return <rect key={i} x={x} y={y} width={1} height={1}
                fill={(x + y) % 2 ? "#7a8c4e" : "#728345"} stroke="rgba(46,38,32,0.18)" strokeWidth={0.03}
                style={{ cursor: isMoveTarget ? "copy" : "default" }}
                onClick={() => { if (isMoveTarget && sel !== null) dispatch({ type: "moveBuilding", index: sel, gx: x, gy: y }); }} />;
            })}
            {selInst && selIsVillage && selInst.gx !== undefined &&
              <rect x={selInst.gx} y={selInst.gy} width={1} height={1} fill="none" stroke="#b07d1a" strokeWidth={0.12} />}
          </svg>
          {placed.map(({ inst, idx }) => (
            <button key={idx} className={"vbuild" + (sel === idx ? " sel" : "") + (busyIndexes.has(idx) ? " busy" : "")}
              style={{ left: `${((inst.gx! + 0.5) / cols) * 100}%`, top: `${((inst.gy! + 0.5) / rows) * 100}%` }}
              title={buildingById[inst.id].name}
              onClick={() => { setSel(idx === sel ? null : idx); setBuilding(false); }}>
              <span className="vb-ic"><BuildingSprite id={inst.id} /></span>
              <span className="vb-lv">{inst.level}</span>
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <span className="muted">{selIsVillage ? "Tap an empty plot to move it." : "Tap a building to inspect it."}</span>
          <button className="act" onClick={() => { setBuilding(true); setSel(null); }}>＋ Build</button>
        </div>
      </div>

      {selInst && selDef && (
        <div className="card">
          <div className="row">
            <h3 style={{ margin: 0 }}>{BUILDING_ICONS[selInst.id]} {selDef.name} <span className="tag">L{selInst.level}</span></h3>
            <button className="ghost" onClick={() => setSel(null)}>Close</button>
          </div>
          <div className="muted">{describe(selDef)}</div>
          {(() => {
            const maxed = selInst.level >= selDef.maxLevel;
            const next = selInst.level + 1;
            const cost = buildCost(selDef, next);
            return (
              <div className="row" style={{ marginTop: 8 }}>
                <div className="cost">{maxed ? "Fully upgraded." : `${costString(cost)} · ${fmtDuration(buildTimeTicks(selDef, next, mods), balance.tickLengthSec)} · +${Math.round(balance.researchPerLevel * next)} 📜`}</div>
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
              buildingDefs.filter((d) => d.category === cat && d.id !== "town_hall" && isBuildingUnlocked(d.id, mods)).map((def) => {
                const cost = buildCost(def, 1);
                const missingReq = (def.requires?.buildings ?? []).find((b) => !state.buildings.some((x) => x.id === b));
                const tier = def.tier ?? 1;
                const tierLocked = thLevel < tier;
                return (
                  <div className="row" key={def.id}>
                    <div>
                      <strong>{BUILDING_ICONS[def.id] ?? "🏠"} {def.name}</strong> <span className="tag">{def.category}</span>
                      <div className="cost">{costString(cost)} · {fmtDuration(buildTimeTicks(def, 1, mods), balance.tickLengthSec)}</div>
                      {tierLocked && <div className="cost" style={{ color: "var(--bad)" }}>🔒 needs Town Hall L{tier}</div>}
                      {missingReq && <div className="cost">needs {buildingById[missingReq]?.name}</div>}
                    </div>
                    <button className="act" disabled={tierLocked || !!missingReq || !canAfford(state, cost)}
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
  if (def.researchBonus) bits.push(`+${Math.round(def.researchBonus * 100)}% research/lvl`);
  if (def.storageBonus && Object.keys(def.storageBonus).length) bits.push("storage " + Object.entries(def.storageBonus).map(([r, v]) => `+${v} ${r}/lvl`).join(", "));
  if (def.happiness) bits.push(`+${def.happiness} happiness`);
  if (def.labour) bits.push(`${def.labour} workers`);
  return bits.join(" · ") || "—";
}
