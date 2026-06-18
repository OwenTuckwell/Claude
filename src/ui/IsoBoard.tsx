import { buildingById } from "../sim/content";

// A scenic isometric board: an island of iso tiles with buildings drawn as little 3D-ish
// structures (lit/shadowed faces + roofs), z-sorted back-to-front. Pure vector — no
// assets. Tap a building to select; tap an empty tile to move the selected one.

const TW = 58, TH = 29;           // tile width/height (2:1 dimetric)
const PAD = 14, HEADROOM = 58;    // room above for tall roofs/banners

export interface Placed { idx: number; id: string; level: number; gx: number; gy: number; }

interface Colors { wallL: string; wallD: string; roofL: string; roofD: string; h: number; roofH: number; flag?: boolean; }
function colorsFor(id: string): Colors {
  const cat = buildingById[id]?.category;
  if (id === "town_hall") return { wallL: "#b6ada0", wallD: "#857c6e", roofL: "#b35140", roofD: "#7e3527", h: 30, roofH: 20, flag: true };
  switch (cat) {
    case "housing": return { wallL: "#9a6f42", wallD: "#6e4f2e", roofL: "#b15a48", roofD: "#82382a", h: 20, roofH: 15 };
    case "production": return { wallL: "#9a6f42", wallD: "#6e4f2e", roofL: "#c4a45f", roofD: "#9a7d40", h: 20, roofH: 15 };
    case "storage": return { wallL: "#a07a48", wallD: "#735232", roofL: "#7c5a36", roofD: "#553c22", h: 22, roofH: 13 };
    case "civic": return { wallL: "#aaa498", wallD: "#7d7669", roofL: "#5b7a96", roofD: "#3f5a72", h: 26, roofH: 18 };
    case "military": return { wallL: "#8a6a44", wallD: "#5f472c", roofL: "#5a4632", roofD: "#3a2c1c", h: 24, roofH: 15, flag: true };
    default: return { wallL: "#9a6f42", wallD: "#6e4f2e", roofL: "#c4a45f", roofD: "#9a7d40", h: 20, roofH: 15 };
  }
}

const pts = (a: number[][]) => a.map((p) => p.join(",")).join(" ");

function Building({ cx, cy, id, level, selected }: { cx: number; cy: number; id: string; level: number; selected: boolean }) {
  const c = colorsFor(id);
  const h = c.h + Math.min(10, (level - 1) * 2);       // taller as it levels up
  const hw = TW / 2 * 0.78, hh = TH / 2 * 0.78;
  const B = { t: [cx, cy - hh], r: [cx + hw, cy], b: [cx, cy + hh], l: [cx - hw, cy] };
  const T = { t: [cx, cy - hh - h], r: [cx + hw, cy - h], b: [cx, cy + hh - h], l: [cx - hw, cy - h] };
  const apex = [cx, cy - h - c.roofH];
  return (
    <g style={{ cursor: "pointer" }} filter={selected ? "url(#glow)" : undefined}>
      <ellipse cx={cx} cy={cy + hh - 1} rx={hw * 1.1} ry={hh * 0.6} fill="rgba(0,0,0,0.22)" />
      <polygon points={pts([B.l, B.b, T.b, T.l])} fill={c.wallD} />
      <polygon points={pts([B.b, B.r, T.r, T.b])} fill={c.wallL} />
      {/* door on the sunlit front-right face */}
      <polygon points={pts([[cx + hw * 0.18, cy + hh * 0.18 - 2], [cx + hw * 0.55, cy - hh * 0.05 - 2], [cx + hw * 0.55, cy - hh * 0.05 - h * 0.5], [cx + hw * 0.18, cy + hh * 0.18 - h * 0.5]])} fill="rgba(40,28,16,0.55)" />
      <polygon points={pts([T.l, T.b, apex])} fill={c.roofD} />
      <polygon points={pts([T.b, T.r, apex])} fill={c.roofL} />
      <polygon points={pts([T.l, T.t, apex])} fill={c.roofD} opacity={0.85} />
      <polygon points={pts([T.t, T.r, apex])} fill={c.roofL} opacity={0.85} />
      {c.flag && <g><line x1={apex[0]} y1={apex[1]} x2={apex[0]} y2={apex[1] - 12} stroke="#3a2c1c" strokeWidth={1.3} /><polygon points={pts([[apex[0], apex[1] - 12], [apex[0] + 9, apex[1] - 9.5], [apex[0], apex[1] - 7]])} fill="#b1442f" /></g>}
    </g>
  );
}

