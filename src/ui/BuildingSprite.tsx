import { useState } from "react";
import { BUILDING_ICONS } from "./format";

/**
 * Renders a building's art sprite if one exists, otherwise the emoji fallback.
 * Drop a transparent PNG named `<buildingId>.png` into `public/sprites/` and it
 * appears automatically — no code change. The emoji shows until the image loads,
 * so there's never a broken-image flash for buildings without art yet.
 * See docs/asset-pipeline.md and public/sprites/README.md.
 */
export function BuildingSprite({ id }: { id: string }) {
  const [loaded, setLoaded] = useState(false);
  const src = `sprites/${id}.png`; // relative; works with Vite base "./" on GitHub Pages
  return (
    <span className="bsprite">
      {!loaded && <span className="bsprite-emoji">{BUILDING_ICONS[id] ?? "🏠"}</span>}
      <img src={src} alt="" className="bsprite-img" draggable={false}
        style={{ display: loaded ? "block" : "none" }}
        onLoad={() => setLoaded(true)} onError={() => { /* keep emoji */ }} />
    </span>
  );
}
