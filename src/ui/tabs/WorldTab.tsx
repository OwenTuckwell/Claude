import { useState } from "react";
import { world, troopById, balance, factionById } from "../../sim/content";
import { scoutTravelTicks } from "../../sim/sim";
import { defenderForTile, realmInfo, key as tileKey } from "../../sim/territory";
import { computeModifiers } from "../../sim/effects";
import { type Command, type GameState } from "../../sim/types";
import { armyLabel, fmtDuration } from "../format";
import { costString } from "../helpers";

export function WorldTab({ state, dispatch }: { state: GameState; dispatch: (c: Command) => void }) {
  const mods = computeModifiers(state);
  const scoutRank = state.research["scouting"] ?? 0;
  const [sel, setSel] = useState<{ x: number; y: number } | null>(null);
  const [army, setArmy] = useState<Record<string, number>>({});
  const { w, h } = world.gridSize;
  const isLand = (x: number, y: number) => world.land[y]?.[x] === "#";
  const ownerOf = (x: number, y: number) => state.tileOwner[tileKey(x, y)];
  const info = realmInfo(state);
  const garrison = Object.entries(state.troops).filter(([, c]) => c > 0);

  const tileColor = (x: number, y: number) => {
    const o = ownerOf(x, y);
    if (o === "neutral" || !o) return (x + y) % 2 ? "#4f6437" : "#475c31";
    const c = factionById[o]?.color ?? "#888";
    return c;
  };

  const selDef = sel ? defenderForTile(state.tileOwner, sel.x, sel.y) : null;
  const selTravel = sel ? Math.max(1, Math.round((Math.max(Math.abs(sel.x - world.player.tile.x), Math.abs(sel.y - world.player.tile.y)) * balance.conquest.tileTravelPerTile) / (1 + mods.marchSpeedPct))) : 0;

  return (
    <div className="list">
      <div className="card">
        <div className="row">
          <h3 style={{ margin: 0 }}>👑 {info.isKing ? "You are King!" : info.rank}</h3>
          <span className="tag">{info.tiles} lands</span>
        </div>
        <div className="muted">Current King: <strong style={{ color: info.kingId === "player" ? "var(--gold)" : "var(--ink)" }}>{info.kingName}</strong> · hold a third of the realm to claim the Crown.</div>
      </div>

      <div className="card">
        <h3>The realm</h3>
        <div className="realm-wrap" style={{ position: "relative" }}>
          <svg className="realm-svg" width={w * 20} height={h * 20} viewBox={`0 0 ${w} ${h}`}
            style={{ width: "100%", height: "auto", display: "block", borderRadius: 8, background: "#21466e" }}>
            {Array.from({ length: w * h }, (_, i) => {
              const x = i % w, y = Math.floor(i / w);
              if (!isLand(x, y)) return null;
              return <rect key={i} x={x} y={y} width={1} height={1}
                fill={tileColor(x, y)} stroke="rgba(0,0,0,0.15)" strokeWidth={0.03}
                style={{ cursor: ownerOf(x, y) === "player" ? "default" : "pointer" }}
                onClick={() => setSel({ x, y })} />;
            })}
            {sel && <rect x={sel.x} y={sel.y} width={1} height={1} fill="none" stroke="#f5e3a0" strokeWidth={0.14} />}
          </svg>
          {[{ tile: world.player.tile, player: true, id: "player", name: "Your realm", difficulty: 0 },
            ...world.aiVillages].map((m: any) => {
            const alive = m.player || ownerOf(m.tile.x, m.tile.y) === m.id;
            return (
              <div key={m.id} className={"keep-mark" + (m.player ? " me" : "")}
                style={{ left: `${((m.tile.x + 0.5) / w) * 100}%`, top: `${((m.tile.y + 0.5) / h) * 100}%`, opacity: alive ? 1 : 0.35 }}
                title={m.name}
                onClick={() => setSel({ x: m.tile.x, y: m.tile.y })}>
                {m.player ? "🏰" : m.difficulty >= 3 ? "🛡️" : "⚔️"}
              </div>
            );
          })}
        </div>
        <div className="muted" style={{ marginTop: 6 }}>Tap any land tile to inspect it. Coloured = owned by a faction; green = unclaimed. Take land by marching an army onto it.</div>
      </div>

      {sel && selDef && (
        <div className="card">
          {ownerOf(sel.x, sel.y) === "player" ? (
            <><h3 style={{ margin: 0 }}>Your land ({sel.x},{sel.y})</h3>
              <div className="muted">Part of your realm. Keep troops at home to defend your borders.</div></>
          ) : (
            <>
              <div className="row">
                <h3 style={{ margin: 0 }}>{selDef.isCapital ? "🏯 " : "🚩 "}{factionById[selDef.ownerId]?.name ?? "Unclaimed"} ({sel.x},{sel.y})</h3>
                {selDef.isCapital && <span className="tag">capital</span>}
              </div>
              <div className="muted">Defenders: {Object.entries(selDef.garrison).map(([t, c]) => `${c} ${troopById[t]?.name ?? t}`).join(", ") || "none"}{selDef.fortifications.length ? ` · walls: ${selDef.fortifications.map((f) => `${f.building} L${f.level}`).join(", ")}` : ""}</div>
              {selDef.isCapital && <div className="cost">Taking this capital topples {factionById[selDef.ownerId]?.name} entirely.</div>}
              <h3 style={{ marginTop: 10 }}>Assemble your army <span className="muted" style={{ fontWeight: 400 }}>· ~{fmtDuration(selTravel, balance.tickLengthSec)} march</span></h3>
              {garrison.length === 0 ? <div className="muted">Train troops first (Army tab).</div> : garrison.map(([id, c]) => (
                <div className="row" key={id}>
                  <span>{troopById[id].name} <span className="muted">(have {c})</span></span>
                  <input className="num" type="number" min={0} max={c} value={army[id] ?? 0}
                    onChange={(e) => setArmy({ ...army, [id]: Math.max(0, Math.min(c, Math.floor(Number(e.target.value) || 0))) })} />
                </div>
              ))}
              <button className="act" style={{ marginTop: 8 }} disabled={Object.values(army).every((v) => !v)}
                onClick={() => { dispatch({ type: "conquer", x: sel.x, y: sel.y, army }); setArmy({}); }}>
                March to conquer
              </button>
            </>
          )}
        </div>
      )}

      <div className="card">
        <div className="row"><h3 style={{ margin: 0 }}>🧭 Scouting</h3><span className="tag">rank {scoutRank}</span></div>
        {scoutRank <= 0 ? (
          <div className="muted">Research <strong>Scouting Parties</strong> (Logistics) to send scouts into the wilds for loot.</div>
        ) : (
          <div className="row" style={{ marginTop: 8 }}>
            <div className="cost">Cost {costString(balance.scouting.sendCost)} · ~{fmtDuration(scoutTravelTicks(state, mods), balance.tickLengthSec)} round trip</div>
            <button className="act" onClick={() => dispatch({ type: "scout" })}>Send scouts</button>
          </div>
        )}
      </div>

      <div className="card">
        <h3>In the field</h3>
        {state.marches.length === 0 ? <div className="muted">Nothing afoot.</div> : state.marches.map((m) => (
          <div className="queue-item" key={m.id}>
            <span>{m.kind === "scout" ? "🧭 " : m.kind === "conquer" ? "🚩 " : "⚔️ "}{m.phase === "outbound" ? "→ " : "← "}{m.targetName}{m.kind !== "scout" ? `: ${armyLabel(m.army)}` : ""}</span>
            <span>{Math.max(0, m.arriveTick - state.tick)}t</span>
          </div>
        ))}
      </div>
    </div>
  );
}
