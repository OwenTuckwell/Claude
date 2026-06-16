import { useState } from "react";
import { world, aiById, troopById, balance } from "../../sim/content";
import { scoutTravelTicks } from "../../sim/sim";
import { computeModifiers } from "../../sim/effects";
import { RESOURCE_IDS, type Command, type GameState } from "../../sim/types";
import { RESOURCE_META, armyLabel, fmtDuration } from "../format";
import { costString } from "../helpers";

export function WorldTab({ state, dispatch }: { state: GameState; dispatch: (c: Command) => void }) {
  const mods = computeModifiers(state);
  const scoutRank = state.research["scouting"] ?? 0;
  const [sel, setSel] = useState<string | null>(null);
  const [army, setArmy] = useState<Record<string, number>>({});
  const { w, h } = world.gridSize;
  const isLand = (x: number, y: number) => world.land[y]?.[x] === "#";

  const village = sel ? aiById[sel] : null;
  const garrison = Object.entries(state.troops).filter(([, c]) => c > 0);

  return (
    <div className="list">
      <div className="card">
        <h3>The realm</h3>
        {/* SVG map (reliable sizing — no CSS aspect-ratio). Markers overlaid in HTML. */}
        <div className="realm-wrap" style={{ position: "relative" }}>
          <svg className="realm-svg" width={w * 20} height={h * 20} viewBox={`0 0 ${w} ${h}`}
            style={{ width: "100%", height: "auto", display: "block", borderRadius: 8, background: "#21466e" }}>
            {Array.from({ length: w * h }, (_, i) => {
              const x = i % w, y = Math.floor(i / w);
              if (!isLand(x, y)) return null;
              const coast = !isLand(x - 1, y) || !isLand(x + 1, y) || !isLand(x, y - 1) || !isLand(x, y + 1);
              return <rect key={i} x={x} y={y} width={1} height={1}
                fill={(x + y) % 2 ? "#46602e" : "#425a2b"}
                stroke={coast ? "rgba(228,212,150,0.25)" : "none"} strokeWidth={coast ? 0.06 : 0} />;
            })}
          </svg>
          {/* player + enemy keep markers */}
          {[{ tile: world.player.tile, player: true, id: "player", name: "Your realm", difficulty: 0 },
            ...world.aiVillages].map((m: any) => {
            const looted = !m.player && state.tick < (state.aiState[m.id]?.lootedUntilTick ?? 0);
            return (
              <div key={m.id}
                className={"keep-mark" + (m.player ? " me" : "") + (sel === m.id ? " sel" : "") + (looted ? " looted" : "")}
                style={{ left: `${((m.tile.x + 0.5) / w) * 100}%`, top: `${((m.tile.y + 0.5) / h) * 100}%` }}
                title={m.name}
                onClick={() => !m.player && setSel(m.id)}>
                {m.player ? "🏰" : m.difficulty >= 3 ? "🛡️" : "⚔️"}
              </div>
            );
          })}
        </div>
        <div className="muted" style={{ marginTop: 6 }}>🏰 your realm · ⚔️/🛡️ enemy keeps (🛡️ = strongest). Tap a keep to plan an assault; faded keeps were recently looted.</div>
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
        <div className="row"><h3 style={{ margin: 0 }}>🧭 Scouting</h3><span className="tag">rank {scoutRank}</span></div>
        {scoutRank <= 0 ? (
          <div className="muted">Research <strong>Scouting Parties</strong> (Logistics) to send scouts into the wilds for loot.</div>
        ) : (
          <>
            <div className="muted">Send a scouting party to comb the wilds for supplies. Higher ranks find more, faster.</div>
            <div className="row" style={{ marginTop: 8 }}>
              <div className="cost">Cost {costString(balance.scouting.sendCost)} · ~{fmtDuration(scoutTravelTicks(state, mods), balance.tickLengthSec)} round trip</div>
              <button className="act" onClick={() => dispatch({ type: "scout" })}>Send scouts</button>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h3>In the field</h3>
        {state.marches.length === 0 ? <div className="muted">Nothing afoot.</div> : state.marches.map((m) => (
          <div className="queue-item" key={m.id}>
            <span>{m.kind === "scout" ? "🧭 " : "⚔️ "}{m.phase === "outbound" ? "→ " : "← "}{m.targetName}{m.kind === "assault" ? `: ${armyLabel(m.army)}` : ""}</span>
            <span>{Math.max(0, m.arriveTick - state.tick)}t</span>
          </div>
        ))}
      </div>
    </div>
  );
}
