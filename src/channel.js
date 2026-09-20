import { hash32, mulberry32, gaussians } from './rng.js';
import { Coder } from './coder.js';

// The thesis recorded real demodulator outputs on tape; simulating the channel on the
// computer was its first "further work" item (p. 34). This is that: M orthogonal signals
// in white Gaussian noise. Matched filter i puts out N(0,1), plus sqrt(2E/N0) if signal i
// was sent. The decoder sees only the ordered list of the l largest outputs (Sec. II-E).

export const ADC_GAIN = 80, ADC_ZERO = 512;
export function adc(v) {   // 10-bit A-D converter
  return Math.max(0, Math.min(1023, Math.round(ADC_ZERO + v * ADC_GAIN)));
}

// Draw the M filter outputs into out[]
export function filterOutputs(rand, sent, snr, M, out) {
  gaussians(rand, out, M);
  out[sent] += snr;
}

// Indices of the l largest outputs, most probable first
export function orderedList(out, M, l) {
  const idx = [];
  for (let i = 0; i < M; i++) idx.push(i);
  idx.sort((p, q) => out[q] - out[p]);
  return idx.slice(0, l);
}

const CACHE = 2048;

export class Channel {
  constructor({ seed = 1965, snr = 2.5, M = 8, listLen = 4, message = 'zero', K = 60 } = {}) {
    Object.assign(this, { seed, snr, M, listLen, message, K });
    this.overrides = new Map();          // DATA AT N= edits
    this.cacheN = new Int32Array(CACHE).fill(-1);
    this.cache = new Array(CACHE);
    this.tx = new Coder(K); this.txN = -1; // transmitter's coder, run sequentially
    this.buf = new Float64Array(M);
  }
  msgBit(n) {
    if (n < 0 || this.message === 'zero') return 0;
    return hash32(this.seed ^ 0x5eed, n) & 1;
  }
  txSymbol(n) {
    if (this.message === 'zero') return 0;   // all-zero message always codes into symbol 0
    if (n !== this.txN + 1) {                // rebuild the register from the last K message bits
      this.tx.clear();
      for (let k = Math.max(0, n - this.K); k < n; k++) { this.tx.shiftRight(0); this.tx.enter(this.msgBit(k)); }
    }
    this.tx.shiftRight(0);
    const j = this.msgBit(n);
    const s = this.tx.symbolFor(j);
    this.tx.enter(j);
    this.txN = n;
    return s;
  }
  // Ordered list for baud n: { num: signal numbers, code: ADC values }, a pure function of (seed, n)
  received(n) {
    const o = this.overrides.get(n);
    if (o) return o;
    const slot = n & (CACHE - 1);
    if (this.cacheN[slot] === n) return this.cache[slot];
    const rand = mulberry32(hash32(this.seed, n));
    filterOutputs(rand, this.txSymbol(n), this.snr, this.M, this.buf);
    const num = orderedList(this.buf, this.M, this.listLen);
    const r = { num, code: num.map(i => adc(this.buf[i])) };
    this.cacheN[slot] = n; this.cache[slot] = r;
    return r;
  }
  override(n, list) { this.overrides.set(n, list); }
  flush() { this.cacheN.fill(-1); this.txN = -1; }
}
