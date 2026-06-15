import { useState } from "react";
import { world, aiById, troopById } from "../../sim/content";
import { RESOURCE_IDS, type Command, type GameState } from "../../sim/types";
import { RESOURCE_META, armyLabel } from "../format";

export function WorldTab({ state, dispatch }: { state: GameState; dispatch: (c: Command) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const [army, setArmy] = useState<Record<string, number>>({});
  const { w, h } = world.gridSize;
  const aiAt = new Map(world.aiVillages.map((v) => [`${v.tile.x},${v.tile.y}`, v]));

  const village = sel ? aiById[sel] : null;
  const garrison = Object.entries(state.troops).filter(([, c]) => c > 0);

  return (
    <div className="list">
      <div className="card">
        <h3>The region</h3>
        <div className="map" style={{ gridTemplateColumns: `repeat(${w}, 1fr)` }}>
          {Array.from({ length: w * h }, (_, i) => {
            const x = i % w, y = Math.floor(i / w);
            const isPlayer = x === world.player.tile.x && y === world.player.tile.y;
            const ai = aiAt.get(`${x},${y}`);
            const looted = ai ? state.tick < state.aiState[ai.id].lootedUntilTick : false;
            return (
              <div key={i}
                className={"cell" + (isPlayer ? " player" : "") + (ai ? " ai" : "") + (looted ? " looted" : "")}
                title={ai?.name ?? (isPlayer ? "Your village" : "")}
                onClick={() => ai && setSel(ai.id)}>
                {isPlayer ? "🏰" : ai ? "⚔️" : ""}
              </div>
            );
          })}
        </div>
        <div className="muted" style={{ marginTop: 6 }}>Tap a 🏴 keep to plan an assault. Faded keeps were recently looted (regrowing).</div>
      </div>

      {village && (
        <div className="card">
          <div className="row"><h3 style={{ margin: 0 }}>{village.name}</h3><span className="tag">difficulty {village.difficulty}</span></div>
          <div className="muted">Defenders: {village.garrison.map((g) => `${g.count} ${troopById[g.troop].name}`).join(", ")}</div>
          <div className="muted">Walls: {village.fortifications.map((f) => `${f.building} L${f.level}`).join(", ") || "none"}</div>
          <div className="cost">Loot: {RESOURCE_IDS.filter((r) => village.loot[r]).map((r) => `${RESOURCE_META[r].icon}${village.loot[r]}`).join("  ")}</div>
          <h3 style={{ marginTop: 10 }}>Assemble your army</h3>
          {garrison.length === 0 ? <div className="muted">Train troops first (Army tab).</div> : garrison.map(([id, c]) => (
            <div className="row" key={id}>
              <span>{troopById[id].name} <span className="muted">(have {c})</span></span>
              <input className="num" type="number" min={0} max={c} value={army[id] ?? 0}
                onChange={(e) => setArmy({ ...army, [id]: Math.max(0, Math.min(c, Math.floor(Number(e.target.value) || 0))) })} />
            </div>
          ))}
          <button className="act" style={{ marginTop: 8 }}
            disabled={Object.values(army).every((v) => !v)}
            onClick={() => { dispatch({ type: "attack", targetId: village.id, army }); setArmy({}); }}>
            March &amp; assault
          </button>
        </div>
      )}

      <div className="card">
        <h3>Armies in the field</h3>
        {state.marches.length === 0 ? <div className="muted">No armies marching.</div> : state.marches.map((m) => (
          <div className="queue-item" key={m.id}>
            <span>{m.phase === "outbound" ? "→ " : "← "}{aiById[m.targetId].name}: {armyLabel(m.army)}</span>
            <span>{Math.max(0, m.arriveTick - state.tick)}t</span>
          </div>
        ))}
      </div>
    </div>
  );
}
