// Renown & Banner Ranks — Bannerfall's prestige progression. Renown is a never-spent
// score (earned from feasts/banquets and battlefield victories); your total places you on
// a ladder of Banner Ranks, each granting cumulative perks. Deliberately original (not the
// SHKD honour ladder). No imports — both the sim and the UI read this.

export interface BannerRank { title: string; min: number; }

// Rising houses of Bannerfall — medieval flavour, original ladder.
export const BANNER_RANKS: BannerRank[] = [
  { title: "Hedge Knight", min: 0 },
  { title: "Bannerman", min: 60 },
  { title: "Marcher Lord", min: 180 },
  { title: "Castellan", min: 450 },
  { title: "Warden", min: 1000 },
  { title: "High Warden", min: 2200 },
  { title: "Banneret", min: 4500 },
  { title: "Marshal", min: 9000 },
  { title: "Liege", min: 18000 },
];

export function bannerTier(renown: number): number {
  let t = 0;
  for (let i = 0; i < BANNER_RANKS.length; i++) if (renown >= BANNER_RANKS[i].min) t = i;
  return t;
}

export interface BannerInfo { tier: number; title: string; min: number; next: number | null; }
export function bannerInfo(renown: number): BannerInfo {
  const tier = bannerTier(renown);
  return { tier, title: BANNER_RANKS[tier].title, min: BANNER_RANKS[tier].min, next: BANNER_RANKS[tier + 1]?.min ?? null };
}

export interface RenownPerks {
  buildSlots: number;       // concurrent construction slots
  happiness: number;        // flat happiness
  idlePct: number;          // bonus to idle income
  storagePct: number;       // bonus to storage caps (all resources)
  buildTimePct: number;     // negative = faster
}
/** Cumulative perks at a banner tier. */
export function renownPerks(tier: number): RenownPerks {
  return {
    buildSlots: 2 + Math.floor(tier / 2),
    happiness: tier,
    idlePct: tier * 0.015,
    storagePct: tier * 0.04,
    buildTimePct: -tier * 0.01,
  };
}

/** Human-readable perk lines for the current tier (for the Renown panel). */
export function renownPerkLines(tier: number): string[] {
  const p = renownPerks(tier);
  return [
    `🏗️ ${p.buildSlots} build slots`,
    `🙂 +${p.happiness} happiness`,
    `⚙️ +${Math.round(p.idlePct * 100)}% idle income`,
    `📦 +${Math.round(p.storagePct * 100)}% storage`,
    `⏱️ ${Math.round(p.buildTimePct * 100)}% build time`,
  ];
}
