import { useState } from "react";
import { buildingById } from "../sim/content";

// A scenic isometric board: a soft grass island ringed by beach & sea, with buildings
// drawn as shaded little structures (gradient walls, overhanging roofs, chimneys,
// windows), z-sorted back-to-front, plus trees & bushes. Pure vector — no assets.

const TW = 62, TH = 31;            // tile width/height (2:1 dimetric)
const PAD = 16, HEADROOM = 64;

export interface Placed { idx: number; id: string; level: number; gx: number; gy: number; }

interface Cfg { wall: string; wallDark: string; roof: string; roofDark: string; h: number; roofH: number; flag?: boolean; round?: boolean; }
function cfgFor(id: string): Cfg {
  const cat = buildingById[id]?.category;
  if (id === "town_hall") return { wall: "url(#wStone)", wallDark: "#766d5d", roof: "url(#rRed)", roofDark: "#7e3527", h: 30, roofH: 20, flag: true };
  switch (cat) {
    case "housing": return { wall: "url(#wTimber)", wallDark: "#5e4329", roof: "url(#rRed)", roofDark: "#82382a", h: 21, roofH: 15 };
    case "production": return { wall: "url(#wTimber)", wallDark: "#5e4329", roof: "url(#rThatch)", roofDark: "#9a7d40", h: 21, roofH: 15 };
    case "storage": return { wall: "url(#wTimber)", wallDark: "#553c22", roof: "url(#rWood)", roofDark: "#4a3320", h: 23, roofH: 13 };
    case "civic": return { wall: "url(#wStone)", wallDark: "#766d5d", roof: "url(#rSlate)", roofDark: "#3f5a72", h: 27, roofH: 18, round: true };
    case "military": return { wall: "url(#wTimber)", wallDark: "#4f3a23", roof: "url(#rWood)", roofDark: "#3a2c1c", h: 25, roofH: 15, flag: true };
    default: return { wall: "url(#wTimber)", wallDark: "#5e4329", roof: "url(#rThatch)", roofDark: "#9a7d40", h: 21, roofH: 15 };
  }
}
const pts = (a: number[][]) => a.map((p) => p.map((n) => Math.round(n * 10) / 10).join(",")).join(" ");

function Building({ cx, cy, id, level }: { cx: number; cy: number; id: string; level: number }) {
  const c = cfgFor(id);
  const h = c.h + Math.min(12, (level - 1) * 2);
  const hw = TW / 2 * 0.62, hh = TH / 2 * 0.62;          // wall footprint (inset from tile)
  const ew = hw * 1.32, eh = hh * 1.32;                  // roof eave overhang
  const B = { t: [cx, cy - hh], r: [cx + hw, cy], b: [cx, cy + hh], l: [cx - hw, cy] };
  const Tp = { t: [cx, cy - hh - h], r: [cx + hw, cy - h], b: [cx, cy + hh - h], l: [cx - hw, cy - h] };
  const E = { t: [cx, cy - eh - h], r: [cx + ew, cy - h], b: [cx, cy + eh - h], l: [cx - ew, cy - h] };
  const ap = [cx, cy - h - c.roofH];
  const OL = { stroke: "#33271a", strokeWidth: 0.7, strokeLinejoin: "round" as const };
  return (
    <g>
      <ellipse cx={cx} cy={cy + hh + 1} rx={ew} ry={eh * 0.7} fill="rgba(20,28,12,0.22)" />
      {c.round ? (
        <>
          <path d={`M${B.l[0]},${B.l[1]} A${hw},${hh} 0 0 0 ${B.r[0]},${B.r[1]} L${Tp.r[0]},${Tp.r[1]} A${hw},${hh} 0 0 1 ${Tp.l[0]},${Tp.l[1]} Z`} fill={c.wall} {...OL} />
          <ellipse cx={cx} cy={cy - h} rx={hw} ry={hh} fill={c.wall} {...OL} />
        </>
      ) : (
        <>
          <polygon points={pts([B.l, B.b, Tp.b, Tp.l])} fill={c.wallDark} {...OL} />
          <polygon points={pts([B.b, B.r, Tp.r, Tp.b])} fill={c.wall} {...OL} />
          {/* door + window on the sunlit face */}
          <polygon points={pts([[cx + hw * 0.2, cy + hh * 0.2 - 1], [cx + hw * 0.62, cy - hh * 0.02 - 1], [cx + hw * 0.62, cy - hh * 0.02 - h * 0.5], [cx + hw * 0.2, cy + hh * 0.2 - h * 0.5]])} fill="rgba(35,24,14,0.6)" />
          <polygon points={pts([[cx + hw * 0.16, cy + hh * 0.16 - h * 0.62], [cx + hw * 0.46, cy + hh * 0.0 - h * 0.62], [cx + hw * 0.46, cy + hh * 0.0 - h * 0.86], [cx + hw * 0.16, cy + hh * 0.16 - h * 0.86]])} fill="#e7c061" opacity={0.8} />
        </>
      )}
      {/* roof: 4 slopes from eave to apex (front two read as lit/shadow) */}
      <polygon points={pts([E.l, E.t, ap])} fill={c.roofDark} {...OL} />
      <polygon points={pts([E.t, E.r, ap])} fill={c.roof} {...OL} />
      <polygon points={pts([E.l, E.b, ap])} fill={c.roofDark} {...OL} />
      <polygon points={pts([E.b, E.r, ap])} fill={c.roof} {...OL} />
      {!c.round && <rect x={cx + ew * 0.35} y={ap[1] + 2} width={3.4} height={c.roofH * 0.55} fill="#5b4a39" stroke="#33271a" strokeWidth={0.5} />}
      {c.flag && <g><line x1={ap[0]} y1={ap[1]} x2={ap[0]} y2={ap[1] - 13} stroke="#33271a" strokeWidth={1.3} /><polygon points={pts([[ap[0], ap[1] - 13], [ap[0] + 10, ap[1] - 10], [ap[0], ap[1] - 7.5]])} fill="#b1442f" stroke="#7e3527" strokeWidth={0.4} /></g>}
    </g>
  );
}

