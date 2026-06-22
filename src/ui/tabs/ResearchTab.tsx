import { useState } from "react";
import { research as researchDefs, buildingById } from "../../sim/content";
import { rpCostFor } from "../../sim/effects";
import type { TabProps } from "../helpers";
import type { ResearchDef } from "../../sim/types";

type Branch = ResearchDef["branch"];
const BRANCH_ORDER: Branch[] = ["economy", "construction", "castellany", "military", "logistics", "statecraft"];
const BRANCH_LABEL: Record<Branch, string> = {
  economy: "🌾 Economy", construction: "🧱 Construction", castellany: "🏰 Castellany",
  military: "⚔️ Military", logistics: "🧭 Logistics", statecraft: "👑 Statecraft",
};
const BRANCH_COLOR: Record<Branch, string> = {
  economy: "#6f8a3e", construction: "#b07d1a", castellany: "#8a5fb0",
  military: "#b1442f", logistics: "#3f8f8a", statecraft: "#c08a2a",
};
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];

// card + lane geometry (a left→right tree per branch)
const NODE_W = 150, NODE_H = 70, GAP_X = 48, GAP_Y = 16, PAD = 18;
const COL = NODE_W + GAP_X, ROW = NODE_H + GAP_Y;

const byId: Record<string, ResearchDef> = Object.fromEntries(researchDefs.map((r) => [r.id, r]));

function shortEffect(def: ResearchDef): string {
  const e = def.effects[0];
  if (!e) return "";
  const pct = Math.round((e.valuePerRank ?? 0) * 100);
  switch (e.type) {
    case "production_pct": return `+${pct}%/rk ${e.target}`;
    case "storage_cap_pct": return `+${pct}%/rk ${e.target} storage`;
    case "tax_yield_pct": return `+${pct}%/rk tax`;
    case "build_time_pct": return `${pct}%/rk build time`;
    case "happiness_flat": return `+${e.valuePerRank}/rk happiness`;
    case "defense_health_pct": return `+${pct}%/rk wall HP`;
    case "march_speed_pct": return `+${pct}%/rk march speed`;
    case "scout_yield_pct": return `+${pct}%/rk scout loot`;
    case "troop_stat_pct": return `+${pct}%/rk ${e.target} ${e.stat}`;
    case "unlock_building": return `unlocks ${buildingById[e.target]?.name ?? e.target}`;
    case "unlock_troop": return `unlocks ${e.target}`;
    default: return "";
  }
}