function Tree({ cx, cy }: { cx: number; cy: number }) {
  return <g><ellipse cx={cx} cy={cy + 4} rx={7} ry={3} fill="rgba(0,0,0,0.18)" />
    <rect x={cx - 1.5} y={cy - 6} width={3} height={9} fill="#6e4f2e" />
    <polygon points={pts([[cx, cy - 22], [cx - 9, cy - 4], [cx + 9, cy - 4]])} fill="#5f7a3e" />
    <polygon points={pts([[cx, cy - 16], [cx - 7, cy - 1], [cx + 7, cy - 1]])} fill="#6f8a48" /></g>;
}

export function IsoBoard({ cols, rows, placed, selIdx, onSelect, onMoveTo }: {
  cols: number; rows: number; placed: Placed[];
  selIdx: number | null; onSelect: (idx: number) => void; onMoveTo: (gx: number, gy: number) => void;
}) {
  const sx = (gx: number, gy: number) => (gx - gy) * (TW / 2);
  const sy = (gx: number, gy: number) => (gx + gy) * (TH / 2);
  const minSx = sx(0, rows - 1), maxSx = sx(cols - 1, 0), maxSy = sy(cols - 1, rows - 1);
  const ox = PAD - minSx + TW / 2, oy = PAD + HEADROOM;
  const W = (maxSx - minSx) + TW + PAD * 2;
  const H = maxSy + TH + HEADROOM + PAD * 2;

  const occ = new Map(placed.map((p) => [`${p.gx},${p.gy}`, p]));
  const moving = selIdx !== null;
  const cells: { gx: number; gy: number }[] = [];
  for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) cells.push({ gx, gy });

  // deterministic decorative trees on some empty tiles
  const treeAt = (gx: number, gy: number) => !occ.has(`${gx},${gy}`) && ((gx * 7 + gy * 13) % 5 === 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" style={{ display: "block" }} className="isoboard">
      <defs>
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.4" floodColor="#e7c061" floodOpacity="0.95" />
        </filter>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill="#36617f" />
      {/* ground tiles */}
      {cells.map(({ gx, gy }) => {
        const cx = sx(gx, gy) + ox, cy = sy(gx, gy) + oy;
        const grass = (gx + gy) % 2 ? "#6f8246" : "#7a8c4e";
        const fill = moving && !occ.has(`${gx},${gy}`) ? "#8aa157" : grass;
        return <polygon key={`g${gx}-${gy}`}
          points={pts([[cx, cy - TH / 2], [cx + TW / 2, cy], [cx, cy + TH / 2], [cx - TW / 2, cy]])}
          fill={fill} stroke="rgba(40,40,20,0.18)" strokeWidth={1}
          style={{ cursor: moving ? "copy" : "default" }}
          onClick={() => { if (moving) onMoveTo(gx, gy); }} />;
      })}
      {/* selection ring on selected building's tile */}
      {selIdx !== null && (() => { const p = placed.find((x) => x.idx === selIdx); if (!p) return null;
        const cx = sx(p.gx, p.gy) + ox, cy = sy(p.gx, p.gy) + oy;
        return <polygon points={pts([[cx, cy - TH / 2], [cx + TW / 2, cy], [cx, cy + TH / 2], [cx - TW / 2, cy]])} fill="none" stroke="#e7c061" strokeWidth={2.5} />;
      })()}
      {/* trees + buildings, back-to-front */}
      {cells.slice().sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy)).map(({ gx, gy }) => {
        const cx = sx(gx, gy) + ox, cy = sy(gx, gy) + oy;
        const p = occ.get(`${gx},${gy}`);
        if (p) return <g key={`b${gx}-${gy}`} onClick={() => onSelect(p.idx)}>
          <Building cx={cx} cy={cy} id={p.id} level={p.level} selected={p.idx === selIdx} />
        </g>;
        if (treeAt(gx, gy)) return <Tree key={`t${gx}-${gy}`} cx={cx} cy={cy} />;
        return null;
      })}
    </svg>
  );
}
