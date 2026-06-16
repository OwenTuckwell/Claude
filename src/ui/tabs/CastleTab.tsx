import { useState } from "react";
import { buildings as buildingDefs, buildingById, balance } from "../../sim/content";
import { buildCost, buildTimeTicks } from "../../sim/sim";
import { isBuildingUnlocked } from "../../sim/effects";
import { playerDefensePower } from "../../sim/territory";
import { canAfford, costString, type TabProps } from "../helpers";
import { fmtDuration, BUILDING_ICONS } from "../format";

// Phase 3 — the castle as a distinct defence space (docs/05 §3, Appendix A).
// Your fortifications here set home defence, which repels AI border raids; the troops
// that defend are the same standing army you'd send to attack.
export function CastleTab({ state, mods, dispatch }: TabProps) {
  const [sel, setSel] = useState<number | null>(null);
  const forts = state.buildings.map((b, i) => ({ b, i })).filter(({ b }) => buildingById[b.id].category === "fortification");
  const defense = Math.round(playerDefensePower(state));
  const standing = Object.values(state.troops).reduce((a, c) => a + c, 0);
  const busy = new Set(state.buildQueue.map((o) => o.instanceIndex).filter((x): x is number => x !== null));
  const selInst = sel !== null ? state.buildings[sel] : null;
  const selDef = selInst ? buildingById[selInst.id] : null;
  const buildable = buildingDefs.filter((d) => d.category === "fortification" && isBuildingUnlocked(d.id, mods));

  return (
    <div className="list">
      <div className="card" style={{ textAlign: "center" }}>
        <h3>🏰 Your castle</h3>
        <div className="castle">
          <div className="castle-keep">🏰</div>
          <div className="battlement">
            {forts.length === 0 ? <span className="muted">No walls yet — your keep stands exposed.</span>
              : forts.map(({ b, i }) => (
                <button key={i} className={"fort" + (sel === i ? " sel" : "") + (busy.has(i) ? " busy" : "")}
                  onClick={() => setSel(i === sel ? null : i)} title={buildingById[b.id].name}>
                  <span className="fort-ic">{BUILDING_ICONS[b.id] ?? "🧱"}</span>
                  <span className="fort-lv">L{b.level}</span>
                </button>
              ))}
          </div>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <span>🛡️ Defence rating <strong style={{ color: "var(--gold)" }}>{defense}</strong></span>
          <span className="muted">⚔️ {standing} troops at home</span>
        </div>
        <div className="muted" style={{ marginTop: 4 }}>Defence = your standing army + fortifications. Rivals that out-muscle it can seize a border tile — keep it strong.</div>
      </div>

      {selInst && selDef && (
        <div className="card">
          <div className="row"><h3 style={{ margin: 0 }}>{BUILDING_ICONS[selInst.id]} {selDef.name} <span className="tag">L{selInst.level}</span></h3></div>
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

      <div className="card">
        <h3>Raise new fortifications</h3>
        {buildable.length === 0 ? <div className="muted">Research <strong>Masonry</strong> (Construction) to build walls.</div> : (
          <div className="list">
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
    </div>
  );
}
