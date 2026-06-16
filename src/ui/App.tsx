import { useState } from "react";
import { balance } from "../sim/content";
import { happiness, housingCap, netProduction, storageCaps } from "../sim/sim";
import { RESOURCE_IDS, type RationLevel } from "../sim/types";
import { exportSave, importSave, resetSave } from "../host/persistence";
import { useGame } from "./useGame";
import { fmt, fmtRate, RESOURCE_META } from "./format";
import { VillageTab } from "./tabs/VillageTab";
import { MarketTab } from "./tabs/MarketTab";
import { ResearchTab } from "./tabs/ResearchTab";
import { MilitaryTab } from "./tabs/MilitaryTab";
import { WorldTab } from "./tabs/WorldTab";
import { ChronicleTab } from "./tabs/ChronicleTab";

type Tab = "village" | "market" | "research" | "military" | "world" | "chronicle";
const TABS: { id: Tab; label: string }[] = [
  { id: "village", label: "🏰 Village" },
  { id: "market", label: "🎟️ Market" },
  { id: "research", label: "📜 Research" },
  { id: "military", label: "⚔️ Army" },
  { id: "world", label: "🗺️ World" },
  { id: "chronicle", label: "📖 Log" },
];

export function App() {
  const game = useGame();
  const { state, mods, dispatch, error } = game;
  const [tab, setTab] = useState<Tab>("village");

  const caps = storageCaps(state, mods);
  const net = netProduction(state, mods);
  const h = happiness(state, mods);
  const cap = housingCap(state);

  return (
    <div className="app">
      <div className="hud">
        <div className="hud-res">
          {RESOURCE_IDS.map((r) => (
            <div className="res" key={r}>
              <div className="ic">{RESOURCE_META[r].icon}</div>
              <div className="val">{fmt(state.resources[r])}</div>
              {r !== "gold" && r !== "rp" && r !== "token" && <div className="muted" style={{ fontSize: 9 }}>/{fmt(caps[r])}</div>}
              <div className={"rate " + (net[r] >= 0 ? "pos" : "neg")}>{fmtRate(net[r])}</div>
            </div>
          ))}
        </div>
        <div className="dials">
          <span className="pop">👥 {Math.floor(state.population)}/{cap}</span>
          <label>Rations:&nbsp;
            <select value={state.rationLevel} onChange={(e) => dispatch({ type: "setRation", level: e.target.value as RationLevel })}>
              <option value="half">Half</option>
              <option value="normal">Normal</option>
              <option value="generous">Generous</option>
              <option value="double">Double</option>
            </select>
          </label>
          <label>Tax: {(state.taxRate * 100).toFixed(0)}%&nbsp;
            <input type="range" min={0} max={0.6} step={0.1} value={state.taxRate}
              onChange={(e) => dispatch({ type: "setTax", rate: Number(e.target.value) })} />
          </label>
          <span className={"happy " + (h >= 0 ? "pos" : "neg")}>{h >= 0 ? "🙂" : "☹️"} {h}</span>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      <div className="error">{error}</div>

      <div className="content">
        {tab === "village" && <VillageTab state={state} mods={mods} dispatch={dispatch} />}
        {tab === "market" && <MarketTab state={state} mods={mods} dispatch={dispatch} />}
        {tab === "research" && <ResearchTab state={state} mods={mods} dispatch={dispatch} />}
        {tab === "military" && <MilitaryTab state={state} mods={mods} dispatch={dispatch} />}
        {tab === "world" && <WorldTab state={state} dispatch={dispatch} />}
        {tab === "chronicle" && <ChronicleTab state={state} />}
      </div>

      <div className="foot">
        Bannerfall — M1 prototype · 1s ≈ {balance.tickLengthSec / 60} game-min
        <br />
        <button className="ghost" style={{ marginTop: 6 }} onClick={() => {
          const json = exportSave(state);
          navigator.clipboard?.writeText(json).then(
            () => alert("Save copied to clipboard."),
            () => prompt("Copy your save:", json),
          );
        }}>Export</button>
        &nbsp;
        <button className="ghost" onClick={() => {
          const json = prompt("Paste a save to import:");
          if (json) { const s = importSave(json); if (s) game.setState(s); else alert("Invalid save."); }
        }}>Import</button>
        &nbsp;
        <button className="ghost" onClick={() => {
          if (confirm("Abandon this realm and start over?")) { resetSave(); location.reload(); }
        }}>New game</button>
      </div>
    </div>
  );
}
