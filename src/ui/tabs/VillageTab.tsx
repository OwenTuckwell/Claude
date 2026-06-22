import { useState } from "react";
import { buildings as buildingDefs, buildingById, balance } from "../../sim/content";
import { buildCost, buildTimeTicks, townHallLevel, villageGrid, isVillageBuilding, placementAllowed } from "../../sim/sim";
import { isBuildingUnlocked } from "../../sim/effects";
import { canAfford, costString, type TabProps } from "../helpers";
import { fmtDuration, BUILDING_ICONS } from "../format";
import { IsoBoard, type Placed } from "../IsoBoard";
import { PanZoom } from "../PanZoom";
import type { BuildingDef } from "../../sim/types";

const CATEGORY_ORDER = ["production", "storage", "housing", "civic", "military"] as const;

export function VillageTab({ state, mods, dispatch }: TabProps) {
  const [sel, setSel] = useState<number | null>(null);     // selected building index
  const [moveMode, setMoveMode] = useState(false);
  const [building, setBuilding] = useState(false);          // build menu open
  const { cols, rows } = villageGrid();
  const thLevel = townHallLevel(state);

  const selInst = sel !== null ? state.buildings[sel] : null;
  const selDef = selInst ? buildingById[selInst.id] : null;
  const popupOpen = !!selInst && selDef && !moveMode;

  const placed = state.buildings
    .map((inst, idx) => ({ inst, idx }))
    .filter(({ inst }) => isVillageBuilding(inst.id) && inst.gx !== undefined);

  const queue = state.buildQueue.filter((o) => isVillageBuilding(o.building));

  return (
    <div className="vscene">
      <PanZoom fill initialScale={1}>
        <IsoBoard cols={cols} rows={rows} bg="sprites/bg_village.png" fill
          placed={placed.map(({ inst, idx }): Placed => ({ idx, id: inst.id, level: inst.level, gx: inst.gx!, gy: inst.gy! }))}
          selIdx={moveMode ? sel : null}
          canPlace={selInst ? (gx, gy) => placementAllowed(selInst.id, gx, gy) : undefined}
          onSelect={(idx) => { setSel(idx); setMoveMode(false); }}
          onMoveTo={(gx, gy) => { if (sel !== null) { dispatch({ type: "moveBuilding", index: sel, gx, gy }); setMoveMode(false); } }} />
      </PanZoom>
      <img className="bird" src="sprites/bird.png" alt="" aria-hidden="true" />

      {/* floating heads-up chip */}
      <div className="scene-chip tl">🏡 Village <span className="tag">Town Hall L{thLevel}</span></div>

      {queue.length > 0 && (
        <div className="scene-queue">
          {queue.map((o) => {
            const def = buildingById[o.building];
            const elapsed = o.startedTick === null ? 0 : state.tick - o.startedTick;
            const pct = Math.min(100, (elapsed / o.durationTicks) * 100);
            const i = state.buildQueue.indexOf(o);
            return (
              <div key={i} className="sq-item">
                <div className="queue-item" style={{ borderBottom: "none", padding: 0 }}>
                  <span>{BUILDING_ICONS[o.building]} {def.name} → L{o.targetLevel}{o.startedTick === null ? " (queued)" : ""}</span>
                  <button className="ghost" onClick={() => dispatch({ type: "cancelBuild", queueIndex: i })}>✕</button>
                </div>
                <div className="bar"><i style={{ width: pct + "%" }} /></div>
              </div>
            );
          })}
        </div>
      )}

      {/* action bar (bottom-left, clear of the right rail) */}
      <div className="scene-actions">
        {moveMode
          ? <button className="ghost" onClick={() => setMoveMode(false)}>Cancel move</button>
          : <button className="act" onClick={() => { setBuilding(true); setSel(null); }}>＋ Build</button>}
        <span className="scene-hint">{moveMode ? "Tap an empty plot to place it." : "Pinch zoom · drag pan · tap to manage"}</span>
      </div>

      {/* building management pop-up */}
      {popupOpen && selInst && selDef && (
        <div className="modal" onClick={() => setSel(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="row">
              <h3 style={{ margin: 0 }}>{BUILDING_ICONS[selInst.id]} {selDef.name} <span className="tag">L{selInst.level}</span></h3>
              <button className="ghost" onClick={() => setSel(null)}>✕</button>
            </div>
            <div className="muted" style={{ margin: "6px 0" }}>{describe(selDef)}</div>
            {(() => {
              const maxed = selInst.level >= selDef.maxLevel;
              const next = selInst.level + 1;
              const cost = buildCost(selDef, next);
              return (
                <>
                  {!maxed && <div className="cost" style={{ marginBottom: 8 }}>Upgrade → L{next}: {costString(cost)} · {fmtDuration(buildTimeTicks(selDef, next, mods), balance.tickLengthSec)} · +{Math.round(balance.researchPerLevel * next)} 📜</div>}
                  <div className="row">
                    <button className="ghost" onClick={() => setMoveMode(true)}>↔ Move</button>
                    <button className="act" disabled={maxed || !canAfford(state, cost)}
                      onClick={() => dispatch({ type: "build", building: selDef.id, instanceIndex: sel })}>
                      {maxed ? "Max level" : "Upgrade"}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* build menu pop-up */}
      {building && (
        <div className="modal" onClick={() => setBuilding(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="row"><h3 style={{ margin: 0 }}>Construct a building</h3>
              <button className="ghost" onClick={() => setBuilding(false)}>✕</button></div>
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
                        onClick={() => { dispatch({ type: "build", building: def.id, instanceIndex: null }); setBuilding(false); }}>Build</button>
                    </div>
                  );
                }),
              )}
            </div>
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
