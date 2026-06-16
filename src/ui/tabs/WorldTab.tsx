import { useState } from "react";
import { world, aiById, troopById, balance, factionById } from "../../sim/content";
import { scoutTravelTicks } from "../../sim/sim";
import { defenderForTile, realmInfo, key as tileKey, nearestOwnedTile } from "../../sim/territory";
import { archetypeInfoFor } from "../../sim/rivals";
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

  // Earthy grass tones per docs/art-style.md §4 (environment stays muted; saturated
  // colour is reserved for faction heraldry so ownership pops).
  const TERRAIN = ["#7a8c4e", "#728345", "#6a7b40", "#5f6f3c"];
  const tileColor = (x: number, y: number) => {
    const o = ownerOf(x, y);
    if (o === "neutral" || !o) return TERRAIN[(x * 7 + y * 13) % TERRAIN.length];
    return factionById[o]?.color ?? "#888";
  };

  const selDef = sel ? defenderForTile(state.tileOwner, sel.x, sel.y) : null;
  const selDist = sel ? nearestOwnedTile(state.tileOwner, sel.x, sel.y).dist : 0;
  const selTravel = Math.max(1, Math.round((selDist * balance.conquest.tileTravelPerTile) / (1 + mods.marchSpeedPct)));

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
            style={{ width: "100%", height: "auto", display: "block", borderRadius: 8 }}>
            {Array.from({ length: w * h }, (_, i) => {
              const x = i % w, y = Math.floor(i / w);
              if (!isLand(x, y)) return null;
              const coast = !isLand(x - 1, y) || !isLand(x + 1, y) || !isLand(x, y - 1) || !isLand(x, y + 1);
              return <rect key={"t" + i} x={x} y={y} width={1} height={1}
                fill={tileColor(x, y)} stroke={coast ? "rgba(12,28,44,0.55)" : "none"} strokeWidth={coast ? 0.12 : 0}
                style={{ cursor: ownerOf(x, y) === "player" ? "default" : "pointer" }}
                onClick={() => setSel({ x, y })} />;
            })}
            {/* faction borders: edges where ownership changes */}
            {(() => {
              const lines: any[] = [];
              for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                const o = ownerOf(x, y);
                if (!o || o === "neutral" || !isLand(x, y)) continue;
                const stroke = o === "player" ? "#f0e6c8" : "rgba(255,255,255,0.55)";
                if (ownerOf(x + 1, y) !== o) lines.push(<line key={`vr${x}_${y}`} x1={x + 1} y1={y} x2={x + 1} y2={y + 1} stroke={stroke} strokeWidth={0.08} />);
                if (ownerOf(x - 1, y) !== o) lines.push(<line key={`vl${x}_${y}`} x1={x} y1={y} x2={x} y2={y + 1} stroke={stroke} strokeWidth={0.08} />);
                if (ownerOf(x, y + 1) !== o) lines.push(<line key={`hb${x}_${y}`} x1={x} y1={y + 1} x2={x + 1} y2={y + 1} stroke={stroke} strokeWidth={0.08} />);
                if (ownerOf(x, y - 1) !== o) lines.push(<line key={`ht${x}_${y}`} x1={x} y1={y} x2={x + 1} y2={y} stroke={stroke} strokeWidth={0.08} />);
              }
              return lines;
            })()}
            {sel && <rect x={sel.x} y={sel.y} width={1} height={1} fill="none" stroke="#f5e3a0" strokeWidth={0.18} />}
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
          {/* armies marching across the realm (glide via CSS transition each tick) */}
          {state.marches.map((m) => {
            const dest = m.kind === "conquer" ? m.targetTile : m.kind === "assault" ? aiById[m.targetId]?.tile : null;
            if (!dest) return null;
            const origin = nearestOwnedTile(state.tileOwner, dest.x, dest.y);
            const prog = Math.max(0, Math.min(1, 1 - Math.max(0, m.arriveTick - state.tick) / m.travelTicks));
            const from = m.phase === "outbound" ? origin : dest;
            const to = m.phase === "outbound" ? dest : origin;
            const px = ((from.x + (to.x - from.x) * prog + 0.5) / w) * 100;
            const py = ((from.y + (to.y - from.y) * prog + 0.5) / h) * 100;
            return <div key={m.id} className="march-mark" style={{ left: `${px}%`, top: `${py}%` }}>{m.kind === "conquer" ? "🚩" : "⚔️"}</div>;
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
              {factionById[selDef.ownerId] && <div className="cost">{archetypeInfoFor(selDef.ownerId).label} rival · {archetypeInfoFor(selDef.ownerId).blurb}</div>}
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
