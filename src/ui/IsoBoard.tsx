import { useRef, useState } from "react";
import { buildingById } from "../sim/content";
import { footprint } from "../sim/sim";

// A scenic isometric board: a soft grass island ringed by beach & sea, with buildings
// drawn as shaded little structures (gradient walls, overhanging roofs, chimneys,
// windows), z-sorted back-to-front, plus trees & bushes. Pure vector — no assets.

const TW = 62, TH = 31;            // tile width/height (2:1 dimetric)
const PAD = 16, HEADROOM = 64;

/** The board's intrinsic viewBox size for a grid — used to size the scene frame so it hugs
 *  the content (no letterbox) while keeping the meet-fit grid calibration valid. */
export function boardSize(cols: number, rows: number): { w: number; h: number } {
  const minSx = (0 - (rows - 1)) * (TW / 2), maxSx = (cols - 1) * (TW / 2);
  const maxSy = (cols - 1 + rows - 1) * (TH / 2);
  return { w: (maxSx - minSx) + TW + PAD * 2, h: maxSy + TH + HEADROOM + PAD * 2 };
}
// The playfield (grid + buildings) is scaled & centred onto the painted platform in the
// background art. Tune these to sit the buildable diamond on the meadow: SCALE shrinks the
// field to fit the platform; CX/CY are the platform centre as a fraction of the art.
const FIELD_SCALE = 0.82, FIELD_CX = 0.5, FIELD_CY = 0.46;

export interface Placed { idx: number; id: string; level: number; gx: number; gy: number; rot?: number; }

