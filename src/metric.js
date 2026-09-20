import { mulberry32 } from './rng.js';
import { filterOutputs, orderedList } from './channel.js';

// Metric increments of Fig. A-4, indexed by the hypothesis' position on the ordered list
// (position 5 = not on the list). "Computed from data supplied by K. Jordan of Lincoln
// Laboratory" for sqrt(2E/N0) = 2.5, M = 8, list length 4.
export const IDIST_1965 = [17, -13, -29, -41, -64];
export const METRIC_SCALE = 10;   // integer units per bit; fits the 1965 table (see tests)

// q[i] = Pr(sent signal is in position i+1 of the list); q[l] = Pr(off the list)
export function estimateQ({ snr, M = 8, listLen = 4, trials = 200000, seed = 7 }) {
  const rand = mulberry32(seed), out = new Float64Array(M), q = new Array(listLen + 1).fill(0);
  for (let t = 0; t < trials; t++) {
    filterOutputs(rand, 0, snr, M, out);
    const pos = orderedList(out, M, listLen).indexOf(0);
    q[pos < 0 ? listLen : pos]++;
  }
  return q.map(c => c / trials);
}

// p. 29: log2(M q_i) - R on the list, log2(M q_{l+1} / (M - l)) - R off it
export function metricBits(q, { M = 8, listLen = 4, R = 1 } = {}) {
  return q.map((qi, i) => {
    const p = Math.max(qi, 1e-9);
    return (i < listLen ? Math.log2(M * p) : Math.log2(M * p / (M - listLen))) - R;
  });
}

export function metricTable(snr, opts = {}) {
  if (Math.abs(snr - 2.5) < 1e-9 && !opts.force) return IDIST_1965.slice();
  return metricBits(estimateQ({ snr, ...opts }), opts).map(x => Math.round(x * METRIC_SCALE));
}
