import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

// Pinch-zoom + drag-to-pan, clamped to the board. In `fill` mode the frame fills its
// parent and the board fits inside it at min zoom (1) — you can't zoom out into empty
// space — with panning bounded to the edges. Two fingers pinch, one pans; taps still
// reach the buildings (a drag suppresses the click).
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const MAX = 3;

export function PanZoom({ children, height = 360, initialScale = 1, fill = false }:
  { children: ReactNode; height?: number; initialScale?: number; fill?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const size = useRef({ cw: 0, ch: 0 });
  const [frameH, setFrameH] = useState(height);
  const [t, setT] = useState({ s: initialScale, x: 0, y: 0 });
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const g = useRef<{ dist: number; mid: { x: number; y: number }; t: { s: number; x: number; y: number } } | null>(null);
  const dragged = useRef(false);

  const clampT = (s: number, x: number, y: number) => {
    const sc = clamp(s, 1, MAX);
    const { cw, ch } = size.current;
    return { s: sc, x: clamp(x, cw * (1 - sc), 0), y: clamp(y, ch * (1 - sc), 0) };
  };

  useLayoutEffect(() => {
    const measure = () => {
      const w = wrap.current, i = inner.current; if (!w || !i) return;
      const cw = w.clientWidth, ch = fill ? w.clientHeight : i.offsetHeight;
      size.current = { cw, ch };
      if (!fill && ch > 0) setFrameH(ch);
      const s0 = clamp(initialScale, 1, MAX);
      setT(clampT(s0, cw * (1 - s0) / 2, ch * (1 - s0) / 2)); // centred
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fill]);

  const list = () => [...ptrs.current.values()];
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  const onDown = (e: React.PointerEvent) => {
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged.current = false;
    const p = list();
    g.current = p.length >= 2
      ? { dist: dist(p[0], p[1]), mid: mid(p[0], p[1]), t: { ...t } }
      : { dist: 0, mid: { x: e.clientX, y: e.clientY }, t: { ...t } };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId) || !g.current) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = list();
    if (p.length >= 2) {
      const d = dist(p[0], p[1]), m = mid(p[0], p[1]);
      const s = clamp(g.current.t.s * (d / (g.current.dist || d)), 1, MAX);
      const k = s / g.current.t.s;
      setT(clampT(s, m.x - (g.current.mid.x - g.current.t.x) * k, m.y - (g.current.mid.y - g.current.t.y) * k));
      dragged.current = true;
    } else {
      const dx = p[0].x - g.current.mid.x, dy = p[0].y - g.current.mid.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) dragged.current = true;
      setT(clampT(g.current.t.s, g.current.t.x + dx, g.current.t.y + dy));
    }
  };
  const onUp = (e: React.PointerEvent) => { ptrs.current.delete(e.pointerId); g.current = ptrs.current.size ? { dist: 0, mid: { x: e.clientX, y: e.clientY }, t: { ...t } } : null; };
  const onClickCapture = (e: React.MouseEvent) => { if (dragged.current) { e.stopPropagation(); e.preventDefault(); } };

  return (
    <div ref={wrap} style={{ height: fill ? "100%" : frameH, width: "100%", overflow: "hidden", touchAction: "none", position: "relative", borderRadius: fill ? 0 : 9 }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClickCapture={onClickCapture}>
      <div ref={inner} style={{ width: "100%", height: fill ? "100%" : undefined, transformOrigin: "0 0", transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})` }}>
        {children}
      </div>
    </div>
  );
}