/** Renders a real PNG sprite (public/sprites/<id>.png) if present, anchored on the tile;
 *  otherwise the drawn vector building. Drop a transparent PNG to upgrade any building. */
function IsoBuilding({ cx, cy, id, level }: { cx: number; cy: number; id: string; level: number }) {
  const [loaded, setLoaded] = useState(false);
  const w = TW * 1.8, h = TW * 1.2;   // building art box (smaller — room to breathe)
  return (
    <g>
      <ellipse cx={cx} cy={cy + TH * 0.18} rx={TW * 0.34} ry={TH * 0.34} fill="rgba(20,28,12,0.22)" />
      {!loaded && <Building cx={cx} cy={cy} id={id} level={level} />}
      <image href={`sprites/${id}.png`} x={cx - w / 2} y={cy + TH * 0.35 - h} width={w} height={h}
        preserveAspectRatio="xMidYMax meet" style={{ display: loaded ? "" : "none" }}
        onLoad={() => setLoaded(true)} onError={() => { /* keep vector */ }} />
    </g>
  );
}

function Tree({ cx, cy }: { cx: number; cy: number }) {
  return <g>
    <ellipse cx={cx} cy={cy + 3} rx={8} ry={3.2} fill="rgba(20,28,12,0.2)" />
    <rect x={cx - 1.6} y={cy - 7} width={3.2} height={10} rx={1} fill="#6e4f2e" />
    <circle cx={cx} cy={cy - 13} r={9} fill="#5f7a3e" />
    <circle cx={cx - 5} cy={cy - 9} r={6} fill="#6f8a48" />
    <circle cx={cx + 5} cy={cy - 10} r={6} fill="#577037" />
  </g>;
}
function Bush({ cx, cy }: { cx: number; cy: number }) {
  return <g><circle cx={cx} cy={cy} r={4.5} fill="#5f7a3e" /><circle cx={cx + 4} cy={cy + 1} r={3.5} fill="#6f8a48" /></g>;
}

