import { useEffect, useState } from "react";
import { buildings as buildingDefs, buildingById, balance } from "../../sim/content";
import { buildCost, buildTimeTicks, castleGrid, townHallLevel, isVillageBuilding, firstFreeCastleCell, canPlaceAt } from "../../sim/sim";
import { isBuildingUnlocked } from "../../sim/effects";
import { playerDefensePower, castleEnclosure } from "../../sim/territory";
import { canAfford, costString, type TabProps } from "../helpers";
import { fmtDuration, BUILDING_ICONS } from "../format";
import { IsoBoard, boardSize, type Placed } from "../IsoBoard";
import { PanZoom } from "../PanZoom";
import { bannerTier, BANNER_RANKS } from "../../sim/renown";

// The castle as a scenic, designable defence space: lay walls, towers and the keep on the
// isometric ground; they set home defence which repels AI border raids. Same scene layout
// and tap-to-manage pop-ups as the village.
const ROTATABLE = new Set(["wall", "wall_corner"]);   // edge pieces you can rotate

export function CastleTab({ state, mods, dispatch }: TabProps) {
  const [sel, setSel] = useState<number | null>(null);     // selected fortification index
  const [moveMode, setMoveMode] = useState(false);
  const [building, setBuilding] = useState(false);          // build menu open
  const { cols, rows } = castleGrid();
  const thLevel = townHallLevel(state);
  const playerTier = bannerTier(state.resources.renown ?? 0);

  const defense = Math.round(playerDefensePower(state));
  const standing = Object.values(state.troops).reduce((a, c) => a + c, 0);
  const enclosure = castleEnclosure(state.buildings);
  const hasKeep = state.buildings.some((b) => b.id === "keep");

  const pendingIdx = state.buildings.findIndex((b) => !isVillageBuilding(b.id) && b.gx === undefined);
  const pendingInst = pendingIdx >= 0 ? state.buildings[pendingIdx] : null;

  const selInst = sel !== null ? state.buildings[sel] : null;
  const selDef = selInst ? buildingById[selInst.id] : null;
  const placingExisting = moveMode && sel !== null && !pendingInst;
  const placeIdx = pendingInst ? pendingIdx : (placingExisting ? sel! : null);
  const placeId = pendingInst ? pendingInst.id : (placingExisting ? selInst!.id : undefined);
  const popupOpen = !!selInst && selDef && !moveMode && !pendingInst;

  const [drag, setDrag] = useState<{ gx: number; gy: number } | null>(null);
  useEffect(() => {
    if (placeIdx === null) { setDrag(null); return; }
    const inst = state.buildings[placeIdx];
    setDrag(inst.gx !== undefined ? { gx: inst.gx, gy: inst.gy! } : firstFreeCastleCell(state.buildings));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeIdx]);
  const dragValid = !!drag && !!placeId && canPlaceAt(state.buildings, placeIdx ?? -1, placeId, drag.gx, drag.gy);
  const confirmPlace = () => { if (drag && placeIdx !== null) { dispatch({ type: "moveBuilding", index: placeIdx, gx: drag.gx, gy: drag.gy }); setMoveMode(false); setDrag(null); } };

  const placed = state.buildings
    .map((inst, idx) => ({ inst, idx }))
    .filter(({ inst }) => !isVillageBuilding(inst.id) && inst.gx !== undefined);

  const buildable = buildingDefs.filter((d) => d.category === "fortification" && isBuildingUnlocked(d.id, mods));
  const queue = state.buildQueue.filter((o) => !isVillageBuilding(o.building));
  const fb = boardSize(cols, rows);

  return (
    <div className="vscene" style={{ aspectRatio: `${fb.w} / ${fb.h}` }}>
      <PanZoom fill initialScale={1} lockPan={placeIdx !== null}>
        <IsoBoard cols={cols} rows={rows} bg="sprites/bg_castle.png" fill
          placed={placed.map(({ inst, idx }): Placed => ({ idx, id: inst.id, level: inst.level, gx: inst.gx!, gy: inst.gy!, rot: inst.rot }))}
          selIdx={placingExisting ? sel : null}
          placeId={pendingInst ? pendingInst.id : undefined}
          placeRot={placeIdx !== null ? (state.buildings[placeIdx]?.rot ?? 0) : 0}
          dragCell={drag} dragValid={dragValid} onDragMove={(gx, gy) => setDrag({ gx, gy })}
          onSelect={(idx) => { if (placeIdx === null) { setSel(idx); setMoveMode(false); } }} />
      </PanZoom>

      <div className="scene-chip tl">🏰 Castle <span className="tag">🛡️ {defense} · ⚔️ {standing} · 🧱 {Math.round(enclosure * 100)}%</span></div>
      <div className="scene-chip tl2" style={{ color: enclosure >= 0.99 ? "#8fe36b" : enclosure >= 0.7 ? "#f1d985" : "#e6a07a" }}>
        {hasKeep
          ? enclosure >= 0.99 ? "🧱 Keep fully enclosed — walls at full strength in a siege."
            : `🧱 Keep ${Math.round(enclosure * 100)}% enclosed — ring it with walls for full defence.`
          : "🏯 Build a Keep and wall it in — an enclosed keep makes your walls count."}
      </div>
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
        {pendingInst
          ? <><button className="act" disabled={!dragValid} onClick={confirmPlace}>✓ Place here</button>
              {ROTATABLE.has(placeId ?? "") && <button className="ghost" onClick={() => dispatch({ type: "rotateBuilding", index: placeIdx! })}>⟳ Rotate</button>}
              <span className="scene-hint">Drag your {buildingById[pendingInst.id].name} to a spot{ROTATABLE.has(placeId ?? "") ? ", rotate to aim the wall," : ""} then Place.</span></>
          : moveMode
            ? <><button className="act" disabled={!dragValid} onClick={confirmPlace}>✓ Set here</button>
                {ROTATABLE.has(placeId ?? "") && <button className="ghost" onClick={() => dispatch({ type: "rotateBuilding", index: placeIdx! })}>⟳ Rotate</button>}
                <button className="ghost" onClick={() => { setMoveMode(false); setDrag(null); }}>Cancel</button>
                <span className="scene-hint">Drag it where you want it{ROTATABLE.has(placeId ?? "") ? " · rotate to aim" : ""}.</span></>
            : <><button className="act" onClick={() => { setBuilding(true); setSel(null); }}>＋ Fortify</button>
                <span className="scene-hint">Pinch zoom · drag pan · tap to manage</span></>}
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
                    {ROTATABLE.has(selInst.id) && <button className="ghost" onClick={() => dispatch({ type: "rotateBuilding", index: sel! })}>⟳ Rotate</button>}
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
      {building && !pendingInst && (
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
                  const needRank = def.requires?.bannerTier ?? 0;
                  const rankLocked = needRank > playerTier;
                  return (
                    <div className="row" key={def.id}>
                      <div>
                        <strong>{BUILDING_ICONS[def.id] ?? "🧱"} {def.name}</strong>
                        <div className="cost">HP {def.defense?.health}/lvl{def.defense?.garrisonSlots ? ` · ${def.defense.garrisonSlots} slots` : ""} · {costString(cost)} · {fmtDuration(buildTimeTicks(def, 1, mods), balance.tickLengthSec)}</div>
                        {tierLocked && <div className="cost" style={{ color: "var(--bad)" }}>🔒 needs Town Hall L{tier}</div>}
                        {rankLocked && <div className="cost" style={{ color: "var(--bad)" }}>🏅 needs Banner Rank: {BANNER_RANKS[needRank].title}</div>}
                        {missingReq && <div className="cost">needs {buildingById[missingReq]?.name}</div>}
                      </div>
                      <button className="act" disabled={tierLocked || rankLocked || !!missingReq || !canAfford(state, cost)}
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