export function ResearchTab({ state, dispatch }: TabProps) {
  const [branch, setBranch] = useState<Branch>("economy");
  const accent = BRANCH_COLOR[branch];
  const nodes = researchDefs.filter((r) => r.branch === branch);

  // prerequisites that live in THIS branch (drawn as connectors); others shown as text
  const inBranchPre = (d: ResearchDef) => (d.requires?.research ?? []).filter((p) => byId[p.id]?.branch === branch);

  const depthMemo: Record<string, number> = {};
  const depth = (id: string): number => {
    if (depthMemo[id] !== undefined) return depthMemo[id];
    const pre = inBranchPre(byId[id]);
    return (depthMemo[id] = pre.length ? 1 + Math.max(...pre.map((p) => depth(p.id))) : 0);
  };

  // tier (column) = in-branch depth; rows assigned to keep children near their parent
  const tiers: Record<number, ResearchDef[]> = {};
  let maxDepth = 0;
  for (const n of nodes) { const d = depth(n.id); (tiers[d] ??= []).push(n); maxDepth = Math.max(maxDepth, d); }
  const pos: Record<string, { x: number; y: number }> = {};
  let maxRows = 0;
  for (let d = 0; d <= maxDepth; d++) {
    const tier = tiers[d] ?? [];
    tier.sort((a, b) => {
      const pa = inBranchPre(a)[0], pb = inBranchPre(b)[0];
      return (pa ? pos[pa.id]?.y ?? 0 : 0) - (pb ? pos[pb.id]?.y ?? 0 : 0) || a.name.localeCompare(b.name);
    });
    tier.forEach((n, row) => { pos[n.id] = { x: PAD + d * COL, y: PAD + row * ROW }; });
    maxRows = Math.max(maxRows, tier.length);
  }
  const width = PAD * 2 + (maxDepth + 1) * COL - GAP_X;
  const height = PAD * 2 + maxRows * ROW - GAP_Y;

  const reqText = (def: ResearchDef): string => {
    const bits: string[] = [];
    for (const p of def.requires?.research ?? [])
      if ((state.research[p.id] ?? 0) < p.rank) bits.push(`${byId[p.id]?.name ?? p.id} ${ROMAN[p.rank] ?? p.rank}`);
    for (const [b, l] of Object.entries(def.requires?.buildingLevels ?? {}))
      if (!state.buildings.some((x) => x.id === b && x.level >= l)) bits.push(`${buildingById[b]?.name ?? b} L${l}`);
    return bits.join(" · ");
  };

  return (
    <div className="rwrap" style={{ backgroundImage: "linear-gradient(rgba(244,234,210,0.55), rgba(244,234,210,0.62)), url(sprites/bg_research.png)", backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="rtabs">
        {BRANCH_ORDER.map((b) => (
          <button key={b} className={"rtab" + (b === branch ? " on" : "")}
            style={b === branch ? { borderColor: BRANCH_COLOR[b], color: "#3a2708" } : undefined}
            onClick={() => setBranch(b)}>{BRANCH_LABEL[b]}</button>
        ))}
        <span className="rrp">📜 {Math.floor(state.resources.rp)}</span>
      </div>

      <div className="rscroll">
        <div className="rtree" style={{ width, height }}>
          <svg width={width} height={height} className="rlines">
            {nodes.flatMap((def) => inBranchPre(def).map((p) => {
              const a = pos[p.id], b = pos[def.id];
              const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = b.x, y2 = b.y + NODE_H / 2;
              const mx = x1 + GAP_X / 2;
              const done = (state.research[p.id] ?? 0) >= p.rank;
              return <path key={def.id + "<-" + p.id} d={`M${x1},${y1} H${mx} V${y2} H${x2}`}
                fill="none" stroke={done ? accent : "#b79c7f"} strokeWidth={done ? 2.4 : 1.6}
                opacity={done ? 0.9 : 0.5} />;
            }))}
          </svg>
          {nodes.map((def) => {
            const rank = state.research[def.id] ?? 0;
            const maxed = rank >= def.maxRank;
            const cost = rpCostFor(def.id, rank);
            const prereqOk =
              (def.requires?.research ?? []).every((r) => (state.research[r.id] ?? 0) >= r.rank) &&
              Object.entries(def.requires?.buildingLevels ?? {}).every(([b, l]) => state.buildings.some((x) => x.id === b && x.level >= l));
            const affordable = state.resources.rp >= cost;
            const cls = maxed ? "done" : !prereqOk ? "locked" : affordable ? "ready" : "wait";
            const need = !prereqOk ? reqText(def) : "";
            return (
              <button key={def.id} className={"rnode " + cls} disabled={maxed || !prereqOk || !affordable}
                style={{ left: pos[def.id].x, top: pos[def.id].y, width: NODE_W, height: NODE_H, borderColor: maxed || cls === "ready" ? accent : undefined }}
                onClick={() => dispatch({ type: "research", research: def.id })}>
                <div className="rname">{def.name}</div>
                <div className="reff">{need ? `🔒 needs ${need}` : shortEffect(def)}</div>
                <div className="rpips">
                  {Array.from({ length: def.maxRank }, (_, i) => <i key={i} className={i < rank ? "on" : ""} style={i < rank ? { background: accent } : undefined} />)}
                  <span className="rcost">{maxed ? "✓ max" : `📜 ${cost}`}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
