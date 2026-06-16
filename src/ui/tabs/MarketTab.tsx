import { useState } from "react";
import { balance } from "../../sim/content";
import { storageCaps } from "../../sim/sim";
import { RESOURCE_IDS, type ResourceId } from "../../sim/types";
import type { TabProps } from "../helpers";
import { RESOURCE_META, fmt } from "../format";

const AMOUNTS = [1, 10, 50];

export function MarketTab({ state, mods, dispatch }: TabProps) {
  const [amt, setAmt] = useState(10);
  const caps = storageCaps(state, mods);
  const buy = balance.market.buyPriceTokens;
  const sell = balance.market.sellPriceTokens;

  return (
    <div className="list">
      <div className="card" style={{ textAlign: "center" }}>
        <h3>Market stall</h3>
        <div className="muted" style={{ marginBottom: 8 }}>
          Work the stall to earn trade tokens 🎟️. Tokens buy materials at the market below —
          the slow, steady way to fund your realm by hand.
        </div>
        <button className="tap-stall" onPointerDown={() => dispatch({ type: "tap" })}>
          🎟️ Work the stall &nbsp;(+{balance.market.tokensPerTap})
        </button>
        <div style={{ marginTop: 10, fontSize: 22, fontWeight: 800, color: "var(--gold)" }}>
          🎟️ {fmt(state.resources.token)} tokens
        </div>
      </div>

      <div className="card">
        <div className="row">
          <h3 style={{ margin: 0 }}>Trade</h3>
          <div>
            {AMOUNTS.map((a) => (
              <button key={a} className={a === amt ? "act" : "ghost"} style={{ marginLeft: 4 }} onClick={() => setAmt(a)}>{a}</button>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 6 }}>
          {RESOURCE_IDS.filter((r) => buy[r] || sell[r]).map((r: ResourceId) => {
            const buyCost = buy[r] ? Math.ceil(buy[r]! * amt) : null;
            const sellGain = sell[r] ? Math.floor(sell[r]! * amt) : null;
            const canBuy = buyCost !== null && state.resources.token >= buyCost && state.resources[r] + amt <= caps[r];
            const canSell = sellGain !== null && sellGain > 0 && state.resources[r] >= amt;
            return (
              <div className="tradeline" key={r}>
                <span>{RESOURCE_META[r].icon} {RESOURCE_META[r].label}</span>
                <button className="act" disabled={!canBuy}
                  onClick={() => dispatch({ type: "buy", resource: r, amount: amt })}>
                  Buy {amt} · 🎟️{buyCost}
                </button>
                <button className="ghost" disabled={!canSell}
                  onClick={() => dispatch({ type: "sell", resource: r, amount: amt })}>
                  {sellGain ? `Sell ${amt} · +🎟️${sellGain}` : "—"}
                </button>
              </div>
            );
          })}
        </div>
        <div className="muted" style={{ marginTop: 6 }}>Buying is capped by your storage. Selling pays less than buying — the market always takes its cut.</div>
      </div>
    </div>
  );
}
