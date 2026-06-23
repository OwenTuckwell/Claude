import { BANNER_RANKS, bannerInfo, renownPerkLines } from "../../sim/renown";
import type { GameState } from "../../sim/types";

// The prestige ladder: Renown (earned from feasts/banquets and battlefield victories)
// raises your Banner Rank, each tier granting cumulative perks.
export function RenownTab({ state }: { state: GameState }) {
  const renown = Math.floor(state.resources.renown ?? 0);
  const info = bannerInfo(renown);
  const pct = info.next === null ? 100 : Math.min(100, ((renown - info.min) / (info.next - info.min)) * 100);

  return (
    <div className="list">
      <div className="card">
        <div className="row">
          <h3 style={{ margin: 0 }}>🏅 {info.title}</h3>
          <span className="tag">{renown} renown</span>
        </div>
        <div className="bar" style={{ marginTop: 8 }}><i style={{ width: pct + "%" }} /></div>
        <div className="cost" style={{ marginTop: 4 }}>
          {info.next === null ? "Highest banner rank reached." : `${info.next - renown} renown to ${BANNER_RANKS[info.tier + 1].title}`}
        </div>
        <div className="muted" style={{ marginTop: 8 }}>Your standing grants:</div>
        <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          {renownPerkLines(info.tier).map((l, i) => <span key={i} className="tag">{l}</span>)}
        </div>
      </div>

      <div className="card">
        <h3>Earn renown</h3>
        <div className="muted">🍷 Banquet Halls feast your court for steady renown · ⚔️ winning battles and 🚩 taking land earns renown · 🏯 toppling a rival capital is a great honour.</div>
      </div>

      <div className="card">
        <h3>Banner ranks</h3>
        <div className="list" style={{ gap: 4 }}>
          {BANNER_RANKS.map((r, i) => {
            const reached = renown >= r.min;
            const current = i === info.tier;
            return (
              <div className="row" key={r.title} style={{ opacity: reached ? 1 : 0.55 }}>
                <span style={{ fontWeight: current ? 800 : 600, color: current ? "var(--gold)" : undefined }}>
                  {reached ? "🏅" : "🔒"} {r.title}{current ? " — you" : ""}
                </span>
                <span className="cost">{r.min} renown · {2 + Math.floor(i / 2)} slots · +{i} 🙂</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