// Per-building sprite scale (multiplier on the footprint-sized base box). Tuned so most
// buildings read at the same on-screen size as the 2×2 stockpile: 1×1 buildings need a
// larger multiplier to match, farm is a touch bigger, granary a touch smaller, and the
// town hall (3×3) is the clear giant.
const SCALE: Record<string, number> = {
  // 1×1 buildings, sized up to match the stockpile baseline
  hovel: 1.28, woodcutters_lodge: 1.28, quarry: 1.28, windmill: 1.28, iron_mine: 1.28,
  farm: 1.44,
  // 2×2 buildings at the stockpile baseline
  stockpile: 0.85, granary: 0.78,
  chapel: 0.85, tavern: 0.85, marketplace: 0.85, scholars_hall: 0.85, university: 0.85,
  warehouse: 0.85, barracks: 0.85, archery_range: 0.85, blacksmith: 0.85, siege_workshop: 0.85,
  // the town hall is the biggest building in the village
  town_hall: 1.14,
  // newer buildings
  vineyard: 1.5,
  // castle: towers/keep stand tall so the low ramparts run into them
  tower: 1.18, watchtower: 1.3, gatehouse: 1.1, barbican: 1.15,
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
function IsoBuilding({ cx, cyBase, id, level, n, vary = 0 }: { cx: number; cyBase: number; id: string; level: number; n: number; vary?: number }) {
  const [loaded, setLoaded] = useState(false);
  const sc = SCALE[id] ?? 1;
  // Subtle per-instance variation so a row of identical buildings doesn't look stamped:
  // mirror ~half of them and nudge the scale a touch. Deterministic from the tile/index.
  const flip = vary % 2 === 1;
  const jit = 1 + ((Math.abs(vary) % 5) - 2) * 0.03;   // 0.94 .. 1.06
  // box grows with footprint but keeps the tuned 1×1 size (n=1 → 1.8/1.2 TW, unchanged)
  const w = TW * (0.9 * n + 0.9) * sc * jit, h = TW * (0.6 * n + 0.6) * sc * jit;
  return (
    <g>
      <ellipse cx={cx} cy={cyBase + TH * 0.18} rx={TW * 0.34 * n} ry={TH * 0.34 * n} fill="rgba(20,28,12,0.22)" />
      {!loaded && <Building cx={cx} cy={cyBase} id={id} level={level} />}
      <image href={`sprites/${id}.png`} x={cx - w / 2} y={cyBase + TH * 0.35 - h} width={w} height={h}
        preserveAspectRatio="xMidYMax meet" style={{ display: loaded ? "" : "none" }}
        transform={flip ? `matrix(-1,0,0,1,${(2 * cx).toFixed(1)},0)` : undefined}
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
// A wall sits on ONE edge of its tile (chosen by `rot`: 0:+x 1:+y 2:-x 3:-y) and is drawn as
// a raised battlemented rampart along that diamond edge. Walls on a shared edge coincide, so
// laying them around a keep forms a continuous, directional fortress wall. Rotate to aim it.
// Low ramparts: towers/keep are the tall high-points, walls the connecting battlements that
// run into them. Kept short so they don't tower over the turrets.
const wallH = (level: number) => 10 + Math.min(5, (level - 1) * 1.2);
// the four diamond edges of a tile, in rot order (+x:E-S  +y:S-W  -x:W-N  -y:N-E)
function tileEdges(cx: number, cy: number) {
  const hw = TW / 2, hh = TH / 2;
  const N = [cx, cy - hh], E = [cx + hw, cy], S = [cx, cy + hh], W = [cx - hw, cy];
  return [[E, S], [S, W], [W, N], [N, E]] as const;
}
// one rampart segment (stone face + walkway cap + merlons) along an edge A→B raised by h.
// Ends are extended a touch so neighbouring segments overlap into a continuous wall.
function rampart(A: readonly number[], B: readonly number[], h: number, key: string) {
  const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, ext = 1.05;
  const Ae = [mx + (A[0] - mx) * ext, my + (A[1] - my) * ext];
  const Be = [mx + (B[0] - mx) * ext, my + (B[1] - my) * ext];
  const At = [Ae[0], Ae[1] - h], Bt = [Be[0], Be[1] - h];
  const OL = { stroke: "#33271a", strokeWidth: 0.6, strokeLinejoin: "round" as const };
  return (
    <g key={key}>
      <polygon points={pts([Ae, Be, Bt, At])} fill="url(#wStone)" {...OL} />                {/* stone face */}
      <polygon points={pts([At, Bt, [Bt[0], Bt[1] - 3], [At[0], At[1] - 3]])} fill="#b3ada1" {...OL} /> {/* walkway cap */}
      {[0.18, 0.5, 0.82].map((t, i) => {                                                     /* merlons */
        const cmx = At[0] + (Bt[0] - At[0]) * t, cmy = At[1] + (Bt[1] - At[1]) * t;
        return <rect key={i} x={cmx - 1.4} y={cmy - 4} width={2.8} height={3.6} fill="#b3ada1" stroke="#33271a" strokeWidth={0.4} />;
      })}
    </g>
  );
}
function Wall({ cx, cy, level, rot = 0 }: { cx: number; cy: number; level: number; rot?: number }) {
  const e = tileEdges(cx, cy)[(((rot ?? 0) % 4) + 4) % 4];
  return <g>{rampart(e[0], e[1], wallH(level), "w")}</g>;
}
// A corner piece spans the TWO edges meeting at one diamond corner, so it turns the wall with
// no seam. `rot` picks the corner (0:S 1:W 2:N 3:E — the two edges r and r+1).
function WallCorner({ cx, cy, level, rot = 0 }: { cx: number; cy: number; level: number; rot?: number }) {
  const edges = tileEdges(cx, cy), r = (((rot ?? 0) % 4) + 4) % 4, h = wallH(level);
  // draw the more-distant edge first so the nearer one overlaps it cleanly at the shared corner
  const a = edges[r], b = edges[(r + 1) % 4];
  const back = a[1][1] <= b[1][1] ? a : b, front = back === a ? b : a;   // higher on screen = farther back
  return <g>{rampart(back[0], back[1], h, "c0")}{rampart(front[0], front[1], h, "c1")}</g>;
}

export function IsoBoard({ cols, rows, placed, selIdx, onSelect, bg, canPlace, fill, field, placeId, placeRot, dragCell, dragValid, onDragMove }: {
  cols: number; rows: number; placed: Placed[];
  selIdx: number | null; onSelect: (idx: number) => void;
  bg?: string; canPlace?: (gx: number, gy: number) => boolean; fill?: boolean;
  field?: { scale: number; cx: number; cy: number };  // platform calibration (per scene)
  placeId?: string;   // when set, we're placing a NEW (unplaced) building of this id
  placeRot?: number;  // rotation of the piece being placed (for the drag preview)
  dragCell?: { gx: number; gy: number } | null;   // tentative position while placing/moving
  dragValid?: boolean;                            // is dragCell a legal spot?
  onDragMove?: (gx: number, gy: number) => void;  // finger → tile while placing/moving
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);
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
  const movingP = selIdx !== null ? placed.find((p) => p.idx === selIdx) : undefined;
  // active placement = moving an existing building (movingP) OR placing a new one (placeId)
  const activeId = placeId ?? movingP?.id;
  const moving = !!activeId;
  const movingN = activeId ? fp(activeId) : 1;
  // a tile is a valid drop origin if the whole footprint fits there: in-grid, clear of
  // OTHER buildings, and passing the zone rule (canPlace).
  const validOrigin = (gx: number, gy: number): boolean => {
    if (!activeId) return false;
    if (gx + movingN > cols || gy + movingN > rows) return false;
    if (canPlace && !canPlace(gx, gy)) return false;
    for (let dy = 0; dy < movingN; dy++) for (let dx = 0; dx < movingN; dx++) {
      const occupant = covered.get(`${gx + dx},${gy + dy}`);
      if (occupant && occupant.idx !== selIdx) return false;
    }
    return true;
  };
  // map a pointer event to the grid cell under it (centres the footprint on the finger),
  // accounting for the field transform and the PanZoom CSS transform via getScreenCTM.
  const cellFromEvent = (e: React.PointerEvent) => {
    const svg = svgRef.current; if (!svg || !onDragMove) return;
    const ctm = svg.getScreenCTM(); if (!ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const px = (p.x - ftx) / fS, py = (p.y - fty) / fS;          // undo field transform
    const a = (px - ox) / (TW / 2), b = (py - oy) / (TH / 2);    // undo iso projection
    const gxF = (a + b) / 2, gyF = (b - a) / 2, n = movingN;
    const gx = Math.max(0, Math.min(cols - n, Math.round(gxF - (n - 1) / 2)));
    const gy = Math.max(0, Math.min(rows - n, Math.round(gyF - (n - 1) / 2)));
    onDragMove(gx, gy);
  };
  const onPointerDown = (e: React.PointerEvent) => { if (moving) { draggingRef.current = true; cellFromEvent(e); } };
  const onPointerMove = (e: React.PointerEvent) => { if (moving && draggingRef.current) cellFromEvent(e); };
  const onPointerUp = () => { draggingRef.current = false; };

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
    if (moving && p.idx === selIdx) continue;   // the building being moved is drawn at dragCell
    const n = fp(p.id);
    const cMid = (p.gx + (n - 1) / 2), rMid = (p.gy + (n - 1) / 2);   // block centre (grid)
    const cx = sx(cMid, rMid) + ox;
    const cyBase = sy(p.gx + n - 1, p.gy + n - 1) + oy;               // front corner tile centre
    items.push({
      key: `b${p.gx}-${p.gy}`, y: cyBase,
      el: <g key={`b${p.gx}-${p.gy}`} style={{ cursor: "pointer" }} onClick={() => onSelect(p.idx)}>
        {p.id === "wall"
          ? <Wall cx={cx} cy={cyBase} level={p.level} rot={p.rot ?? 0} />
          : p.id === "wall_corner"
          ? <WallCorner cx={cx} cy={cyBase} level={p.level} rot={p.rot ?? 0} />
          : <IsoBuilding cx={cx} cyBase={cyBase} id={p.id} level={p.level} n={n} vary={p.gx * 31 + p.gy * 7 + p.idx} />}
      </g>,
    });
  }
  const dragLevel = movingP?.level ?? 1;
  if (!bg) for (const { gx, gy } of cells) {
    const cx = sx(gx, gy) + ox, cy = sy(gx, gy) + oy;
    if (treeAt(gx, gy)) items.push({ key: `t${gx}-${gy}`, y: cy, el: <Tree key={`t${gx}-${gy}`} cx={cx} cy={cy} /> });
    else if (bushAt(gx, gy)) items.push({ key: `s${gx}-${gy}`, y: cy, el: <Bush key={`s${gx}-${gy}`} cx={cx} cy={cy} /> });
  }
  items.sort((a, b) => a.y - b.y);

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height={fill ? "100%" : "auto"}
      preserveAspectRatio="xMidYMid meet" style={{ display: "block", touchAction: moving ? "none" : undefined }} className="isoboard"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
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
      {/* tiles: transparent ground; while placing, valid drop origins glow faintly */}
      {cells.map(({ gx, gy }) => {
        const cx = sx(gx, gy) + ox, cy = sy(gx, gy) + oy;
        const placeable = moving && validOrigin(gx, gy);
        const grass = bg ? "transparent" : ((gx + gy) % 2 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)");
        const fill = placeable ? "rgba(231,192,97,0.22)" : grass;
        return <polygon key={`g${gx}-${gy}`}
          points={pts([[cx, cy - TH / 2], [cx + TW / 2, cy], [cx, cy + TH / 2], [cx - TW / 2, cy]])} fill={fill} />;
      })}
      {items.map((it) => it.el)}
      {/* the building being placed/moved, drawn at the tentative cell with a validity outline */}
      {moving && dragCell && activeId && (() => {
        const n = movingN, { gx, gy } = dragCell;
        const cx = sx(gx + (n - 1) / 2, gy + (n - 1) / 2) + ox;
        const cyBase = sy(gx + n - 1, gy + n - 1) + oy;
        const N = [sx(gx, gy) + ox, sy(gx, gy) + oy - TH / 2];
        const E = [sx(gx + n - 1, gy) + ox + TW / 2, sy(gx + n - 1, gy) + oy];
        const S = [sx(gx + n - 1, gy + n - 1) + ox, sy(gx + n - 1, gy + n - 1) + oy + TH / 2];
        const Wc = [sx(gx, gy + n - 1) + ox - TW / 2, sy(gx, gy + n - 1) + oy];
        const col = dragValid ? "#7ad06a" : "#e0604a";
        return <g>
          <polygon points={pts([N, E, S, Wc])} fill={dragValid ? "rgba(122,208,106,0.22)" : "rgba(224,96,74,0.22)"} stroke={col} strokeWidth={2.5} />
          <g opacity={0.92}>{activeId === "wall" ? <Wall cx={cx} cy={cyBase} level={dragLevel} rot={placeRot ?? movingP?.rot ?? 0} />
            : activeId === "wall_corner" ? <WallCorner cx={cx} cy={cyBase} level={dragLevel} rot={placeRot ?? movingP?.rot ?? 0} />
            : <IsoBuilding cx={cx} cyBase={cyBase} id={activeId} level={dragLevel} n={n} />}</g>
        </g>;
      })()}
      </g>
    </svg>
  );
}
