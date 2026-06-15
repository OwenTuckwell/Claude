import { buildings as buildingDefs, buildingById, balance } from "../../sim/content";
import { buildCost, buildTimeTicks } from "../../sim/sim";
import { isBuildingUnlocked } from "../../sim/effects";
import { canAfford, costString, type TabProps } from "../helpers";
import { fmtDuration } from "../format";

const CATEGORY_ORDER = ["production", "storage", "housing", "civic", "military", "fortification"] as const;

export function VillageTab({ state, mods, dispatch }: TabProps) {
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
                  <span>{def.name} → L{o.targetLevel} {o.startedTick === null ? "(queued)" : ""}</span>
                  <button className="ghost" onClick={() => dispatch({ type: "cancelBuild", queueIndex: i })}>Cancel</button>
                </div>
                <div className="bar"><i style={{ width: pct + "%" }} /></div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        <h3>Your buildings</h3>
        <div className="list">
          {state.buildings.map((inst, idx) => {
            const def = buildingById[inst.id];
            const maxed = inst.level >= def.maxLevel;
            const next = inst.level + 1;
            const cost = buildCost(def, next);
            return (
              <div className="row" key={idx}>
                <div>
                  <strong>{def.name}</strong> <span className="tag">L{inst.level}</span>
                  {!maxed && <div className="cost">{costString(cost)} · {fmtDuration(buildTimeTicks(def, next, mods), balance.tickLengthSec)}</div>}
                </div>
                <button className="act" disabled={maxed || !canAfford(state, cost)}
                  onClick={() => dispatch({ type: "build", building: def.id, instanceIndex: idx })}>
                  {maxed ? "Max" : "Upgrade"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3>Construct new</h3>
        <div className="list">
          {CATEGORY_ORDER.flatMap((cat) =>
            buildingDefs.filter((d) => d.category === cat && isBuildingUnlocked(d.id, mods)).map((def) => {
              const cost = buildCost(def, 1);
              const missingReq = (def.requires?.buildings ?? []).find((b) => !state.buildings.some((x) => x.id === b));
              return (
                <div className="row" key={def.id}>
                  <div>
                    <strong>{def.name}</strong> <span className="tag">{def.category}</span>
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
    </div>
  );
}
