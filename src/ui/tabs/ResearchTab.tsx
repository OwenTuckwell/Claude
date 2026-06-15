import { research as researchDefs, buildingById } from "../../sim/content";
import { rpCostFor } from "../../sim/effects";
import type { TabProps } from "../helpers";
import type { ResearchDef } from "../../sim/types";

const BRANCHES: ResearchDef["branch"][] = ["economy", "construction", "military", "logistics", "statecraft"];
const BRANCH_LABEL: Record<string, string> = {
  economy: "🌾 Economy", construction: "🧱 Construction", military: "⚔️ Military",
  logistics: "🧭 Logistics", statecraft: "👑 Statecraft",
};

function effectText(def: ResearchDef): string {
  return def.effects.map((e) => {
    switch (e.type) {
      case "production_pct": return `+${Math.round((e.valuePerRank ?? 0) * 100)}%/rank ${e.target} output`;
      case "storage_cap_pct": return `+${Math.round((e.valuePerRank ?? 0) * 100)}%/rank ${e.target} storage`;
      case "tax_yield_pct": return `+${Math.round((e.valuePerRank ?? 0) * 100)}%/rank tax`;
      case "build_time_pct": return `${Math.round((e.valuePerRank ?? 0) * 100)}%/rank build time`;
      case "happiness_flat": return `+${e.valuePerRank}/rank happiness`;
      case "defense_health_pct": return `+${Math.round((e.valuePerRank ?? 0) * 100)}%/rank wall HP`;
      case "march_speed_pct": return `+${Math.round((e.valuePerRank ?? 0) * 100)}%/rank march speed`;
      case "troop_stat_pct": return `+${Math.round((e.valuePerRank ?? 0) * 100)}%/rank ${e.target} ${e.stat}`;
      case "unlock_building": return `unlocks ${buildingById[e.target]?.name ?? e.target}`;
      case "unlock_troop": return `unlocks ${e.target}`;
      default: return "";
    }
  }).filter(Boolean).join("; ");
}

export function ResearchTab({ state, dispatch }: TabProps) {
  return (
    <div className="list">
      <div className="muted">Research points accrue over time from civic buildings. Spend them to unlock and deepen tech.</div>
      {BRANCHES.map((branch) => {
        const defs = researchDefs.filter((d) => d.branch === branch);
        if (defs.length === 0) return null;
        return (
          <div className="card" key={branch}>
            <h3>{BRANCH_LABEL[branch]}</h3>
            <div className="list">
              {defs.map((def) => {
                const rank = state.research[def.id] ?? 0;
                const maxed = rank >= def.maxRank;
                const cost = rpCostFor(def.id, rank);
                const prereqOk =
                  (def.requires?.research ?? []).every((r) => (state.research[r.id] ?? 0) >= r.rank) &&
                  Object.entries(def.requires?.buildingLevels ?? {}).every(([b, l]) => state.buildings.some((x) => x.id === b && x.level >= l));
                const affordable = state.resources.rp >= cost;
                return (
                  <div className="row" key={def.id}>
                    <div>
                      <strong>{def.name}</strong> <span className="tag">{rank}/{def.maxRank}</span>
                      <div className="cost">{effectText(def)}</div>
                      {!maxed && <div className="cost">📜 {cost} {!prereqOk && "· locked (prereqs)"}</div>}
                    </div>
                    <button className="act" disabled={maxed || !prereqOk || !affordable}
                      onClick={() => dispatch({ type: "research", research: def.id })}>
                      {maxed ? "Done" : "Research"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
