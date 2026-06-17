// Phase 1 — scaling AI rivals (docs/05-scaling-roadmap.md Appendix B/C).
// Pure & deterministic. Assigns each rival faction a personality (archetype) derived from
// its id, and exposes the per-archetype knobs the AI turn reads. Difficulty scales magnitudes.
import { factions } from "./content";
import type { GameState } from "./types";

export type Archetype = "turtle" | "aggressor" | "economic";

function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

export function archetypeFor(factionId: string): Archetype {
  const a: Archetype[] = ["turtle", "aggressor", "economic"];
  return a[hash(factionId) % 3];
}

export interface ArchetypeInfo {
  label: string;
  expand: number;       // neutral tiles claimed per AI turn
  attackMult: number;   // multiplier on attack power vs the player
  willing: number;      // 0..1 willingness to launch an attack at the player
  economy: number;      // strength growth per turn (snowball rate)
  blurb: string;
}

export const ARCHETYPE: Record<Archetype, ArchetypeInfo> = {
  turtle:    { label: "Turtle",    expand: 1, attackMult: 0.85, willing: 0.25, economy: 0.5, blurb: "Defensive — hard to crack, rarely attacks." },
  aggressor: { label: "Aggressor", expand: 1, attackMult: 1.25, willing: 1.0,  economy: 0.4, blurb: "Warlike — raids your borders and sieges back." },
  economic:  { label: "Economic",  expand: 2, attackMult: 1.0,  willing: 0.5,  economy: 0.9, blurb: "Expansionist — snowballs if left unchecked." },
};

export function archetypeInfoFor(factionId: string): ArchetypeInfo {
  return ARCHETYPE[archetypeFor(factionId)];
}

/** Player progression index P — one number for "how strong is the player" (Appendix B.2).
 *  Rivals apply a small, capped pressure scaling from this so passive players feel heat. */
export function playerStrengthIndex(state: GameState): number {
  let tiles = 0;
  for (const v of Object.values(state.tileOwner)) if (v === "player") tiles++;
  let research = 0;
  for (const r of Object.values(state.research)) research += r;
  let army = 0;
  for (const c of Object.values(state.troops)) army += c;
  return tiles * 2 + research + army * 0.3;
}

export function factionCount(): number {
  return factions.filter((f) => !f.isPlayer).length;
}
