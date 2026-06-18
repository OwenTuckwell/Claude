import { useState } from "react";
import { buildings as buildingDefs, buildingById, balance } from "../../sim/content";
import { buildCost, buildTimeTicks, castleGrid, isVillageBuilding } from "../../sim/sim";
import { isBuildingUnlocked } from "../../sim/effects";
import { playerDefensePower } from "../../sim/territory";
import { canAfford, costString, type TabProps } from "../helpers";
import { fmtDuration, BUILDING_ICONS } from "../format";
import { BuildingSprite } from "../BuildingSprite";

// Phase 3 — the castle as a designable defence space (docs/05 §3, Appendix A).
// Lay out walls/towers/keep on the castle grid; they set home defence, which repels AI
// border raids. The troops that defend are your standing army.
export function CastleTab({ state, mods, dispatch }: TabProps) {
  const [sel, setSel] = useState<number | null>(null);
  const [building, setBuilding] = useState(false);
  const { cols, rows } = castleGrid();

  const defense = Math.round(playerDefensePower(state));
  const standing = Object.values(state.troops).reduce((a, c) => a + c, 0);
  const busy = new Set(state.buildQueue.map((o) => o.instanceIndex).filter((x): x is number => x !== null));
  const selInst = sel !== null ? state.buildings[sel] : null;
  const selDef = selInst ? buildingById[selInst.id] : null;
  const selIsFort = !!selInst && !isVillageBuilding(selInst.id);
  const buildable = buildingDefs.filter((d) => d.category === "fortification" && isBuildingUnlocked(d.id, mods));

  const placed = state.buildings
    .map((b, idx) => ({ b, idx }))
    .filter(({ b }) => buildingById[b.id].category === "fortification" && b.gx !== undefined);

  return (
    <div className="list">
      <div className="card" style={{ padding: 8 }}>
        <div className="row" style={{ marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>🏰 Castle layout</h3>
          <span>🛡️ <strong style={{ color: "var(--gold)" }}>{defense}</strong> · ⚔️ {standing}</span>
        </div>
        <div className="vgrid-wrap" style={{ position: "relative" }}>
          <svg className="cgrid" width={cols * 40} height={rows * 40} viewBox={`0 0 ${cols} ${rows}`}
            style={{ width: "100%", height: "auto", display: "block", borderRadius: 8 }}>
            {Array.from({ length: cols * rows }, (_, i) => {
              const x = i % cols, y = Math.floor(i / cols);
              const occupied = placed.some(({ b }) => b.gx === x && b.gy === y);
              const isMoveTarget = selIsFort && !occupied;
              return <rect key={i} x={x} y={y} width={1} height={1}
                fill={(x + y) % 2 ? "#9a948b" : "#8f897f"} stroke="rgba(46,38,32,0.22)" strokeWidth={0.03}
                style={{ cursor: isMoveTarget ? "copy" : "default" }}
                onClick={() => { if (isMoveTarget && sel !== null) dispatch({ type: "moveBuilding", index: sel, gx: x, gy: y }); }} />;
            })}
            {selInst && selIsFort && selInst.gx !== undefined &&
              <rect x={selInst.gx} y={selInst.gy} width={1} height={1} fill="none" stroke="#b07d1a" strokeWidth={0.12} />}
          </svg>
          {placed.length === 0 && <div className="castle-empty">No walls yet — research <b>Masonry</b> and raise some.</div>}
          {placed.map(({ b, idx }) => (
            <button key={idx} className={"vbuild" + (sel === idx ? " sel" : "") + (busy.has(idx) ? " busy" : "")}
              style={{ left: `${((b.gx! + 0.5) / cols) * 100}%`, top: `${((b.gy! + 0.5) / rows) * 100}%` }}
              title={buildingById[b.id].name}
              onClick={() => { setSel(idx === sel ? null : idx); setBuilding(false); }}>
              <span className="vb-ic"><BuildingSprite id={b.id} /></span>
              <span className="vb-lv">{b.level}</span>
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <span className="muted">{selIsFort ? "Tap a stone tile to move it." : "Tap a structure to inspect it."}</span>
          <button className="act" onClick={() => { setBuilding(true); setSel(null); }}>＋ Fortify</button>
        </div>
      </div>

      {selInst && selDef && (
        <div className="card">
          <div className="row">
            <h3 style={{ margin: 0 }}>{BUILDING_ICONS[selInst.id]} {selDef.name} <span className="tag">L{selInst.level}</span></h3>
            <button className="ghost" onClick={() => setSel(null)}>Close</button>
          </div>
          <div className="muted">Wall HP {(selDef.defense?.health ?? 0) * selInst.level}{selDef.defense?.garrisonSlots ? ` · ${selDef.defense.garrisonSlots * selInst.level} archer slots` : ""}</div>
          {(() => {
            const maxed = selInst.level >= selDef.maxLevel;
            const next = selInst.level + 1;
            const cost = buildCost(selDef, next);
            return (
              <div className="row" style={{ marginTop: 8 }}>
                <div className="cost">{maxed ? "Fully upgraded." : `${costString(cost)} · ${fmtDuration(buildTimeTicks(selDef, next, mods), balance.tickLengthSec)}`}</div>
                <button className="act" disabled={maxed || !canAfford(state, cost)}
                  onClick={() => dispatch({ type: "build", building: selDef.id, instanceIndex: sel })}>
                  {maxed ? "Max" : `Reinforce → L${next}`}
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {building && (
        <div className="card">
          <div className="row"><h3 style={{ margin: 0 }}>Raise new fortifications</h3>
            <button className="ghost" onClick={() => setBuilding(false)}>Close</button></div>
          {buildable.length === 0 ? <div className="muted">Research <strong>Masonry</strong> (Construction) to build walls.</div> : (
            <div className="list" style={{ marginTop: 6 }}>
              {buildable.map((def) => {
                const cost = buildCost(def, 1);
                const missing = (def.requires?.buildings ?? []).find((b) => !state.buildings.some((x) => x.id === b));
                return (
                  <div className="row" key={def.id}>
                    <div>
                      <strong>{BUILDING_ICONS[def.id] ?? "🧱"} {def.name}</strong>
                      <div className="cost">HP {def.defense?.health}/lvl{def.defense?.garrisonSlots ? ` · ${def.defense.garrisonSlots} slots` : ""} · {costString(cost)} · {fmtDuration(buildTimeTicks(def, 1, mods), balance.tickLengthSec)}</div>
                      {missing && <div className="cost">needs {buildingById[missing]?.name}</div>}
                    </div>
                    <button className="act" disabled={!!missing || !canAfford(state, cost)}
                      onClick={() => dispatch({ type: "build", building: def.id, instanceIndex: null })}>Build</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
