import { useEffect, useState } from "react";
import { buildings as buildingDefs, buildingById, balance } from "../../sim/content";
import { buildCost, buildTimeTicks, townHallLevel, villageGrid, isVillageBuilding, placementAllowed, firstFreeVillageCell, canPlaceAt } from "../../sim/sim";
import { isBuildingUnlocked } from "../../sim/effects";
import { canAfford, costString, type TabProps } from "../helpers";
import { fmtDuration, BUILDING_ICONS } from "../format";
import { IsoBoard, boardSize, type Placed } from "../IsoBoard";
import { PanZoom } from "../PanZoom";
import { bannerTier, BANNER_RANKS } from "../../sim/renown";
import type { BuildingDef } from "../../sim/types";

const CATEGORY_ORDER = ["production", "storage", "housing", "civic", "military"] as const;

export function VillageTab({ state, mods, dispatch }: TabProps) {
  const [sel, setSel] = useState<number | null>(null);     // selected building index
  const [moveMode, setMoveMode] = useState(false);
  const [building, setBuilding] = useState(false);          // build menu open
  const { cols, rows } = villageGrid();
  const thLevel = townHallLevel(state);
  const playerTier = bannerTier(state.resources.renown ?? 0);

  // a just-finished building waits unplaced (no gx) until the player taps a plot for it
  const pendingIdx = state.buildings.findIndex((b) => isVillageBuilding(b.id) && b.gx === undefined);
  const pendingInst = pendingIdx >= 0 ? state.buildings[pendingIdx] : null;

  const selInst = sel !== null ? state.buildings[sel] : null;
  const selDef = selInst ? buildingById[selInst.id] : null;
  const placingExisting = moveMode && sel !== null && !pendingInst;
  const placeIdx = pendingInst ? pendingIdx : (placingExisting ? sel! : null);
  const placeId = pendingInst ? pendingInst.id : (placingExisting ? selInst!.id : undefined);
  const popupOpen = !!selInst && selDef && !moveMode && !pendingInst;

  // drag-to-place: a tentative tile the player drags the building to, confirmed with Set.
  const [drag, setDrag] = useState<{ gx: number; gy: number } | null>(null);
  useEffect(() => {
    if (placeIdx === null) { setDrag(null); return; }
    const inst = state.buildings[placeIdx];
    setDrag(inst.gx !== undefined ? { gx: inst.gx, gy: inst.gy! } : firstFreeVillageCell(state.buildings, inst.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeIdx]);
  const dragValid = !!drag && !!placeId && canPlaceAt(state.buildings, placeIdx ?? -1, placeId, drag.gx, drag.gy);
  const confirmPlace = () => { if (drag && placeIdx !== null) { dispatch({ type: "moveBuilding", index: placeIdx, gx: drag.gx, gy: drag.gy }); setMoveMode(false); setDrag(null); } };

  const placed = state.buildings
    .map((inst, idx) => ({ inst, idx }))
    .filter(({ inst }) => isVillageBuilding(inst.id) && inst.gx !== undefined);

  const queue = state.buildQueue.filter((o) => isVillageBuilding(o.building));
  const fb = boardSize(cols, rows);

  return (
    <div className="vscene" style={{ aspectRatio: `${fb.w} / ${fb.h}` }}>
      <PanZoom fill initialScale={1} lockPan={placeIdx !== null}>
        <IsoBoard cols={cols} rows={rows} bg="sprites/bg_village.png" fill field={{ scale: 0.984, cx: 0.452, cy: 0.491 }}
          placed={placed.map(({ inst, idx }): Placed => ({ idx, id: inst.id, level: inst.level, gx: inst.gx!, gy: inst.gy! }))}
          selIdx={placingExisting ? sel : null}
          placeId={pendingInst ? pendingInst.id : undefined}
          dragCell={drag} dragValid={dragValid} onDragMove={(gx, gy) => setDrag({ gx, gy })}
          canPlace={placeId ? (gx, gy) => placementAllowed(placeId, gx, gy) : undefined}
          onSelect={(idx) => { if (placeIdx === null) { setSel(idx); setMoveMode(false); } }} />
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
        {pendingInst
          ? <><button className="act" disabled={!dragValid} onClick={confirmPlace}>✓ Place here</button>
              <span className="scene-hint">Drag your {buildingById[pendingInst.id].name} to a spot, then Place.</span></>
          : moveMode
            ? <><button className="act" disabled={!dragValid} onClick={confirmPlace}>✓ Set here</button>
                <button className="ghost" onClick={() => { setMoveMode(false); setDrag(null); }}>Cancel</button>
                <span className="scene-hint">Drag it where you want it.</span></>
            : <><button className="act" onClick={() => { setBuilding(true); setSel(null); }}>＋ Build</button>
                <span className="scene-hint">Pinch zoom · drag pan · tap to manage</span></>}
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
      {building && !pendingInst && (
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
                  const needRank = def.requires?.bannerTier ?? 0;
                  const rankLocked = needRank > playerTier;
                  return (
                    <div className="row" key={def.id}>
                      <div>
                        <strong>{BUILDING_ICONS[def.id] ?? "🏠"} {def.name}</strong> <span className="tag">{def.category}</span>
                        <div className="cost">{costString(cost)} · {fmtDuration(buildTimeTicks(def, 1, mods), balance.tickLengthSec)}</div>
                        {tierLocked && <div className="cost" style={{ color: "var(--bad)" }}>🔒 needs Town Hall L{tier}</div>}
                        {rankLocked && <div className="cost" style={{ color: "var(--bad)" }}>🏅 needs Banner Rank: {BANNER_RANKS[needRank].title}</div>}
                        {missingReq && <div className="cost">needs {buildingById[missingReq]?.name}</div>}
                      </div>
                      <button className="act" disabled={tierLocked || rankLocked || !!missingReq || !canAfford(state, cost)}
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
