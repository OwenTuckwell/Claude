import { useState } from "react";
import { buildingById } from "../sim/content";
import { footprint } from "../sim/sim";

// A scenic isometric board: a soft grass island ringed by beach & sea, with buildings
// drawn as shaded little structures (gradient walls, overhanging roofs, chimneys,
// windows), z-sorted back-to-front, plus trees & bushes. Pure vector — no assets.

const TW = 62, TH = 31;            // tile width/height (2:1 dimetric)
const PAD = 16, HEADROOM = 64;
// The playfield (grid + buildings) is scaled & centred onto the painted platform in the
// background art. Tune these to sit the buildable diamond on the meadow: SCALE shrinks the
// field to fit the platform; CX/CY are the platform centre as a fraction of the art.
const FIELD_SCALE = 0.82, FIELD_CX = 0.5, FIELD_CY = 0.46;

export interface Placed { idx: number; id: string; level: number; gx: number; gy: number; }

// per-building sprite scale tweaks (multiplier on the footprint-sized base box)
const SCALE: Record<string, number> = {
  hovel: 0.5, farm: 1.15, granary: 0.85, stockpile: 0.85, woodcutters_lodge: 0.75,
};

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

/** Renders a real PNG sprite (public/sprites/<id>.png) if present, sized to span the
 *  building's square footprint; otherwise the drawn vector building. cx is the block's
 *  centre x; cyBase is the front (bottom) corner-tile centre y; n is the footprint side. */
