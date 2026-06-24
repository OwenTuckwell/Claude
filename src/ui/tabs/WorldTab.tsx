import { useState, type ReactNode } from "react";
import { world, aiById, troopById, balance, factionById } from "../../sim/content";
import { defenderForTile, realmInfo, key as tileKey, nearestOwnedTile, buildExplored, tileVisibility, scoutRange } from "../../sim/territory";
import { archetypeInfoFor } from "../../sim/rivals";
import { computeModifiers } from "../../sim/effects";
import { type Command, type GameState } from "../../sim/types";
import { fmtDuration, fmtClock } from "../format";
import { TICKS_PER_REAL_SECOND } from "../../host/persistence";
import { PanZoom } from "../PanZoom";

export function WorldTab({ state, dispatch }: { state: GameState; dispatch: (c: Command) => void }) {
  const mods = computeModifiers(state);
  const scoutRank = state.research["scouting"] ?? 0;
  const scoutRankOk = scoutRank > 0;
  const [sel, setSel] = useState<{ x: number; y: number } | null>(null);
  const [army, setArmy] = useState<Record<string, number>>({});
  const { w, h } = world.gridSize;
  const isLand = (x: number, y: number) => world.land[y]?.[x] === "#";
  const ownerOf = (x: number, y: number) => state.tileOwner[tileKey(x, y)];
  const info = realmInfo(state);
  const garrison = Object.entries(state.troops).filter(([, c]) => c > 0);
  const explored = buildExplored(state);
  const vis = (x: number, y: number) => tileVisibility(state, explored, x, y);

  const selDef = sel ? defenderForTile(state.tileOwner, sel.x, sel.y) : null;
  const selDist = sel ? nearestOwnedTile(state.tileOwner, sel.x, sel.y).dist : 0;
  const selTravel = Math.max(1, Math.round((selDist * balance.conquest.tileTravelPerTile) / (1 + mods.marchSpeedPct)));
  const selOwn = sel ? ownerOf(sel.x, sel.y) : null;
  const selInRange = selDist <= scoutRange(state);   // scouts can only reach so far

  // ownership tint over the painted terrain (translucent so the art shows through)
  const ownColor = (x: number, y: number): string | null => {
    const o = ownerOf(x, y);
    if (!o || o === "neutral") return null;
    return factionById[o]?.color ?? "#888";
  };

  const keeps = [{ tile: world.player.tile, player: true, id: "player", name: "Your realm", difficulty: 0 },
    ...world.aiVillages] as { tile: { x: number; y: number }; player?: boolean; id: string; name: string; difficulty: number }[];

  return (
    <div className="vscene" style={{ aspectRatio: `${w} / ${h}` }}>
      <PanZoom fill initialScale={1}>
        <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet"
          className="realm-svg" style={{ display: "block" }}>
          {/* painted realm */}
          <image href="sprites/bg_map.png" x={0} y={0} width={w} height={h} preserveAspectRatio="xMidYMid slice" />
          {/* land tiles: ownership tint, fog over the unexplored, tap to inspect */}
          {Array.from({ length: w * h }, (_, i) => {
            const x = i % w, y = Math.floor(i / w);
            if (!isLand(x, y)) return null;
            const known = vis(x, y) >= 1;
            if (!known) return <rect key={"t" + i} x={x} y={y} width={1.02} height={1.02}
              fill="rgba(16,13,8,0.82)" style={{ cursor: "pointer" }} onClick={() => setSel({ x, y })} />;
            const col = ownColor(x, y);
            return <rect key={"t" + i} x={x} y={y} width={1.02} height={1.02}
              fill={col ?? "transparent"} fillOpacity={col ? 0.42 : 0}
              style={{ cursor: ownerOf(x, y) === "player" ? "default" : "pointer" }}
              onClick={() => setSel({ x, y })} />;
          })}
          {/* faction borders: edges where ownership changes */}
          {(() => {
            const lines: ReactNode[] = [];
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
              const o = ownerOf(x, y);
              if (!o || o === "neutral" || !isLand(x, y) || vis(x, y) < 1) continue;
              const stroke = o === "player" ? "#f4e6b6" : "rgba(255,255,255,0.7)";
              if (ownerOf(x + 1, y) !== o) lines.push(<line key={`vr${x}_${y}`} x1={x + 1} y1={y} x2={x + 1} y2={y + 1} stroke={stroke} strokeWidth={0.12} />);
              if (ownerOf(x - 1, y) !== o) lines.push(<line key={`vl${x}_${y}`} x1={x} y1={y} x2={x} y2={y + 1} stroke={stroke} strokeWidth={0.12} />);
              if (ownerOf(x, y + 1) !== o) lines.push(<line key={`hb${x}_${y}`} x1={x} y1={y + 1} x2={x + 1} y2={y + 1} stroke={stroke} strokeWidth={0.12} />);
              if (ownerOf(x, y - 1) !== o) lines.push(<line key={`ht${x}_${y}`} x1={x} y1={y} x2={x + 1} y2={y} stroke={stroke} strokeWidth={0.12} />);
            }
            return lines;
          })()}
          {sel && <rect x={sel.x} y={sel.y} width={1} height={1} fill="none" stroke="#f5e3a0" strokeWidth={0.22} />}
          {/* keeps */}
          {keeps.map((m) => {
            const known = m.player || vis(m.tile.x, m.tile.y) >= 1;
            if (!known) return null;
            const scouted = m.player || vis(m.tile.x, m.tile.y) >= 2;
            const alive = m.player || ownerOf(m.tile.x, m.tile.y) === m.id;
            const glyph = m.player ? "🏰" : !scouted ? "❓" : m.difficulty >= 3 ? "🛡️" : "⚔️";
            return <text key={m.id} x={m.tile.x + 0.5} y={m.tile.y + 0.6} fontSize={2.4} textAnchor="middle"
              dominantBaseline="central" opacity={alive ? 1 : 0.4} style={{ cursor: "pointer" }}
              onClick={() => setSel({ x: m.tile.x, y: m.tile.y })}>{glyph}</text>;
          })}
          {/* armies in transit */}
          {state.marches.map((m) => {
            const dest = m.kind === "conquer" ? m.targetTile : m.kind === "assault" ? aiById[m.targetId]?.tile : m.kind === "scout" ? m.targetTile : null;
            if (!dest) return null;
            const origin = nearestOwnedTile(state.tileOwner, dest.x, dest.y);
            const prog = Math.max(0, Math.min(1, 1 - Math.max(0, m.arriveTick - state.tick) / m.travelTicks));
            const from = m.phase === "outbound" ? origin : dest;
            const to = m.phase === "outbound" ? dest : origin;
            const px = from.x + (to.x - from.x) * prog + 0.5;
            const py = from.y + (to.y - from.y) * prog + 0.5;
            return <text key={m.id} x={px} y={py} fontSize={1.8} textAnchor="middle" dominantBaseline="central">{m.kind === "conquer" ? "🚩" : m.kind === "scout" ? "🧭" : "⚔️"}</text>;
          })}
        </svg>
      </PanZoom>

      <div className="scene-chip tl">👑 {info.isKing ? "King" : info.rank} <span className="tag">{info.tiles} lands</span></div>

      {state.marches.length > 0 && (
        <div className="scene-queue">
          {state.marches.map((m) => {
            const remain = Math.max(0, m.arriveTick - state.tick);
            const pct = m.travelTicks ? Math.min(100, Math.max(0, (1 - remain / m.travelTicks) * 100)) : 0;
            return (
              <div key={m.id} className="sq-item">
                <div className="queue-item" style={{ borderBottom: "none", padding: 0 }}>
                  <span>{m.kind === "scout" ? "🧭 " : m.kind === "conquer" ? "🚩 " : "⚔️ "}{m.phase === "outbound" ? "→ " : "← "}{m.targetName}</span>
                </div>
                <div className="bar"><i style={{ width: pct + "%" }} /></div>
                <div className="sq-time">⏳ {fmtClock(remain / TICKS_PER_REAL_SECOND)} · {m.phase === "outbound" ? "outbound" : "returning"}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="scene-actions">
        {scoutRankOk
          ? <button className="act" onClick={() => dispatch({ type: "scout" })}>🧭 Send scouts</button>
          : <span className="scene-hint">Research Scouting Parties to explore</span>}
        <span className="scene-hint">Tap land to inspect · pinch zoom · drag pan</span>
      </div>

      {/* tile inspect / conquer pop-up */}
      {sel && selDef && (
        <div className="modal" onClick={() => { setSel(null); setArmy({}); }}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            {selOwn === "player" ? (
              <>
                <div className="row"><h3 style={{ margin: 0 }}>Your land ({sel.x},{sel.y})</h3>
                  <button className="ghost" onClick={() => setSel(null)}>✕</button></div>
                <div className="muted" style={{ marginTop: 6 }}>Part of your realm. Keep troops at home to defend your borders.</div>
              </>
            ) : (
              <>
                <div className="row">
                  <h3 style={{ margin: 0 }}>{vis(sel.x, sel.y) < 1 ? `❓ Unknown lands (${sel.x},${sel.y})` : `${selDef.isCapital ? "🏯 " : "🚩 "}${factionById[selDef.ownerId]?.name ?? "Unclaimed"} (${sel.x},${sel.y})`}</h3>
                  <button className="ghost" onClick={() => { setSel(null); setArmy({}); }}>✕</button>
                </div>
                {selDef.isCapital && vis(sel.x, sel.y) >= 2 && <span className="tag">capital</span>}
                {vis(sel.x, sel.y) >= 1 && factionById[selDef.ownerId] && <div className="cost" style={{ marginTop: 4 }}>{archetypeInfoFor(selDef.ownerId).label} rival · {archetypeInfoFor(selDef.ownerId).blurb}</div>}
                {(() => {
                  const lv = vis(sel.x, sel.y);
                  const fuzz = (c: number) => `~${Math.max(1, Math.round(c / 5) * 5)}`;
                  if (lv < 2) return (
                    <div className="row" style={{ marginTop: 6 }}>
                      <span className="muted">Defenders: unknown — scout to reveal.{!selInRange && " (beyond scout range)"}</span>
                      {scoutRankOk && selInRange && <button className="ghost" onClick={() => dispatch({ type: "scoutTile", x: sel.x, y: sel.y })}>🔭 Scout</button>}
                    </div>
                  );
                  const list = Object.entries(selDef.garrison).map(([t, c]) => `${lv >= 3 ? c : fuzz(c)} ${troopById[t]?.name ?? t}`).join(", ") || "none";
                  return <div className="muted" style={{ marginTop: 6 }}>Defenders ({lv >= 3 ? "exact" : "estimated"}): {list}{selDef.fortifications.length ? ` · walls: ${selDef.fortifications.map((f) => `${f.building} L${f.level}`).join(", ")}` : ""}{selDef.isCapital && selDef.enclosure !== undefined ? ` · keep ${Math.round(selDef.enclosure * 100)}% sealed (bring siege engines)` : ""}
                    {lv < 3 && scoutRankOk && selInRange && <> · <a style={{ color: "var(--gold)", cursor: "pointer" }} onClick={() => dispatch({ type: "scoutTile", x: sel.x, y: sel.y })}>scout again</a></>}</div>;
                })()}
                {selDef.isCapital && vis(sel.x, sel.y) >= 1 && <div className="cost" style={{ marginTop: 4 }}>Taking this capital topples {factionById[selDef.ownerId]?.name} entirely.</div>}
                <h3 style={{ marginTop: 10, marginBottom: 0 }}>Assemble your army <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· ~{fmtDuration(selTravel, balance.tickLengthSec)} march</span></h3>
                {garrison.length === 0 ? <div className="muted" style={{ marginTop: 6 }}>Train troops first (Army).</div> : garrison.map(([id, c]) => (
                  <div className="row" key={id} style={{ marginTop: 4 }}>
                    <span>{troopById[id].name} <span className="muted">(have {c})</span></span>
                    <input className="num" type="number" min={0} max={c} value={army[id] ?? 0}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => setArmy({ ...army, [id]: Math.max(0, Math.min(c, Math.floor(Number(e.target.value) || 0))) })} />
                  </div>
                ))}
                <button className="act" style={{ marginTop: 8 }} disabled={Object.values(army).every((v) => !v)}
                  onClick={() => { dispatch({ type: "conquer", x: sel.x, y: sel.y, army }); setArmy({}); setSel(null); }}>
                  March to conquer
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
