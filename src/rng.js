// All randomness is a pure function of (seed, n) so RESTART replays identically.

export function hash32(a, b) {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ ((b + 0x7f4a7c15) >>> 0), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h ^ (b >>> 0), 0x27d4eb2f);
  h ^= h >>> 15;
  return h >>> 0;
}

export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller; fills out[0..n-1] with N(0,1) samples
export function gaussians(rand, out, n) {
  for (let i = 0; i < n; i += 2) {
    const u = 1 - rand(), v = rand();
    const r = Math.sqrt(-2 * Math.log(u)), th = 2 * Math.PI * v;
    out[i] = r * Math.cos(th);
    if (i + 1 < n) out[i + 1] = r * Math.sin(th);
  }
}