export function IsoBoard({ cols, rows, placed, selIdx, onSelect, onMoveTo, bg }: {
  cols: number; rows: number; placed: Placed[];
  selIdx: number | null; onSelect: (idx: number) => void; onMoveTo: (gx: number, gy: number) => void;
  bg?: string;
}) {
  const sx = (gx: number, gy: number) => (gx - gy) * (TW / 2);
  const sy = (gx: number, gy: number) => (gx + gy) * (TH / 2);
  const minSx = sx(0, rows - 1), maxSx = sx(cols - 1, 0), maxSy = sy(cols - 1, rows - 1);
  const W = (maxSx - minSx) + TW + PAD * 2;
  const H = maxSy + TH + HEADROOM + PAD * 2;
  // nudge the whole grid up-left so it sits on the meadow (which opens toward top-left)
  const ox = PAD - minSx + TW / 2 - W * 0.06;
  const oy = PAD + HEADROOM - H * 0.05;

  const occ = new Map(placed.map((p) => [`${p.gx},${p.gy}`, p]));
  const moving = selIdx !== null;
  const cells: { gx: number; gy: number }[] = [];
  for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) cells.push({ gx, gy });

  // island outline (the 4 extreme tile corners) → a beach ring behind the grass
  const cN = [sx(0, 0) + ox, sy(0, 0) + oy - TH / 2];
  const cE = [sx(cols - 1, 0) + ox + TW / 2, sy(cols - 1, 0) + oy];
  const cS = [sx(cols - 1, rows - 1) + ox, sy(cols - 1, rows - 1) + oy + TH / 2];
  const cW = [sx(0, rows - 1) + ox - TW / 2, sy(0, rows - 1) + oy];
  const ctr = [(cN[0] + cE[0] + cS[0] + cW[0]) / 4, (cN[1] + cE[1] + cS[1] + cW[1]) / 4];
  const grow = (p: number[], f: number) => [ctr[0] + (p[0] - ctr[0]) * f, ctr[1] + (p[1] - ctr[1]) * f];
  const sand = [grow(cN, 1.12), grow(cE, 1.12), grow(cS, 1.12), grow(cW, 1.12)];

  const treeAt = (gx: number, gy: number) => !occ.has(`${gx},${gy}`) && ((gx * 7 + gy * 13) % 4 === 0);
  const bushAt = (gx: number, gy: number) => !occ.has(`${gx},${gy}`) && ((gx * 5 + gy * 11) % 7 === 0) && !treeAt(gx, gy);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ display: "block" }} className="isoboard">
      <defs>
        <radialGradient id="seaG" cx="0.5" cy="0.4" r="0.8"><stop offset="0" stopColor="#4a7e9c" /><stop offset="1" stopColor="#2f5872" /></radialGradient>
        <linearGradient id="wTimber" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a87b4c" /><stop offset="1" stopColor="#7c5a3a" /></linearGradient>
        <linearGradient id="wStone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#bcb6aa" /><stop offset="1" stopColor="#928b7d" /></linearGradient>
        <linearGradient id="rRed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c4604a" /><stop offset="1" stopColor="#8a4030" /></linearGradient>
        <linearGradient id="rThatch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#cdb06a" /><stop offset="1" stopColor="#9a7d42" /></linearGradient>
        <linearGradient id="rSlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7290ab" /><stop offset="1" stopColor="#41617c" /></linearGradient>
        <linearGradient id="rWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8a663e" /><stop offset="1" stopColor="#553c22" /></linearGradient>
        <radialGradient id="grassG" cx="0.5" cy="0.4" r="0.8"><stop offset="0" stopColor="#86995a" /><stop offset="1" stopColor="#6b7e44" /></radialGradient>
      </defs>
      {bg
        ? <image href={bg} x={0} y={0} width={W} height={H} preserveAspectRatio="xMidYMid slice" />
        : <>
            <rect x={0} y={0} width={W} height={H} fill="url(#seaG)" />
            <polygon points={pts(sand)} fill="#cbb079" opacity={0.95} />
            <polygon points={pts(sand.map((p) => grow(p, 0.985)))} fill="url(#grassG)" />
          </>}
      {/* tiles: transparent ground, highlighted only as move targets (invisible grid) */}
      {cells.map(({ gx, gy }) => {
        const cx = sx(gx, gy) + ox, cy = sy(gx, gy) + oy;
        const grass = bg ? "transparent" : ((gx + gy) % 2 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)");
        const fill = moving && !occ.has(`${gx},${gy}`) ? "rgba(231,192,97,0.35)" : grass;
        return <polygon key={`g${gx}-${gy}`}
          points={pts([[cx, cy - TH / 2], [cx + TW / 2, cy], [cx, cy + TH / 2], [cx - TW / 2, cy]])}
          fill={fill} style={{ cursor: moving ? "copy" : "default" }}
          onClick={() => { if (moving) onMoveTo(gx, gy); }} />;
      })}
      {selIdx !== null && (() => { const p = placed.find((x) => x.idx === selIdx); if (!p) return null;
        const cx = sx(p.gx, p.gy) + ox, cy = sy(p.gx, p.gy) + oy;
        return <polygon points={pts([[cx, cy - TH / 2], [cx + TW / 2, cy], [cx, cy + TH / 2], [cx - TW / 2, cy]])} fill="none" stroke="#f1d985" strokeWidth={2.5} />;
      })()}
      {cells.slice().sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy)).map(({ gx, gy }) => {
        const cx = sx(gx, gy) + ox, cy = sy(gx, gy) + oy;
        const p = occ.get(`${gx},${gy}`);
        if (p) return <g key={`b${gx}-${gy}`} style={{ cursor: "pointer" }} onClick={() => onSelect(p.idx)}>
          <IsoBuilding cx={cx} cy={cy} id={p.id} level={p.level} />
        </g>;
        if (!bg && treeAt(gx, gy)) return <Tree key={`t${gx}-${gy}`} cx={cx} cy={cy} />;
        if (!bg && bushAt(gx, gy)) return <Bush key={`s${gx}-${gy}`} cx={cx} cy={cy} />;
        return null;
      })}
    </svg>
  );
}
