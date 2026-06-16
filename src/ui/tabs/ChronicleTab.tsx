import { troopById } from "../../sim/content";
import { RESOURCE_IDS, type GameState } from "../../sim/types";
import { RESOURCE_META } from "../format";

function lossLabel(losses: Record<string, number>): string {
  const parts = Object.entries(losses).filter(([, c]) => c > 0).map(([id, c]) => `${c} ${troopById[id]?.name ?? id}`);
  return parts.length ? parts.join(", ") : "none";
}

export function ChronicleTab({ state }: { state: GameState }) {
  return (
    <div className="list">
      <div className="card">
        <h3>Battle reports</h3>
        {state.reports.length === 0 ? <div className="muted">No reports yet.</div> : state.reports.map((r) => (
          <div className="report" key={r.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 8, marginTop: 8 }}>
            <div className="row">
              <strong style={{ color: r.victory ? "var(--good)" : "var(--bad)" }}>
                {r.kind === "scout" ? "🧭 Scouting" : r.victory ? "Victory" : "Repelled"} — {r.targetName}
              </strong>
              {r.kind === "assault" && <span className="tag">{r.breached ? "walls breached" : "walls held"}</span>}
            </div>
            <div className="lines">{r.lines.map((l, i) => <div key={i}>· {l}</div>)}</div>
            {r.kind === "assault" && (
              <div className="cost">Our losses: {lossLabel(r.attackerLosses)} · Enemy losses: {lossLabel(r.defenderLosses)}</div>
            )}
            {Object.keys(r.loot).length > 0 && (
              <div className="cost">{r.kind === "scout" ? "Found" : "Loot"}: {RESOURCE_IDS.filter((x) => r.loot[x]).map((x) => `${RESOURCE_META[x].icon}${r.loot[x]}`).join("  ")}</div>
            )}
          </div>
        ))}
      </div>

      <div className="card log">
        <h3>Chronicle</h3>
        {state.log.map((e, i) => <div className={"e " + e.kind} key={i}>[{e.tick}] {e.text}</div>)}
      </div>
    </div>
  );
}
