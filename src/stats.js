// COMPUTE SEARCH DEPTH and COMPUTE WAITING LINE <ratio>, as defined on pp. 20 and 48-49.
//
// A search begins when the algorithm fails to advance (BEGIN SEARCH, if none is in progress)
// and is over when N exceeds the value it had when the search began. Its depth is that value
// minus the minimum N reached; a computation is counted at every N <- N+1 or N <- N-1.
//
// Waiting line: a baud arrives every `ratio` decoder moves. Each advance takes one baud off
// the line and each retreat puts one back. The line is sampled whenever a baud is received.

const BINS = 128;

export class Stats {
  constructor(ratio = 20) {
    this.ratio = ratio;
    this.depthHist = new Uint32Array(BINS);   // grain 1
    this.compHist = new Uint32Array(BINS);    // grain 4
    this.waitHist = new Uint32Array(BINS);
    this.searches = 0; this.moves = 0;
    this.inSearch = false; this.n0 = 0; this.minN = 0; this.comps = 0;
    this.wait = 0; this.arrival = 0;
  }
  get searchDepth() { return this.inSearch ? this.n0 - this.minN : 0; }   // SEARCH DEPTH
  get waitingLine() { return Math.floor(this.wait); }                     // WAITING LINE

  onEvent(ev) {
    if (ev.beginSearch && !this.inSearch) {
      this.inSearch = true; this.comps = 0;
      this.n0 = this.minN = ev.kind === 'retreat' ? ev.N + 1 : ev.N;
    }
    if (ev.kind !== 'advance' && ev.kind !== 'retreat') return;
    this.moves++;
    const fwd = ev.kind === 'advance';
    if (this.inSearch) {
      this.comps++;
      if (ev.N < this.minN) this.minN = ev.N;
      if (fwd && ev.N > this.n0) {
        this.depthHist[Math.min(BINS - 1, this.n0 - this.minN)]++;
        this.compHist[Math.min(BINS - 1, this.comps >> 2)]++;
        this.searches++; this.inSearch = false;
      }
    }
    // one decoder move = 1/ratio of a baud time
    this.wait += 1 / this.ratio + (fwd ? -1 : 1);
    this.arrival += 1 / this.ratio;
    if (this.wait < 0) {                      // caught up: idle until the next baud arrives
      this.wait = 0; this.arrival = 1;
    }
    while (this.arrival >= 1) { this.arrival -= 1; this.waitHist[Math.min(BINS - 1, Math.floor(this.wait))]++; }
  }

  // Fig. 6: number of searches of depth >= n
  depthTail() {
    const t = new Array(BINS).fill(0);
    let acc = 0;
    for (let i = BINS - 1; i >= 0; i--) { acc += this.depthHist[i]; t[i] = acc; }
    return t;
  }

  clone() {
    const s = new Stats(this.ratio);
    Object.assign(s, this);
    s.depthHist = this.depthHist.slice(); s.compHist = this.compHist.slice(); s.waitHist = this.waitHist.slice();
    return s;
  }
}
