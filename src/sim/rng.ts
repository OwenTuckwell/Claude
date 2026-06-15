// Deterministic RNG (mulberry32). The state is stored in GameState.rngState so that
// identical inputs always reproduce identical outputs — required for offline catch-up
// correctness and for the server-authoritative MMO path (docs/03 §3).

export function nextRandom(state: number): { value: number; state: number } {
  let t = (state + 0x6d2b79f5) | 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  const value = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  return { value, state: t };
}
