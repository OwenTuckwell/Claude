import type { ResourceId } from "../sim/types";

export const RESOURCE_META: Record<ResourceId, { label: string; icon: string }> = {
  food: { label: "Food", icon: "🌾" },
  wood: { label: "Wood", icon: "🪵" },
  stone: { label: "Stone", icon: "🪨" },
  iron: { label: "Iron", icon: "⛏️" },
  gold: { label: "Gold", icon: "🪙" },
  rp: { label: "Research", icon: "📜" },
  token: { label: "Tokens", icon: "🎟️" },
  renown: { label: "Renown", icon: "🏅" },
};

export const BUILDING_ICONS: Record<string, string> = {
  town_hall: "🏛️",
  farm: "🌾", windmill: "🌬️", woodcutters_lodge: "🌲", quarry: "🪨", iron_mine: "⛏️",
  hovel: "🛖", granary: "🏚️", stockpile: "📦", warehouse: "🏬", chapel: "⛪", tavern: "🍺",
  scholars_hall: "📚", university: "🎓", marketplace: "🏪",
  barracks: "🏯", archery_range: "🎯", blacksmith: "🔨", siege_workshop: "🪚",
  vineyard: "🍇", banquet_hall: "🍷", arena: "🏟️", stables: "🐴", training_grounds: "🎽", weaponsmith: "⚒️", armoury: "🛡️",
  wall: "🧱", wall_corner: "🧱", tower: "🗼", watchtower: "🏰",
  keep: "🏯", gatehouse: "🚪", moat: "🌊", barbican: "🏰",
};

export function fmt(n: number): string {
  if (Math.abs(n) >= 10000) return (n / 1000).toFixed(1) + "k";
  return Math.round(n).toString();
}

export function fmtRate(n: number): string {
  const r = Math.round(n * 100) / 100;
  return (r >= 0 ? "+" : "") + r;
}

/** A live countdown in real seconds → "Xs" / "Mm SSs" / "Hh MMm". */
export function fmtClock(realSec: number): string {
  const s = Math.max(0, Math.ceil(realSec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${(s % 60).toString().padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${(m % 60).toString().padStart(2, "0")}m`;
}

export function fmtDuration(ticks: number, tickLengthSec: number): string {
  const totalSec = ticks * tickLengthSec;
  if (totalSec < 60) return `${Math.round(totalSec)}s`;
  if (totalSec < 3600) return `${Math.round(totalSec / 60)}m`;
  if (totalSec < 86400) return `${(totalSec / 3600).toFixed(1)}h`;
  return `${(totalSec / 86400).toFixed(1)}d`;
}

export function armyLabel(army: Record<string, number>): string {
  const parts = Object.entries(army).filter(([, c]) => c > 0).map(([id, c]) => `${c} ${id}`);
  return parts.length ? parts.join(", ") : "—";
}
