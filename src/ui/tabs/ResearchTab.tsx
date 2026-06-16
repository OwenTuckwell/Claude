import { research as researchDefs, buildingById } from "../../sim/content";
import { rpCostFor } from "../../sim/effects";
import type { TabProps } from "../helpers";
import type { ResearchDef } from "../../sim/types";

const BRANCH_ORDER: ResearchDef["branch"][] = ["economy", "construction", "military", "logistics", "statecraft"];
const BRANCH_LABEL: Record<string, string> = {
  economy: "🌾 Economy", construction: "🧱 Construction", military: "⚔️ Military",
  logistics: "🧭 Logistics", statecraft: "👑 Statecraft",
};

// layout geometry
const NODE_W = 132, NODE_H = 74, GAP_X = 30, GAP_Y = 20, PAD = 16, HEADER = 26;
const COL = NODE_W + GAP_X, ROW = NODE_H + GAP_Y;

const depthCache: Record<string, number> = {};
function depth(id: string): number {
  if (depthCache[id] !== undefined) return depthCache[id];
  const def = researchDefs.find((r) => r.id === id)!;
  const pre = def.requires?.research ?? [];
  const d = pre.length === 0 ? 0 : 1 + Math.max(...pre.map((p) => depth(p.id)));
  return (depthCache[id] = d);
}

function shortEffect(def: ResearchDef): string {
  const e = def.effects[0];
  if (!e) return "";
  const pct = Math.round((e.valuePerRank ?? 0) * 100);
  switch (e.type) {
    case "production_pct": return `+${pct}%/rk ${e.target}`;
    case "storage_cap_pct": return `+${pct}%/rk ${e.target} store`;
    case "tax_yield_pct": return `+${pct}%/rk tax`;
    case "build_time_pct": return `${pct}%/rk build time`;
    case "happiness_flat": return `+${e.valuePerRank}/rk happiness`;
    case "defense_health_pct": return `+${pct}%/rk wall HP`;
    case "march_speed_pct": return `+${pct}%/rk march`;
    case "scout_yield_pct": return `+${pct}%/rk scout loot`;
    case "troop_stat_pct": return `+${pct}%/rk ${e.target}`;
    case "unlock_building": return `unlocks ${buildingById[e.target]?.name ?? e.target}`;
    case "unlock_troop": return `unlocks ${e.target}`;
    default: return "";
  }
}

export function ResearchTab({ state, dispatch }: TabProps) {
  const branches = BRANCH_ORDER.filter((b) => researchDefs.some((r) => r.branch === b));

  // assign each node a column (branch) and row (sorted by prereq depth)
  const pos: Record<string, { x: number; y: number; col: number }> = {};
  let maxRows = 0;
  branches.forEach((branch, col) => {
    const nodes = researchDefs.filter((r) => r.branch === branch)
      .sort((a, b) => depth(a.id) - depth(b.id) || a.name.localeCompare(b.name));
    nodes.forEach((n, row) => {
      pos[n.id] = { x: PAD + col * COL, y: HEADER + PAD + row * ROW, col };
    });
    maxRows = Math.max(maxRows, nodes.length);
  });
  const width = PAD * 2 + branches.length * COL;
  const height = HEADER + PAD * 2 + maxRows * ROW;
  const cx = (id: string) => pos[id].x + NODE_W / 2;
  const cy = (id: string) => pos[id].y + NODE_H / 2;

  return (
    <div className="list">
      <div className="muted">Research points 📜 accrue from civic buildings. Lines link a tech to its prerequisites. Scroll to explore the tree.</div>
      <div className="card" style={{ overflow: "auto", padding: 8 }}>
        <div className="rtree" style={{ width, height }}>
          <svg width={width} height={height} className="rlines">
            {researchDefs.flatMap((def) =>
              (def.requires?.research ?? []).map((p) => (
                <line key={def.id + "<-" + p.id}
                  x1={cx(p.id)} y1={cy(p.id)} x2={cx(def.id)} y2={cy(def.id)}
                  stroke="#5a4a30" strokeWidth={2} />
              )),
            )}
          </svg>
          {branches.map((b, col) => (
            <div key={b} className="rcol-head" style={{ left: PAD + col * COL, width: NODE_W }}>{BRANCH_LABEL[b]}</div>
          ))}
          {researchDefs.map((def) => {
            const rank = state.research[def.id] ?? 0;
            const maxed = rank >= def.maxRank;
            const cost = rpCostFor(def.id, rank);
            const prereqOk =
              (def.requires?.research ?? []).every((r) => (state.research[r.id] ?? 0) >= r.rank) &&
              Object.entries(def.requires?.buildingLevels ?? {}).every(([bld, l]) => state.buildings.some((x) => x.id === bld && x.level >= l));
            const affordable = state.resources.rp >= cost;
            const cls = maxed ? "done" : !prereqOk ? "locked" : affordable ? "ready" : "wait";
            return (
              <button key={def.id} className={"rnode " + cls}
                style={{ left: pos[def.id].x, top: pos[def.id].y, width: NODE_W, height: NODE_H }}
                disabled={maxed || !prereqOk || !affordable}
                onClick={() => dispatch({ type: "research", research: def.id })}>
                <div className="rname">{def.name}</div>
                <div className="reff">{shortEffect(def)}</div>
                <div className="rfoot">
                  <span className="tag">{rank}/{def.maxRank}</span>
                  <span>{maxed ? "✓" : `📜${cost}`}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
