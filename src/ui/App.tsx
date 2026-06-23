import { useState } from "react";
import { balance } from "../sim/content";
import { happiness, housingCap, netProduction, storageCaps } from "../sim/sim";
import { realmInfo } from "../sim/territory";
import { RESOURCE_IDS, type RationLevel } from "../sim/types";
import { exportSave, importSave, resetSave } from "../host/persistence";
import { useGame } from "./useGame";
import { fmt, fmtRate, RESOURCE_META } from "./format";
import { VillageTab } from "./tabs/VillageTab";
import { CastleTab } from "./tabs/CastleTab";
import { MarketTab } from "./tabs/MarketTab";
import { ResearchTab } from "./tabs/ResearchTab";
import { MilitaryTab } from "./tabs/MilitaryTab";
import { WorldTab } from "./tabs/WorldTab";
import { ChronicleTab } from "./tabs/ChronicleTab";
import { RenownTab } from "./tabs/RenownTab";
import { Toasts } from "./Toasts";
import { Onboarding } from "./Onboarding";
import { bannerInfo } from "../sim/renown";

// Navigation model: Village / Castle / Map are full-screen "places" you travel between via
// the right-hand rail; Tech / Market / Army / Log slide out as pop-out panels over the
// current place. Landscape-first (portrait shows a rotate prompt).
type Scene = "village" | "castle" | "world";
type Panel = "research" | "market" | "military" | "renown" | "chronicle" | "settings";

const SCENES: { id: Scene; icon: string; label: string }[] = [
  { id: "village", icon: "🛖", label: "Village" },
  { id: "castle", icon: "🏰", label: "Castle" },
  { id: "world", icon: "🗺️", label: "Map" },
];
const PANELS: { id: Panel; icon: string; label: string }[] = [
  { id: "research", icon: "📜", label: "Tech" },
  { id: "market", icon: "🎟️", label: "Market" },
  { id: "military", icon: "⚔️", label: "Army" },
  { id: "renown", icon: "🏅", label: "Renown" },
  { id: "chronicle", icon: "📖", label: "Log" },
  { id: "settings", icon: "⚙️", label: "Menu" },
];
const PANEL_TITLE: Record<Panel, string> = {
  research: "📜 Research", market: "🎟️ Market", military: "⚔️ Army", renown: "🏅 Renown", chronicle: "📖 Chronicle", settings: "⚙️ Menu",
};

