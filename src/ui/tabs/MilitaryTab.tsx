import { useState } from "react";
import { troops as troopDefs, troopById, buildingById, balance } from "../../sim/content";
import { isTroopUnlocked } from "../../sim/effects";
import { canAfford, costString, type TabProps } from "../helpers";
import { fmtDuration } from "../format";
import type { ResourceMap } from "../../sim/types";

const ROLE_ICON: Record<string, string> = { infantry: "🛡️", ranged: "🏹", cavalry: "🐎", siege: "🪓" };

export function MilitaryTab({ state, mods, dispatch }: TabProps) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const garrison = Object.entries(state.troops).filter(([, c]) => c > 0);

  return (
    <div className="list">
      <div className="card">
        <h3>Home garrison</h3>
        {garrison.length === 0 ? <div className="muted">No troops at home.</div> : (
          <div className="grid2">
            {garrison.map(([id, c]) => (
              <div key={id} className="row"><span>{ROLE_ICON[troopById[id].role]} {troopById[id].name}</span><strong>{c}</strong></div>
            ))}
          </div>
        )}
      </div>

      {state.trainQueue.length > 0 && (
        <div className="card">
          <h3>Training</h3>
          {state.trainQueue.map((o, i) => (
            <div className="queue-item" key={i}><span>{troopById[o.troop].name}</span><span>{o.count} left</span></div>
          ))}
        </div>
      )}

      <div className="card">
        <h3>Train troops</h3>
        <div className="list">
          {troopDefs.filter((t) => isTroopUnlocked(t.id, mods)).map((def) => {
            const n = counts[def.id] ?? 1;
            const cost: ResourceMap = {};
            for (const k of Object.keys(def.cost) as (keyof ResourceMap)[]) cost[k] = (def.cost[k] ?? 0) * n;
            const reqMissing = Object.entries(def.requires?.buildings ?? {}).find(([b, l]) => !state.buildings.some((x) => x.id === b && x.level >= l));
            return (
              <div className="row" key={def.id}>
                <div>
                  <strong>{ROLE_ICON[def.role]} {def.name}</strong>
                  <div className="cost">⚔️{def.attack} 🛡️{def.defense} ❤️{def.health} · {fmtDuration(Math.ceil(def.trainTimeSec / balance.tickLengthSec), balance.tickLengthSec)}/ea</div>
                  <div className="cost">{costString(cost)}</div>
                  {reqMissing && <div className="cost">needs {buildingById[reqMissing[0]]?.name} L{reqMissing[1]}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <input className="num" type="number" min={1} value={n}
                    onChange={(e) => setCounts({ ...counts, [def.id]: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
                  <br />
                  <button className="act" style={{ marginTop: 4 }} disabled={!!reqMissing || !canAfford(state, cost)}
                    onClick={() => dispatch({ type: "train", troop: def.id, count: n })}>Train</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
