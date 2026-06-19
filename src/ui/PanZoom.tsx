import { useEffect, useRef, useState, type ReactNode } from "react";

// Lightweight pinch-zoom + drag-to-pan for the village/castle scene. One finger pans,
// two fingers pinch-zoom. Taps still pass through to buildings (a drag suppresses the
// click). No pointer capture, so child onClick handlers keep working.
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function PanZoom({ children, height = 380, initialScale = 1 }: { children: ReactNode; height?: number; initialScale?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ s: initialScale, x: 0, y: 0 });
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; mid: { x: number; y: number }; t: { s: number; x: number; y: number } } | null>(null);
  const dragged = useRef(false);

  // centre the (scaled) content on first layout
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const w = el.clientWidth, h = el.clientHeight;
    setT((p) => ({ s: p.s, x: (w * (1 - p.s)) / 2, y: (h * (1 - p.s)) / 2 }));
  }, []);

  const arr = () => [...ptrs.current.values()];
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  const onDown = (e: React.PointerEvent) => {
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged.current = false;
    const p = arr();
    gesture.current = p.length >= 2
      ? { dist: dist(p[0], p[1]), mid: mid(p[0], p[1]), t: { ...t } }
      : { dist: 0, mid: { x: e.clientX, y: e.clientY }, t: { ...t } };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId) || !gesture.current) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = arr(), g = gesture.current;
    if (p.length >= 2) {
      const d = dist(p[0], p[1]), m = mid(p[0], p[1]);
      const s = clamp(g.t.s * (d / (g.dist || d)), 0.5, 3);
      const k = s / g.t.s;
      setT({ s, x: m.x - (g.mid.x - g.t.x) * k, y: m.y - (g.mid.y - g.t.y) * k });
      dragged.current = true;
    } else {
      const dx = p[0].x - g.mid.x, dy = p[0].y - g.mid.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) dragged.current = true;
      setT({ s: g.t.s, x: g.t.x + dx, y: g.t.y + dy });
    }
  };
  const onUp = (e: React.PointerEvent) => { ptrs.current.delete(e.pointerId); gesture.current = ptrs.current.size ? { dist: 0, mid: { x: e.clientX, y: e.clientY }, t: { ...t } } : null; };
  const onClickCapture = (e: React.MouseEvent) => { if (dragged.current) { e.stopPropagation(); e.preventDefault(); } };

  return (
    <div ref={wrap} style={{ height, overflow: "hidden", touchAction: "none", position: "relative", borderRadius: 9 }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClickCapture={onClickCapture}>
      <div style={{ transformOrigin: "0 0", transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})` }}>
        {children}
      </div>
    </div>
  );
}