export function App() {
  const game = useGame();
  const { state, mods, dispatch, error } = game;
  const [scene, setScene] = useState<Scene>("village");
  const [panel, setPanel] = useState<Panel | null>(null);

  const caps = storageCaps(state, mods);
  const net = netProduction(state, mods);
  const h = happiness(state, mods);
  const cap = housingCap(state);

  return (
    <div className="app">
      <div className="rotate">
        <div className="rotate-inner">📱↻<br />Rotate your device<br /><span>Bannerfall plays in landscape</span></div>
      </div>

      <div className="game" style={{ backgroundImage: "linear-gradient(rgba(14,15,17,0.5), rgba(14,15,17,0.6)), url(sprites/bg_app.png)", backgroundSize: "cover", backgroundPosition: "center" }}>
        {/* slim top dials bar */}
        <div className="hud">
          <div className="dials">
            <span className="pop">👥 {Math.floor(state.population)}/{cap}</span>
            <label>🍖
              <select value={state.rationLevel} onChange={(e) => dispatch({ type: "setRation", level: e.target.value as RationLevel })}>
                <option value="half">Half</option>
                <option value="normal">Normal</option>
                <option value="generous">Generous</option>
                <option value="double">Double</option>
              </select>
            </label>
            <label>Tax {(state.taxRate * 100).toFixed(0)}%
              <input type="range" min={0} max={0.6} step={0.1} value={state.taxRate}
                onChange={(e) => dispatch({ type: "setTax", rate: Number(e.target.value) })} />
            </label>
            <span className={"happy " + (h >= 0 ? "pos" : "neg")}>{h >= 0 ? "🙂" : "☹️"} {h}</span>
            <span className="pop" title="Your rank, by land held">👑 {realmInfo(state).rank}</span>
            <span className="pop" title="Your banner rank, by renown">🏅 {bannerInfo(state.resources.renown ?? 0).title}</span>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        <Toasts log={state.log} />
        <Onboarding state={state} />

        <div className="body">
        {/* left-hand resource rail */}
        <div className="resrail">
          {RESOURCE_IDS.map((r) => (
            <div className="rchip" key={r} title={RESOURCE_META[r].label}>
              <span className="ic">{RESOURCE_META[r].icon}</span>
              <span className="val">{fmt(state.resources[r])}</span>
              {r !== "gold" && r !== "rp" && r !== "token" && r !== "renown" && <span className="cap">/{fmt(caps[r])}</span>}
              <span className={"rate " + (net[r] >= 0 ? "pos" : "neg")}>{fmtRate(net[r])}</span>
            </div>
          ))}
        </div>
        {/* the active place fills the stage */}
        <div className="stage">
          {scene === "village" && <VillageTab state={state} mods={mods} dispatch={dispatch} />}
          {scene === "castle" && <CastleTab state={state} mods={mods} dispatch={dispatch} />}
          {scene === "world" && <WorldTab state={state} dispatch={dispatch} />}
        </div>

        {/* right-hand navigation rail */}
        <nav className="rail">
          <div className="rail-group">
            {SCENES.map((s) => (
              <button key={s.id} className={"railbtn" + (scene === s.id ? " active" : "")}
                onClick={() => { setScene(s.id); setPanel(null); }} title={s.label}>
                <span className="ri">{s.icon}</span><span className="rl">{s.label}</span>
              </button>
            ))}
          </div>
          <div className="rail-group">
            {PANELS.map((p) => (
              <button key={p.id} className={"railbtn small" + (panel === p.id ? " active" : "")}
                onClick={() => setPanel(panel === p.id ? null : p.id)} title={p.label}>
                <span className="ri">{p.icon}</span><span className="rl">{p.label}</span>
              </button>
            ))}
          </div>
        </nav>
        </div>

        {/* pop-out panel drawer */}
        {panel && (
          <div className="drawer-scrim" onClick={() => setPanel(null)}>
            <aside className={"drawer" + (panel === "research" ? " full" : "")} onClick={(e) => e.stopPropagation()}>
              <div className="drawer-head">
                <h3>{PANEL_TITLE[panel]}</h3>
                <button className="ghost" onClick={() => setPanel(null)}>✕</button>
              </div>
              <div className="drawer-body">
                {panel === "research" && <ResearchTab state={state} mods={mods} dispatch={dispatch} />}
                {panel === "market" && <MarketTab state={state} mods={mods} dispatch={dispatch} />}
                {panel === "military" && <MilitaryTab state={state} mods={mods} dispatch={dispatch} />}
                {panel === "renown" && <RenownTab state={state} />}
                {panel === "chronicle" && <ChronicleTab state={state} />}
                {panel === "settings" && (
                  <div className="list">
                    <div className="muted">Bannerfall — M1 prototype · 1s ≈ {balance.tickLengthSec / 60} game-min</div>
                    <button className="ghost" onClick={() => {
                      const json = exportSave(state);
                      navigator.clipboard?.writeText(json).then(
                        () => alert("Save copied to clipboard."),
                        () => prompt("Copy your save:", json),
                      );
                    }}>Export save</button>
                    <button className="ghost" onClick={() => {
                      const json = prompt("Paste a save to import:");
                      if (json) { const s = importSave(json); if (s) game.setState(s); else alert("Invalid save."); }
                    }}>Import save</button>
                    <button className="ghost" onClick={() => {
                      if (confirm("Abandon this realm and start over?")) { resetSave(); location.reload(); }
                    }}>New game</button>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