function IsoBuilding({ cx, cyBase, id, level, n }: { cx: number; cyBase: number; id: string; level: number; n: number }) {
  const [loaded, setLoaded] = useState(false);
  const sc = SCALE[id] ?? 1;
  // box grows with footprint but keeps the tuned 1×1 size (n=1 → 1.8/1.2 TW, unchanged)
  const w = TW * (0.9 * n + 0.9) * sc, h = TW * (0.6 * n + 0.6) * sc;
  return (
    <g>
      <ellipse cx={cx} cy={cyBase + TH * 0.18} rx={TW * 0.34 * n} ry={TH * 0.34 * n} fill="rgba(20,28,12,0.22)" />
      {!loaded && <Building cx={cx} cy={cyBase} id={id} level={level} />}
      <image href={`sprites/${id}.png`} x={cx - w / 2} y={cyBase + TH * 0.35 - h} width={w} height={h}
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

export function IsoBoard({ cols, rows, placed, selIdx, onSelect, onMoveTo, bg, canPlace, fill, field }: {
  cols: number; rows: number; placed: Placed[];
  selIdx: number | null; onSelect: (idx: number) => void; onMoveTo: (gx: number, gy: number) => void;
  bg?: string; canPlace?: (gx: number, gy: number) => boolean; fill?: boolean;
  field?: { scale: number; cx: number; cy: number };  // platform calibration (per scene)
}) {
  const sx = (gx: number, gy: number) => (gx - gy) * (TW / 2);
  const sy = (gx: number, gy: number) => (gx + gy) * (TH / 2);
  const minSx = sx(0, rows - 1), maxSx = sx(cols - 1, 0), maxSy = sy(cols - 1, rows - 1);
  const W = (maxSx - minSx) + TW + PAD * 2;
  const H = maxSy + TH + HEADROOM + PAD * 2;
  // base layout origin (grid centred in its own box); platform alignment is done by the
  // FIELD transform below so we can scale + position the whole playfield over the art.
  const ox = PAD - minSx + TW / 2;
  const oy = PAD + HEADROOM;
  // centre of the grid diamond, and the translate that lands it on the painted platform
  const fS = field?.scale ?? FIELD_SCALE, fCX = field?.cx ?? FIELD_CX, fCY = field?.cy ?? FIELD_CY;
  const fcx = ox, fcy = oy + sy(cols - 1, rows - 1) / 2;
  const ftx = W * fCX - fS * fcx;
  const fty = H * fCY - fS * fcy;
  const fieldT = `translate(${ftx.toFixed(1)} ${fty.toFixed(1)}) scale(${fS})`;

  const fp = (id: string) => footprint(id);
  // every cell each building covers → its Placed; used for occupancy & occlusion
  const covered = new Map<string, Placed>();
  for (const p of placed) for (let dy = 0; dy < fp(p.id); dy++) for (let dx = 0; dx < fp(p.id); dx++)
    covered.set(`${p.gx + dx},${p.gy + dy}`, p);
  const moving = selIdx !== null;
  const movingP = moving ? placed.find((p) => p.idx === selIdx) : undefined;
  const movingN = movingP ? fp(movingP.id) : 1;
  // a tile is a valid drop origin if the moving building's whole footprint fits there:
  // in-grid, clear of OTHER buildings, and passing the zone rule (canPlace).
  const validOrigin = (gx: number, gy: number): boolean => {
    if (!movingP) return false;
    if (gx + movingN > cols || gy + movingN > rows) return false;
    if (canPlace && !canPlace(gx, gy)) return false;
    for (let dy = 0; dy < movingN; dy++) for (let dx = 0; dx < movingN; dx++) {
      const occupant = covered.get(`${gx + dx},${gy + dy}`);
      if (occupant && occupant.idx !== selIdx) return false;
    }
    return true;
  };
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

  const treeAt = (gx: number, gy: number) => !covered.has(`${gx},${gy}`) && ((gx * 7 + gy * 13) % 4 === 0);
  const bushAt = (gx: number, gy: number) => !covered.has(`${gx},${gy}`) && ((gx * 5 + gy * 11) % 7 === 0) && !treeAt(gx, gy);

  // back-to-front draw list: buildings keyed by their front (bottom) corner, scenery by tile
  type Item = { key: string; y: number; el: React.ReactNode };
  const items: Item[] = [];
  for (const p of placed) {
    const n = fp(p.id);
    const cMid = (p.gx + (n - 1) / 2), rMid = (p.gy + (n - 1) / 2);   // block centre (grid)
    const cx = sx(cMid, rMid) + ox;
    const cyBase = sy(p.gx + n - 1, p.gy + n - 1) + oy;               // front corner tile centre
    items.push({
      key: `b${p.gx}-${p.gy}`, y: cyBase,
      el: <g key={`b${p.gx}-${p.gy}`} style={{ cursor: "pointer" }} onClick={() => onSelect(p.idx)}>
        <IsoBuilding cx={cx} cyBase={cyBase} id={p.id} level={p.level} n={n} />
      </g>,
    });
  }
  if (!bg) for (const { gx, gy } of cells) {
    const cx = sx(gx, gy) + ox, cy = sy(gx, gy) + oy;
    if (treeAt(gx, gy)) items.push({ key: `t${gx}-${gy}`, y: cy, el: <Tree key={`t${gx}-${gy}`} cx={cx} cy={cy} /> });
    else if (bushAt(gx, gy)) items.push({ key: `s${gx}-${gy}`, y: cy, el: <Bush key={`s${gx}-${gy}`} cx={cx} cy={cy} /> });
  }
  items.sort((a, b) => a.y - b.y);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={fill ? "100%" : "auto"}
      preserveAspectRatio="xMidYMid meet" style={{ display: "block" }} className="isoboard">
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
        : <rect x={0} y={0} width={W} height={H} fill="url(#seaG)" />}
      {/* the playfield (ground + grid + buildings) scaled & centred onto the platform art */}
      <g transform={fieldT}>
      {!bg && <>
        <polygon points={pts(sand)} fill="#cbb079" opacity={0.95} />
        <polygon points={pts(sand.map((p) => grow(p, 0.985)))} fill="url(#grassG)" />
      </>}
      {/* tiles: transparent ground; while moving, every valid drop ORIGIN lights up */}
      {cells.map(({ gx, gy }) => {
        const cx = sx(gx, gy) + ox, cy = sy(gx, gy) + oy;
        const placeable = moving && validOrigin(gx, gy);
        const grass = bg ? "transparent" : ((gx + gy) % 2 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)");
        const fill = placeable ? "rgba(231,192,97,0.4)" : grass;
        return <polygon key={`g${gx}-${gy}`}
          points={pts([[cx, cy - TH / 2], [cx + TW / 2, cy], [cx, cy + TH / 2], [cx - TW / 2, cy]])}
          fill={fill} style={{ cursor: placeable ? "copy" : "default" }}
          onClick={() => { if (placeable) onMoveTo(gx, gy); }} />;
      })}
      {/* outline the selected building's whole footprint diamond */}
      {movingP && (() => {
        const n = fp(movingP.id);
        const N = [sx(movingP.gx, movingP.gy) + ox, sy(movingP.gx, movingP.gy) + oy - TH / 2];
        const E = [sx(movingP.gx + n - 1, movingP.gy) + ox + TW / 2, sy(movingP.gx + n - 1, movingP.gy) + oy];
        const S = [sx(movingP.gx + n - 1, movingP.gy + n - 1) + ox, sy(movingP.gx + n - 1, movingP.gy + n - 1) + oy + TH / 2];
        const Wc = [sx(movingP.gx, movingP.gy + n - 1) + ox - TW / 2, sy(movingP.gx, movingP.gy + n - 1) + oy];
        return <polygon points={pts([N, E, S, Wc])} fill="none" stroke="#f1d985" strokeWidth={2.5} />;
      })()}
      {items.map((it) => it.el)}
      </g>
    </svg>
  );
}
