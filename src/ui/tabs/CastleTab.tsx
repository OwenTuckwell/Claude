import { useState } from "react";
import { buildings as buildingDefs, buildingById, balance } from "../../sim/content";
import { buildCost, buildTimeTicks, castleGrid, townHallLevel, isVillageBuilding } from "../../sim/sim";
import { isBuildingUnlocked } from "../../sim/effects";
import { playerDefensePower } from "../../sim/territory";
import { canAfford, costString, type TabProps } from "../helpers";
import { fmtDuration, BUILDING_ICONS } from "../format";
import { IsoBoard, boardSize, type Placed } from "../IsoBoard";
import { PanZoom } from "../PanZoom";

// The castle as a scenic, designable defence space: lay walls, towers and the keep on the
// isometric ground; they set home defence which repels AI border raids. Same scene layout
// and tap-to-manage pop-ups as the village.
export function CastleTab({ state, mods, dispatch }: TabProps) {
  const [sel, setSel] = useState<number | null>(null);     // selected fortification index
  const [moveMode, setMoveMode] = useState(false);
  const [building, setBuilding] = useState(false);          // build menu open
  const { cols, rows } = castleGrid();
  const thLevel = townHallLevel(state);

  const defense = Math.round(playerDefensePower(state));
  const standing = Object.values(state.troops).reduce((a, c) => a + c, 0);

  const selInst = sel !== null ? state.buildings[sel] : null;
  const selDef = selInst ? buildingById[selInst.id] : null;
  const popupOpen = !!selInst && selDef && !moveMode;

  const placed = state.buildings
    .map((inst, idx) => ({ inst, idx }))
    .filter(({ inst }) => !isVillageBuilding(inst.id) && inst.gx !== undefined);

  const buildable = buildingDefs.filter((d) => d.category === "fortification" && isBuildingUnlocked(d.id, mods));
  const queue = state.buildQueue.filter((o) => !isVillageBuilding(o.building));
  const fb = boardSize(cols, rows);

  return (
    <div className="vscene" style={{ aspectRatio: `${fb.w} / ${fb.h}` }}>
      <PanZoom fill initialScale={1}>
        <IsoBoard cols={cols} rows={rows} bg="sprites/bg_castle.png" fill
          placed={placed.map(({ inst, idx }): Placed => ({ idx, id: inst.id, level: inst.level, gx: inst.gx!, gy: inst.gy! }))}
          selIdx={moveMode ? sel : null}
          onSelect={(idx) => { setSel(idx); setMoveMode(false); }}
          onMoveTo={(gx, gy) => { if (sel !== null) { dispatch({ type: "moveBuilding", index: sel, gx, gy }); setMoveMode(false); } }} />
      </PanZoom>

      <div className="scene-chip tl">🏰 Castle <span className="tag">🛡️ {defense} · ⚔️ {standing}</span></div>
      {placed.length === 0 && <div className="castle-empty">No walls yet — research <b>Masonry</b> and raise some.</div>}

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

      <div className="scene-actions">
        {moveMode
          ? <button className="ghost" onClick={() => setMoveMode(false)}>Cancel move</button>
          : <button className="act" onClick={() => { setBuilding(true); setSel(null); }}>＋ Fortify</button>}
        <span className="scene-hint">{moveMode ? "Tap a spot to place it." : "Pinch zoom · drag pan · tap to manage"}</span>
      </div>

      {/* fortification management pop-up */}
      {popupOpen && selInst && selDef && (
        <div className="modal" onClick={() => setSel(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="row">
              <h3 style={{ margin: 0 }}>{BUILDING_ICONS[selInst.id]} {selDef.name} <span className="tag">L{selInst.level}</span></h3>
              <button className="ghost" onClick={() => setSel(null)}>✕</button>
            </div>
            <div className="muted" style={{ margin: "6px 0" }}>
              Wall HP {(selDef.defense?.health ?? 0) * selInst.level}{selDef.defense?.garrisonSlots ? ` · ${selDef.defense.garrisonSlots * selInst.level} archer slots` : ""}
            </div>
            {(() => {
              const maxed = selInst.level >= selDef.maxLevel;
              const next = selInst.level + 1;
              const cost = buildCost(selDef, next);
              return (
                <>
                  {!maxed && <div className="cost" style={{ marginBottom: 8 }}>Reinforce → L{next}: {costString(cost)} · {fmtDuration(buildTimeTicks(selDef, next, mods), balance.tickLengthSec)}</div>}
                  <div className="row">
                    <button className="ghost" onClick={() => setMoveMode(true)}>↔ Move</button>
                    <button className="act" disabled={maxed || !canAfford(state, cost)}
                      onClick={() => dispatch({ type: "build", building: selDef.id, instanceIndex: sel })}>
                      {maxed ? "Max level" : "Reinforce"}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* fortify (build) pop-up */}
      {building && (
        <div className="modal" onClick={() => setBuilding(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="row"><h3 style={{ margin: 0 }}>Raise fortifications</h3>
              <button className="ghost" onClick={() => setBuilding(false)}>✕</button></div>
            {buildable.length === 0 ? <div className="muted" style={{ marginTop: 6 }}>Research <strong>Masonry</strong> (Construction) to build walls.</div> : (
              <div className="list" style={{ marginTop: 6 }}>
                {buildable.map((def) => {
                  const cost = buildCost(def, 1);
                  const missingReq = (def.requires?.buildings ?? []).find((b) => !state.buildings.some((x) => x.id === b));
                  const tier = def.tier ?? 1;
                  const tierLocked = thLevel < tier;
                  return (
                    <div className="row" key={def.id}>
                      <div>
                        <strong>{BUILDING_ICONS[def.id] ?? "🧱"} {def.name}</strong>
                        <div className="cost">HP {def.defense?.health}/lvl{def.defense?.garrisonSlots ? ` · ${def.defense.garrisonSlots} slots` : ""} · {costString(cost)} · {fmtDuration(buildTimeTicks(def, 1, mods), balance.tickLengthSec)}</div>
                        {tierLocked && <div className="cost" style={{ color: "var(--bad)" }}>🔒 needs Town Hall L{tier}</div>}
                        {missingReq && <div className="cost">needs {buildingById[missingReq]?.name}</div>}
                      </div>
                      <button className="act" disabled={tierLocked || !!missingReq || !canAfford(state, cost)}
                        onClick={() => { dispatch({ type: "build", building: def.id, instanceIndex: null }); setBuilding(false); }}>Build</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
